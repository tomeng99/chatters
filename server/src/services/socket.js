const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

function getUnixTimestamp() {
  return Math.floor(Date.now() / 1000);
}

function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    try {
      const result = await pool.query(
        'SELECT conversation_id FROM conversation_members WHERE user_id = $1',
        [socket.user.id]
      );
      result.rows.forEach(({ conversation_id }) => {
        socket.join(`conversation:${conversation_id}`);
      });
    } catch (err) {
      console.error('Error joining conversation rooms on connect:', err);
    }

    socket.on('join_conversation', async (conversationId) => {
      try {
        const result = await pool.query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, socket.user.id]
        );
        if (result.rows.length > 0) {
          socket.join(`conversation:${conversationId}`);
        }
      } catch (err) {
        console.error('Error joining conversation:', err);
      }
    });

    socket.on('send_message', async (data, callback) => {
      try {
        const { conversationId, content, iv, isEncrypted, isCritical, taggedUserIds, messageType, fileName } = data;

        if (!conversationId || !content) {
          if (callback) callback({ error: 'conversationId and content are required' });
          return;
        }

        const validTypes = ['text', 'image', 'video', 'file'];
        const msgType = validTypes.includes(messageType) ? messageType : 'text';

        // Sanitize fileName: only store for non-text types, cap length
        let safeFileName = null;
        if (msgType !== 'text' && fileName) {
          safeFileName = String(fileName).slice(0, 255);
        }

        const memberResult = await pool.query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, socket.user.id]
        );

        if (memberResult.rows.length === 0) {
          if (callback) callback({ error: 'Not a member of this conversation' });
          return;
        }

        const messageId = uuidv4();
        const now = getUnixTimestamp();
        const critical = Boolean(isCritical);

        await pool.query(
          'INSERT INTO messages (id, conversation_id, sender_id, content, iv, is_encrypted, is_critical, message_type, file_name, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [messageId, conversationId, socket.user.id, content, iv || null, Boolean(isEncrypted), critical, msgType, safeFileName, now]
        );

        // Store tags if provided
        const validTaggedUserIds = [];
        if (taggedUserIds && Array.isArray(taggedUserIds) && taggedUserIds.length > 0) {
          // Fetch all conversation members once to validate tags in memory
          const allMembersResult = await pool.query(
            'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
            [conversationId]
          );
          const memberIdSet = new Set(allMembersResult.rows.map(r => r.user_id));

          for (const taggedUserId of taggedUserIds) {
            if (memberIdSet.has(taggedUserId)) {
              await pool.query(
                'INSERT INTO message_tags (message_id, tagged_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [messageId, taggedUserId]
              );
              validTaggedUserIds.push(taggedUserId);
            }
          }
        }

        const message = {
          id: messageId,
          conversationId,
          content,
          iv: iv || null,
          isEncrypted: Boolean(isEncrypted),
          isCritical: critical,
          taggedUserIds: validTaggedUserIds,
          messageType: msgType,
          fileName: safeFileName,
          createdAt: now,
          sender: { id: socket.user.id, username: socket.user.username },
        };

        io.to(`conversation:${conversationId}`).emit('new_message', message);

        // Send notifications to conversation members based on their preferences
        try {
          const membersResult = await pool.query(
            `SELECT u.id, u.notification_preference
             FROM conversation_members cm
             JOIN users u ON u.id = cm.user_id
             WHERE cm.conversation_id = $1 AND u.id != $2`,
            [conversationId, socket.user.id]
          );

          // Get conversation name for notification
          const convResult = await pool.query(
            'SELECT name, is_group FROM conversations WHERE id = $1',
            [conversationId]
          );
          const convName = convResult.rows[0]?.name || null;
          const isGroupConv = convResult.rows[0]?.is_group || false;

          // Build a map of userId to sockets once for all members
          const allSockets = await io.in(`conversation:${conversationId}`).fetchSockets();
          const socketsByUserId = new Map();
          for (const s of allSockets) {
            if (s.user && s.user.id) {
              if (!socketsByUserId.has(s.user.id)) socketsByUserId.set(s.user.id, []);
              socketsByUserId.get(s.user.id).push(s);
            }
          }

          for (const member of membersResult.rows) {
            const pref = member.notification_preference || 'all';
            let shouldNotify = false;

            if (pref === 'all') {
              shouldNotify = true;
            } else if (pref === 'tags_and_critical') {
              shouldNotify = critical || validTaggedUserIds.includes(member.id);
            } else if (pref === 'critical_only') {
              shouldNotify = critical;
            }
            // pref === 'none' → shouldNotify stays false

            if (shouldNotify) {
              const memberSockets = socketsByUserId.get(member.id) || [];
              for (const memberSocket of memberSockets) {
                memberSocket.emit('notification', {
                  type: 'new_message',
                  conversationId,
                  conversationName: convName,
                  isGroup: isGroupConv,
                  messageId,
                  senderUsername: socket.user.username,
                  isCritical: critical,
                  isTagged: validTaggedUserIds.includes(member.id),
                });
              }
            }
          }
        } catch (notifErr) {
          console.error('Notification delivery error:', notifErr);
          // Non-fatal: message was already sent successfully
        }

        if (callback) callback({ success: true, message });
      } catch (err) {
        console.error('Send message error:', err);
        if (callback) callback({ error: 'Failed to send message' });
      }
    });

    socket.on('typing', async ({ conversationId, isTyping }) => {
      try {
        const memberResult = await pool.query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, socket.user.id]
        );
        if (memberResult.rows.length === 0) return;

        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: socket.user.id,
          username: socket.user.username,
          isTyping,
        });
      } catch (err) {
        console.error('Typing event error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username} (${socket.id})`);
    });
  });
}

module.exports = { setupSocket };

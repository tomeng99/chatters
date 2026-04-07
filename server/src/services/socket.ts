import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Server, Socket } from 'socket.io';
import { pool } from '../config/database';
import { JWT_SECRET } from '../config/env';

interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    username: string;
  };
}

function getUnixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

export function setupSocket(io: Server): void {
  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string })?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    try {
      const user = jwt.verify(token, JWT_SECRET) as {
        id: string;
        username: string;
      };
      (socket as AuthenticatedSocket).user = user;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    console.log(`User connected: ${authSocket.user.username} (${authSocket.id})`);

    try {
      const result = await pool.query(
        'SELECT conversation_id FROM conversation_members WHERE user_id = $1',
        [authSocket.user.id]
      );
      result.rows.forEach(({ conversation_id }: { conversation_id: string }) => {
        authSocket.join(`conversation:${conversation_id}`);
      });
    } catch (err) {
      console.error('Error joining conversation rooms on connect:', err);
    }

    authSocket.on('join_conversation', async (conversationId: string) => {
      try {
        const result = await pool.query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, authSocket.user.id]
        );
        if (result.rows.length > 0) {
          authSocket.join(`conversation:${conversationId}`);
        }
      } catch (err) {
        console.error('Error joining conversation:', err);
      }
    });

    authSocket.on('send_message', async (
      data: {
        conversationId: string;
        content: string;
        iv?: string;
        isEncrypted?: boolean;
        isCritical?: boolean;
        taggedUserIds?: string[];
        messageType?: string;
        fileName?: string;
      },
      callback?: (response: { success?: boolean; message?: object; error?: string }) => void
    ) => {
      try {
        const { conversationId, content, iv, isEncrypted, isCritical, taggedUserIds, messageType, fileName } = data;

        if (!conversationId || !content) {
          if (callback) callback({ error: 'conversationId and content are required' });
          return;
        }

        const validTypes = ['text', 'image', 'video', 'file'];
        const msgType = validTypes.includes(messageType ?? '') ? messageType! : 'text';

        // Sanitize fileName: only store for non-text types, cap length
        let safeFileName: string | null = null;
        if (msgType !== 'text' && fileName) {
          safeFileName = String(fileName).slice(0, 255);
        }

        const memberResult = await pool.query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, authSocket.user.id]
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
          [messageId, conversationId, authSocket.user.id, content, iv || null, Boolean(isEncrypted), critical, msgType, safeFileName, now]
        );

        // Store tags if provided
        const validTaggedUserIds: string[] = [];
        if (taggedUserIds && Array.isArray(taggedUserIds) && taggedUserIds.length > 0) {
          // Fetch all conversation members once to validate tags in memory
          const allMembersResult = await pool.query(
            'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
            [conversationId]
          );
          const memberIdSet = new Set(
            (allMembersResult.rows as Array<{ user_id: string }>).map((r) => r.user_id)
          );

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
          sender: { id: authSocket.user.id, username: authSocket.user.username },
        };

        io.to(`conversation:${conversationId}`).emit('new_message', message);

        // Send notifications to conversation members based on their preferences
        try {
          const membersResult = await pool.query(
            `SELECT u.id, u.notification_preference
             FROM conversation_members cm
             JOIN users u ON u.id = cm.user_id
             WHERE cm.conversation_id = $1 AND u.id != $2`,
            [conversationId, authSocket.user.id]
          );

          // Get conversation name for notification
          const convResult = await pool.query(
            'SELECT name, is_group FROM conversations WHERE id = $1',
            [conversationId]
          );
          const convRow = convResult.rows[0] as { name: string | null; is_group: boolean } | undefined;
          const convName = convRow?.name || null;
          const isGroupConv = convRow?.is_group || false;

          // Build a map of userId to sockets once for all members
          const allSockets = await io.in(`conversation:${conversationId}`).fetchSockets();
          const socketsByUserId = new Map<string, typeof allSockets[number][]>();
          for (const s of allSockets) {
            const sUser = (s as unknown as AuthenticatedSocket).user;
            if (sUser?.id) {
              if (!socketsByUserId.has(sUser.id)) socketsByUserId.set(sUser.id, []);
              socketsByUserId.get(sUser.id)!.push(s);
            }
          }

          for (const member of membersResult.rows as Array<{ id: string; notification_preference: string }>) {
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
                  senderUsername: authSocket.user.username,
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

    authSocket.on('typing', async ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      try {
        const memberResult = await pool.query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, authSocket.user.id]
        );
        if (memberResult.rows.length === 0) return;

        authSocket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: authSocket.user.id,
          username: authSocket.user.username,
          isTyping,
        });
      } catch (err) {
        console.error('Typing event error:', err);
      }
    });

    authSocket.on('disconnect', () => {
      console.log(`User disconnected: ${authSocket.user.username} (${authSocket.id})`);
    });
  });
}

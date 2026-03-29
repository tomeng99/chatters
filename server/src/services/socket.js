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
        const { conversationId, content, iv, isEncrypted, messageType, fileName } = data;

        if (!conversationId || !content) {
          if (callback) callback({ error: 'conversationId and content are required' });
          return;
        }

        const validTypes = ['text', 'image', 'video', 'file'];
        const msgType = validTypes.includes(messageType) ? messageType : 'text';

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

        await pool.query(
          'INSERT INTO messages (id, conversation_id, sender_id, content, iv, is_encrypted, message_type, file_name, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [messageId, conversationId, socket.user.id, content, iv || null, Boolean(isEncrypted), msgType, fileName || null, now]
        );

        const message = {
          id: messageId,
          conversationId,
          content,
          iv: iv || null,
          isEncrypted: Boolean(isEncrypted),
          messageType: msgType,
          fileName: fileName || null,
          createdAt: now,
          sender: { id: socket.user.id, username: socket.user.username },
        };

        io.to(`conversation:${conversationId}`).emit('new_message', message);

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

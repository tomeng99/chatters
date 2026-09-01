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

    // Conversations this socket has an outstanding "typing" broadcast in, so a
    // disconnect can retract exactly those and nothing else.
    const typingConversationIds = new Set<string>();

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

    authSocket.on('delete_message', async (
      data: { messageId?: string },
      callback?: (response: { success?: boolean; error?: string }) => void
    ) => {
      try {
        const messageId = data?.messageId;
        if (!messageId) {
          if (callback) callback({ error: 'messageId is required' });
          return;
        }

        const messageResult = await pool.query(
          'SELECT conversation_id, sender_id, deleted_at FROM messages WHERE id = $1',
          [messageId]
        );
        const message = messageResult.rows[0] as
          | { conversation_id: string; sender_id: string; deleted_at: number | null }
          | undefined;

        if (!message) {
          if (callback) callback({ error: 'Message not found' });
          return;
        }

        // Only the author may retract a message. Authorship implies membership,
        // so this is strictly narrower than the send_message membership check.
        if (message.sender_id !== authSocket.user.id) {
          if (callback) callback({ error: 'Only the sender can delete this message' });
          return;
        }

        // Already retracted — nothing to broadcast, but the caller got what it wanted.
        if (message.deleted_at) {
          if (callback) callback({ success: true });
          return;
        }

        const deletedAt = getUnixTimestamp();

        // Drop the stored ciphertext instead of only flagging the row: on a
        // messenger that keeps nothing readable server-side, a retracted message
        // should stop being held at all. What is left is a tombstone: who sent it,
        // when, and when it was retracted.
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `UPDATE messages
             SET content = '', iv = NULL, file_name = NULL, is_encrypted = FALSE,
                 is_critical = FALSE, message_type = 'text', deleted_at = $2
             WHERE id = $1`,
            [messageId, deletedAt]
          );
          await client.query('DELETE FROM message_tags WHERE message_id = $1', [messageId]);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }

        io.to(`conversation:${message.conversation_id}`).emit('message_deleted', {
          messageId,
          conversationId: message.conversation_id,
          deletedAt,
        });

        if (callback) callback({ success: true });
      } catch (err) {
        console.error('Delete message error:', err);
        if (callback) callback({ error: 'Failed to delete message' });
      }
    });

    authSocket.on('typing', async ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      try {
        const memberResult = await pool.query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, authSocket.user.id]
        );
        if (memberResult.rows.length === 0) return;

        const typing = Boolean(isTyping);
        if (typing) {
          typingConversationIds.add(conversationId);
        } else {
          typingConversationIds.delete(conversationId);
        }

        authSocket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: authSocket.user.id,
          username: authSocket.user.username,
          isTyping: typing,
          conversationId,
        });
      } catch (err) {
        console.error('Typing event error:', err);
      }
    });

    // Retract any outstanding typing broadcast before the socket leaves its
    // rooms, so disconnecting mid-sentence does not leave a stuck indicator.
    authSocket.on('disconnecting', () => {
      for (const conversationId of typingConversationIds) {
        authSocket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: authSocket.user.id,
          username: authSocket.user.username,
          isTyping: false,
          conversationId,
        });
      }
      typingConversationIds.clear();
    });

    authSocket.on('disconnect', () => {
      console.log(`User disconnected: ${authSocket.user.username} (${authSocket.id})`);
    });
  });
}

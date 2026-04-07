import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const convsResult = await pool.query(
      `SELECT
        c.id,
        c.name,
        c.is_group,
        c.created_at,
        m.content AS last_message_content,
        m.created_at AS last_message_at,
        m.is_encrypted AS last_message_encrypted,
        u.username AS last_message_sender,
        m.sender_id AS last_message_sender_id
      FROM conversations c
      JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
      LEFT JOIN messages m ON m.id = (
        SELECT id FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      )
      LEFT JOIN users u ON u.id = m.sender_id
      ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
      [req.user.id]
    );

    const result = await Promise.all(
      convsResult.rows.map(async (conv: {
        id: string;
        name: string | null;
        is_group: boolean;
        created_at: number;
        last_message_content: string | null;
        last_message_at: number | null;
        last_message_encrypted: boolean | null;
        last_message_sender: string | null;
        last_message_sender_id: string | null;
      }) => {
        const membersResult = await pool.query(
          `SELECT u.id, u.username, u.public_key AS "publicKey"
           FROM conversation_members cm
           JOIN users u ON u.id = cm.user_id
           WHERE cm.conversation_id = $1`,
          [conv.id]
        );

        return {
          id: conv.id,
          name: conv.name,
          isGroup: Boolean(conv.is_group),
          createdAt: conv.created_at,
          members: membersResult.rows,
          lastMessage: conv.last_message_content
            ? {
                content: conv.last_message_content,
                createdAt: conv.last_message_at,
                isEncrypted: Boolean(conv.last_message_encrypted),
                senderUsername: conv.last_message_sender,
                senderId: conv.last_message_sender_id,
              }
            : null,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { memberUsernames, name } = req.body as { memberUsernames?: unknown; name?: string };

    if (!memberUsernames || !Array.isArray(memberUsernames) || memberUsernames.length === 0) {
      res.status(400).json({ error: 'memberUsernames array is required' });
      return;
    }

    const members = await Promise.all(
      (memberUsernames as string[]).map(async (username) => {
        const result = await pool.query(
          'SELECT id, username, public_key AS "publicKey" FROM users WHERE username = $1',
          [username]
        );
        if (result.rows.length === 0) {
          const err = Object.assign(new Error(`User '${username}' not found`), { status: 404 });
          throw err;
        }
        return result.rows[0] as { id: string; username: string; publicKey: string | null };
      })
    );

    const isGroup = members.length > 1;
    const conversationId = uuidv4();
    const conversationName = name || (isGroup ? (memberUsernames as string[]).join(', ') : null);

    if (!isGroup) {
      const otherUserId = members[0].id;
      const existing = await pool.query(
        `SELECT c.id FROM conversations c
         JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
         JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2
         WHERE c.is_group = false
         AND (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) = 2
         LIMIT 1`,
        [req.user.id, otherUserId]
      );

      if (existing.rows.length > 0) {
        const existId = existing.rows[0].id as string;
        const existConvResult = await pool.query('SELECT * FROM conversations WHERE id = $1', [existId]);
        const existMembersResult = await pool.query(
          `SELECT u.id, u.username, u.public_key AS "publicKey"
           FROM conversation_members cm JOIN users u ON u.id = cm.user_id
           WHERE cm.conversation_id = $1`,
          [existId]
        );
        const existConv = existConvResult.rows[0] as { id: string; name: string | null; is_group: boolean };
        res.json({
          id: existConv.id,
          name: existConv.name,
          isGroup: false,
          members: existMembersResult.rows,
        });
        return;
      }
    }

    const allMemberIds = [req.user.id, ...members.map((m) => m.id)];
    const uniqueMemberIds = [...new Set(allMemberIds)];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO conversations (id, name, is_group) VALUES ($1, $2, $3)',
        [conversationId, conversationName, isGroup]
      );
      for (const uid of uniqueMemberIds) {
        await client.query(
          'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)',
          [conversationId, uid]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const allMembersResult = await pool.query(
      `SELECT u.id, u.username, u.public_key AS "publicKey"
       FROM conversation_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = $1`,
      [conversationId]
    );

    res.status(201).json({
      id: conversationId,
      name: conversationName,
      isGroup,
      members: allMembersResult.rows,
    });
  } catch (err: unknown) {
    if ((err as { status?: number }).status) {
      res.status((err as { status: number }).status).json({ error: (err as Error).message });
      return;
    }
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt((req.query.limit as string) ?? '') || 50, 100);
    const before = req.query.before ? parseInt(req.query.before as string) : null;

    const memberResult = await pool.query(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ error: 'Not a member of this conversation' });
      return;
    }

    const params: (string | number)[] = [id as string];
    let paramCount = 1;
    let query = `
      SELECT m.id, m.conversation_id, m.content, m.iv, m.is_encrypted, m.is_critical, m.message_type, m.file_name, m.created_at,
             u.id AS sender_id, u.username AS sender_username
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = $${paramCount}
    `;

    if (before) {
      paramCount++;
      query += ` AND m.created_at < $${paramCount}`;
      params.push(before);
    }

    paramCount++;
    query += ` ORDER BY m.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const messagesResult = await pool.query(query, params);

    const messages = messagesResult.rows.reverse() as Array<{
      id: string;
      conversation_id: string;
      content: string;
      iv: string | null;
      is_encrypted: boolean;
      is_critical: boolean;
      message_type: string;
      file_name: string | null;
      created_at: number;
      sender_id: string;
      sender_username: string;
    }>;

    // Fetch tags for all messages in one query
    const messageIds = messages.map((m) => m.id);
    const tagsByMessage: Record<string, string[]> = {};
    if (messageIds.length > 0) {
      const tagsResult = await pool.query(
        'SELECT message_id, tagged_user_id FROM message_tags WHERE message_id = ANY($1)',
        [messageIds]
      );
      for (const tag of tagsResult.rows as Array<{ message_id: string; tagged_user_id: string }>) {
        if (!tagsByMessage[tag.message_id]) tagsByMessage[tag.message_id] = [];
        tagsByMessage[tag.message_id].push(tag.tagged_user_id);
      }
    }

    res.json(
      messages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversation_id,
        content: msg.content,
        iv: msg.iv,
        isEncrypted: Boolean(msg.is_encrypted),
        isCritical: Boolean(msg.is_critical),
        taggedUserIds: tagsByMessage[msg.id] || [],
        messageType: msg.message_type || 'text',
        fileName: msg.file_name || null,
        createdAt: msg.created_at,
        sender: { id: msg.sender_id, username: msg.sender_username },
      }))
    );
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/group-key', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const memberResult = await pool.query(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (memberResult.rows.length === 0) {
      res.status(403).json({ error: 'Not a member of this conversation' });
      return;
    }

    const keyResult = await pool.query(
      `SELECT gk.encrypted_key AS "encryptedKey", gk.nonce, gk.sender_id AS "senderId",
              u.public_key AS "senderPublicKey"
       FROM group_keys gk
       JOIN users u ON u.id = gk.sender_id
       WHERE gk.conversation_id = $1 AND gk.user_id = $2`,
      [id, req.user.id]
    );

    if (keyResult.rows.length === 0) {
      res.json({ exists: false });
      return;
    }

    res.json({ exists: true, ...keyResult.rows[0] });
  } catch (err) {
    console.error('Get group key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/group-key', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { keys } = req.body as {
      keys?: Array<{ userId: string; encryptedKey: string; nonce: string }>;
    };

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      res.status(400).json({ error: 'keys array is required' });
      return;
    }

    for (const key of keys) {
      if (!key.userId || !key.encryptedKey || !key.nonce) {
        res.status(400).json({ error: 'Each key must have userId, encryptedKey, and nonce' });
        return;
      }
    }

    const convResult = await pool.query(
      'SELECT is_group FROM conversations WHERE id = $1',
      [id]
    );
    if (convResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    if (!(convResult.rows[0] as { is_group: boolean }).is_group) {
      res.status(400).json({ error: 'Group keys are only for group conversations' });
      return;
    }

    const memberResult = await pool.query(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (memberResult.rows.length === 0) {
      res.status(403).json({ error: 'Not a member of this conversation' });
      return;
    }

    const existingKey = await pool.query(
      'SELECT 1 FROM group_keys WHERE conversation_id = $1 LIMIT 1',
      [id]
    );
    if (existingKey.rows.length > 0) {
      res.status(409).json({ error: 'Group key already distributed' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const key of keys) {
        const isMember = await client.query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [id, key.userId]
        );
        if (isMember.rows.length === 0) {
          console.warn(`Group key distribution: skipping non-member ${key.userId} for conversation ${id}`);
          continue;
        }

        await client.query(
          `INSERT INTO group_keys (conversation_id, user_id, encrypted_key, nonce, sender_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, key.userId, key.encryptedKey, key.nonce, req.user.id]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Distribute group key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

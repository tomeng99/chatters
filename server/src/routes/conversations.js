const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const conversations = db.prepare(`
      SELECT
        c.id,
        c.name,
        c.is_group,
        c.created_at,
        m.content AS last_message_content,
        m.created_at AS last_message_at,
        m.is_encrypted AS last_message_encrypted,
        u.username AS last_message_sender
      FROM conversations c
      JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
      LEFT JOIN messages m ON m.id = (
        SELECT id FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      )
      LEFT JOIN users u ON u.id = m.sender_id
      ORDER BY COALESCE(m.created_at, c.created_at) DESC
    `).all(req.user.id);

    const result = conversations.map((conv) => {
      const members = db.prepare(`
        SELECT u.id, u.username, u.public_key AS publicKey
        FROM conversation_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.conversation_id = ?
      `).all(conv.id);

      return {
        id: conv.id,
        name: conv.name,
        isGroup: Boolean(conv.is_group),
        createdAt: conv.created_at,
        members,
        lastMessage: conv.last_message_content
          ? {
              content: conv.last_message_content,
              createdAt: conv.last_message_at,
              isEncrypted: Boolean(conv.last_message_encrypted),
              senderUsername: conv.last_message_sender,
            }
          : null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', (req, res) => {
  try {
    const { memberUsernames, name } = req.body;

    if (!memberUsernames || !Array.isArray(memberUsernames) || memberUsernames.length === 0) {
      return res.status(400).json({ error: 'memberUsernames array is required' });
    }

    const members = memberUsernames.map((username) => {
      const user = db.prepare('SELECT id, username, public_key AS publicKey FROM users WHERE username = ?').get(username);
      if (!user) {
        const err = new Error(`User '${username}' not found`);
        err.status = 404;
        throw err;
      }
      return user;
    });

    const isGroup = members.length > 1;
    const conversationId = uuidv4();
    const conversationName = name || (isGroup ? memberUsernames.join(', ') : null);

    const insertConv = db.prepare(
      'INSERT INTO conversations (id, name, is_group) VALUES (?, ?, ?)'
    );
    const insertMember = db.prepare(
      'INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)'
    );

    if (!isGroup) {
      const otherUserId = members[0].id;
      const existing = db.prepare(`
        SELECT c.id FROM conversations c
        JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = ?
        JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = ?
        WHERE c.is_group = 0
        AND (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) = 2
        LIMIT 1
      `).get(req.user.id, otherUserId);

      if (existing) {
        const existingConv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(existing.id);
        const existingMembers = db.prepare(`
          SELECT u.id, u.username, u.public_key AS publicKey
          FROM conversation_members cm JOIN users u ON u.id = cm.user_id
          WHERE cm.conversation_id = ?
        `).all(existing.id);
        return res.json({ id: existingConv.id, name: existingConv.name, isGroup: false, members: existingMembers });
      }
    }

    const allMemberIds = [req.user.id, ...members.map((m) => m.id)];
    const uniqueMemberIds = [...new Set(allMemberIds)];

    const transaction = db.transaction(() => {
      insertConv.run(conversationId, conversationName, isGroup ? 1 : 0);
      for (const uid of uniqueMemberIds) {
        insertMember.run(conversationId, uid);
      }
    });
    transaction();

    const allMembers = db.prepare(`
      SELECT u.id, u.username, u.public_key AS publicKey
      FROM conversation_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id = ?
    `).all(conversationId);

    res.status(201).json({
      id: conversationId,
      name: conversationName,
      isGroup,
      members: allMembers,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/messages', (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before ? parseInt(req.query.before) : null;

    const member = db.prepare(
      'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?'
    ).get(id, req.user.id);

    if (!member) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    let query = `
      SELECT m.id, m.conversation_id, m.content, m.iv, m.is_encrypted, m.created_at,
             u.id AS sender_id, u.username AS sender_username
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ?
    `;
    const params = [id];

    if (before) {
      query += ' AND m.created_at < ?';
      params.push(before);
    }

    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(limit);

    const messages = db.prepare(query).all(...params);

    res.json(
      messages.reverse().map((msg) => ({
        id: msg.id,
        conversationId: msg.conversation_id,
        content: msg.content,
        iv: msg.iv,
        isEncrypted: Boolean(msg.is_encrypted),
        createdAt: msg.created_at,
        sender: { id: msg.sender_id, username: msg.sender_username },
      }))
    );
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

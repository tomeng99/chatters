const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return res.json([]);
    }

    const searchTerm = `%${q.trim()}%`;
    const users = db.prepare(`
      SELECT id, username, public_key
      FROM users
      WHERE username LIKE ? AND id != ?
      ORDER BY username ASC
      LIMIT 20
    `).all(searchTerm, req.user.id);

    res.json(users.map((u) => ({ id: u.id, username: u.username, publicKey: u.public_key })));
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/publicKey', (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, public_key FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: user.id, username: user.username, publicKey: user.public_key });
  } catch (err) {
    console.error('Get public key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

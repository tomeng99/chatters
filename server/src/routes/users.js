const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return res.json([]);
    }

    const searchTerm = `%${q.trim()}%`;
    const result = await pool.query(
      `SELECT id, username, public_key
       FROM users
       WHERE username ILIKE $1 AND id != $2
       ORDER BY username ASC
       LIMIT 20`,
      [searchTerm, req.user.id]
    );

    res.json(result.rows.map((u) => ({ id: u.id, username: u.username, publicKey: u.public_key })));
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/publicKey', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, public_key FROM users WHERE id = $1',
      [req.params.id]
    );
    const user = result.rows[0];
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

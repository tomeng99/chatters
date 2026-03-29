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

const VALID_NOTIFICATION_PREFERENCES = ['all', 'tags_and_critical', 'critical_only', 'none'];

router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT notification_preference FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ notificationPreference: result.rows[0].notification_preference });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { notificationPreference } = req.body;

    if (!notificationPreference || !VALID_NOTIFICATION_PREFERENCES.includes(notificationPreference)) {
      return res.status(400).json({
        error: `notificationPreference must be one of: ${VALID_NOTIFICATION_PREFERENCES.join(', ')}`,
      });
    }

    await pool.query(
      'UPDATE users SET notification_preference = $1 WHERE id = $2',
      [notificationPreference, req.user.id]
    );

    res.json({ notificationPreference });
  } catch (err) {
    console.error('Update settings error:', err);
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

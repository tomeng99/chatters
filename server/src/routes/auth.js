const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password, publicKey } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const userId = uuidv4();

    db.prepare(
      'INSERT INTO users (id, username, password_hash, public_key) VALUES (?, ?, ?, ?)'
    ).run(userId, username, passwordHash, publicKey || null);

    const token = jwt.sign(
      { id: userId, username },
      process.env.JWT_SECRET || 'change-this-secret-in-production',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: userId, username, publicKey: publicKey || null },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'change-this-secret-in-production',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, publicKey: user.public_key },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/public-key', require('../middleware/auth').authenticateToken, (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) {
      return res.status(400).json({ error: 'Public key is required' });
    }
    db.prepare('UPDATE users SET public_key = ? WHERE id = ?').run(publicKey, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Update public key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

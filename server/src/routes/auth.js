const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password, publicKey, encryptedPrivateKey, keySalt, keyNonce } = req.body;

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

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const userId = uuidv4();

    try {
      await pool.query(
        `INSERT INTO users (id, username, password_hash, public_key, encrypted_private_key, key_salt, key_nonce)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, username, passwordHash, publicKey || null,
         encryptedPrivateKey || null, keySalt || null, keyNonce || null]
      );
    } catch (insertErr) {
      if (insertErr.code === '23505') {
        return res.status(409).json({ error: 'Username already taken' });
      }
      throw insertErr;
    }

    const token = jwt.sign(
      { id: userId, username },
      process.env.JWT_SECRET,
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

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, publicKey: user.public_key },
      encryptedPrivateKey: user.encrypted_private_key || null,
      keySalt: user.key_salt || null,
      keyNonce: user.key_nonce || null,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/public-key', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const { publicKey, encryptedPrivateKey, keySalt, keyNonce } = req.body;
    if (!publicKey) {
      return res.status(400).json({ error: 'Public key is required' });
    }

    // Validate backup fields as all-or-nothing to prevent inconsistent state
    const backupFields = [encryptedPrivateKey, keySalt, keyNonce];
    const backupProvided = backupFields.filter(Boolean).length;
    if (backupProvided > 0 && backupProvided < 3) {
      return res.status(400).json({
        error: 'All backup fields (encryptedPrivateKey, keySalt, keyNonce) must be provided together',
      });
    }

    if (backupProvided === 3) {
      await pool.query(
        'UPDATE users SET public_key = $1, encrypted_private_key = $2, key_salt = $3, key_nonce = $4 WHERE id = $5',
        [publicKey, encryptedPrivateKey, keySalt, keyNonce, req.user.id]
      );
    } else {
      await pool.query('UPDATE users SET public_key = $1 WHERE id = $2', [publicKey, req.user.id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update public key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

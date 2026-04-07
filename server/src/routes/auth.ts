import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { JWT_SECRET } from '../config/env';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, publicKey, encryptedPrivateKey, keySalt, keyNonce } = req.body as {
      username: string;
      password: string;
      publicKey?: string;
      encryptedPrivateKey?: string;
      keySalt?: string;
      keyNonce?: string;
    };

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    if (username.length < 3 || username.length > 30) {
      res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
      return;
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
    } catch (insertErr: unknown) {
      if ((insertErr as { code?: string }).code === '23505') {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }
      throw insertErr;
    }

    const token = jwt.sign(
      { id: userId, username },
      JWT_SECRET,
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

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username: string; password: string };

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0] as {
      id: string;
      username: string;
      password_hash: string;
      public_key: string | null;
      encrypted_private_key: string | null;
      key_salt: string | null;
      key_nonce: string | null;
    } | undefined;

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
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

router.put('/public-key', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { publicKey, encryptedPrivateKey, keySalt, keyNonce } = req.body as {
      publicKey?: string;
      encryptedPrivateKey?: string;
      keySalt?: string;
      keyNonce?: string;
    };

    if (!publicKey) {
      res.status(400).json({ error: 'Public key is required' });
      return;
    }

    // Validate backup fields as all-or-nothing to prevent inconsistent state
    const backupFields = [encryptedPrivateKey, keySalt, keyNonce];
    const backupProvided = backupFields.filter(Boolean).length;
    if (backupProvided > 0 && backupProvided < 3) {
      res.status(400).json({
        error: 'All backup fields (encryptedPrivateKey, keySalt, keyNonce) must be provided together',
      });
      return;
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

export default router;

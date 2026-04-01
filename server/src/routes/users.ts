import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

const VALID_NOTIFICATION_PREFERENCES = ['all', 'tags_and_critical', 'critical_only', 'none'] as const;

router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query as { q?: string };
    if (!q || q.trim().length < 1) {
      res.json([]);
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const searchTerm = `%${q.trim()}%`;
    const result = await pool.query(
      `SELECT id, username, public_key
       FROM users
       WHERE username ILIKE $1 AND id != $2
       ORDER BY username ASC
       LIMIT 20`,
      [searchTerm, authReq.user.id]
    );

    res.json(result.rows.map((u: { id: string; username: string; public_key: string | null }) => ({
      id: u.id,
      username: u.username,
      publicKey: u.public_key,
    })));
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/settings', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await pool.query(
      'SELECT notification_preference FROM users WHERE id = $1',
      [authReq.user.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ notificationPreference: result.rows[0].notification_preference });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const { notificationPreference } = req.body as { notificationPreference?: string };
    const authReq = req as AuthenticatedRequest;

    if (!notificationPreference || !(VALID_NOTIFICATION_PREFERENCES as readonly string[]).includes(notificationPreference)) {
      res.status(400).json({
        error: `notificationPreference must be one of: ${VALID_NOTIFICATION_PREFERENCES.join(', ')}`,
      });
      return;
    }

    await pool.query(
      'UPDATE users SET notification_preference = $1 WHERE id = $2',
      [notificationPreference, authReq.user.id]
    );

    res.json({ notificationPreference });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/publicKey', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, username, public_key FROM users WHERE id = $1',
      [req.params.id]
    );
    const user = result.rows[0] as { id: string; username: string; public_key: string | null } | undefined;
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ id: user.id, username: user.username, publicKey: user.public_key });
  } catch (err) {
    console.error('Get public key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

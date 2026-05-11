import express from 'express';
import { clog } from '@lirdle/logger';
import { getUserStats } from '@lirdle/db/leaderboard.js';

const router = express.Router();

/**
 * GET /api/user/history?userId=<id>&sortBy=field>&order=asc|desc>&limit=n>
 * Returns a user's game history with computed stats.
 */
router.get('/api/user/history', async (req, res) => {
  try {
    const { userId, sortBy, order, limit } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    const result = await getUserStats(userId, sortBy, order, limit ? Number(limit) : undefined);
    res.json({ success: true, ...result });
  } catch (error) {
    clog(console.error, '[apps/web/index.js] Error fetching user history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

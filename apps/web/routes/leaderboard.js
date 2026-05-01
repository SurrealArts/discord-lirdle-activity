import express from 'express';
import { clog } from '@lirdle/logger';
import { getLeaderboard } from '@lirdle/db/leaderboard.js';

const router = express.Router();

/**
 * GET /api/leaderboard?guildId=<id>&period=daily|monthly|all&date=YYYY-MM-DD
 * Returns ranked leaderboard entries for a guild within a time period.
 * Uses UserGuild table to scope players — no memberId list needed.
 */
router.get('/api/leaderboard', async (req, res) => {
  try {
    const { guildId, period = 'daily', date } = req.query;
    if (!guildId) {
      return res.status(400).json({ error: 'Missing guildId' });
    }
    if (!['daily', 'monthly', 'all'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use daily, monthly, or all.' });
    }
    const entries = await getLeaderboard(guildId, period, date);
    res.json({ success: true, period, entries });
  } catch (error) {
    clog(console.error, '[apps/web/routes/leaderboard.js] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
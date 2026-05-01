import express from 'express';
import { clog } from '@lirdle/logger';

const router = express.Router();

// These will be set by the main app
let CLIENT_ID;
let db;

/**
 * Set dependencies for this route
 * @param {Object} deps - Dependencies object
 */
router.setDependencies = function(deps) {
  CLIENT_ID = deps.CLIENT_ID;
  db = deps.db;
};

/**
 * GET /api/config
 * Returns client configuration
 */
router.get('/api/config', (req, res) => {
  res.json({ clientId: CLIENT_ID });
});

/**
 * GET /api/guild-config?guildId=<id>
 * Returns guild configuration (channel settings, monthly stats toggle).
 */
router.get('/api/guild-config', async (req, res) => {
  try {
    const { guildId } = req.query;
    if (!guildId) {
      return res.status(400).json({ error: 'Missing guildId' });
    }
    let config = await db.guildConfig.findUnique({ where: { guildId } });
    if (!config) {
      config = {
        guildId,
        activeChannelId: null,
        leaderboardChannelId: null,
        monthlyStatsEnabled: false,
      };
    }
    res.json({ success: true, config });
  } catch (error) {
    clog(console.error, '[apps/web/routes/config.js] Error fetching guild config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/guild-config
 * Updates guild configuration. Body: { guildId, leaderboardChannelId?, monthlyStatsEnabled? }
 */
router.post('/api/guild-config', async (req, res) => {
  try {
    const { guildId, leaderboardChannelId, monthlyStatsEnabled } = req.body;
    if (!guildId) {
      return res.status(400).json({ error: 'Missing guildId' });
    }
    const data = {};
    if (leaderboardChannelId !== undefined)
      data.leaderboardChannelId = leaderboardChannelId || null;
    if (monthlyStatsEnabled !== undefined) data.monthlyStatsEnabled = monthlyStatsEnabled;

    const config = await db.guildConfig.upsert({
      where: { guildId },
      update: data,
      create: {
        guildId,
        activeChannelId: '',
        ...data,
      },
    });
    res.json({ success: true, config });
  } catch (error) {
    clog(console.error, '[apps/web/routes/config.js] Error updating guild config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
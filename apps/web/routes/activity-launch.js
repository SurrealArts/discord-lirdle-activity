import express from 'express';
import { clog } from '@lirdle/logger';
import { isDocker, botPort } from '../../../config.js';

const router = express.Router();

const BOT_URL = `http://${isDocker ? 'bot' : 'localhost'}:${botPort}`;

router.post('/api/activity-launch', async (req, res) => {
  try {
    const response = await fetch(`${BOT_URL}/api/activity-launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    if (clog) clog(console.error, '[apps/web/routes/activity-launch.js] Error:', err);
    res.status(500).json({ error: 'Failed to reach bot server' });
  }
});

export default router;
import express from 'express';
import { clog } from '@lirdle/logger';

const router = express.Router();

// These will be set by the main app
let CLIENT_ID;
let CLIENT_SECRET;

/**
 * Set dependencies for this route
 * @param {Object} deps - Dependencies object
 */
router.setDependencies = function (deps) {
  CLIENT_ID = deps.CLIENT_ID;
  CLIENT_SECRET = deps.CLIENT_SECRET;
};

/**
 * POST /api/token
 * Exchange authorization code for access token
 */
router.post('/api/token', async (req, res) => {
  try {
    const response = await fetch(`https://discord.com/api/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: req.body.code,
      }),
    });

    const data = await response.json();
    res.send(data);
  } catch (error) {
    clog(console.error, '[apps/web/routes/auth.js] Error fetching token:', error);
    res.status(500).send('Error fetching token');
  }
});

export default router;

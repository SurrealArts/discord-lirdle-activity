import express from 'express';
import { clog } from '@lirdle/logger';

const router = express.Router();

/**
 * GET /usage/:endpoint
 * Log usage events
 */
router.get('/usage/:endpoint', (req, res) => {
  const endpoint = req.params.endpoint;
  const query = req.query;
  clog(console.log, `[apps/web/routes/usage.js] Usage event: ${endpoint}`, query);
  res.json({ success: true, endpoint, query });
});

export default router;

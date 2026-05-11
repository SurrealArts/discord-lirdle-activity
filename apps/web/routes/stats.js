import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests, please try again later.',
});

// These will be set by the main app
let __dirname;

/**
 * Set dependencies for this route
 * @param {Object} deps - Dependencies object
 */
router.setDependencies = function (deps) {
  __dirname = deps.__dirname;
};

/**
 * GET /stats/:fileName
 * Serve stats files
 */
router.get('/stats/:fileName', limiter, async (req, res) => {
  const fileName = req.params.fileName;
  if (!/^day\d{4}\.json$/.test(fileName)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const filePath = path.join(__dirname, 'public', 'stats', fileName);
  try {
    await fs.access(filePath);
    return res.sendFile(filePath);
  } catch {
    return res.json({ started: 0, finished: 0, finishedDetails: { average: 0 } });
  }
});

export default router;

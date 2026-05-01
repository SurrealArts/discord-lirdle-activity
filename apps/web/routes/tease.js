import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';

const router = express.Router();

// These will be set by the main app
let __dirname;

/**
 * Set dependencies for this route
 * @param {Object} deps - Dependencies object
 */
router.setDependencies = function(deps) {
  __dirname = deps.__dirname;
};

/**
 * GET /tease/:fileName
 * Serve tease files
 */
router.get('/tease/:fileName', async (req, res) => {
  const fileName = req.params.fileName;
  if (!/^t\d{3}\.txt$/.test(fileName)) {
    return res.status(400).send('Invalid request');
  }
  const filePath = path.join(__dirname, 'public', 'tease', fileName);
  try {
    await fs.access(filePath);
    return res.sendFile(filePath);
  } catch {
    return res.status(200).type('text/plain').send('');
  }
});

export default router;
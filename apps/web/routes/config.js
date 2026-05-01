import express from 'express';

const router = express.Router();

// These will be set by the main app
let CLIENT_ID;

/**
 * Set dependencies for this route
 * @param {Object} deps - Dependencies object
 */
router.setDependencies = function(deps) {
  CLIENT_ID = deps.CLIENT_ID;
};

/**
 * GET /api/config
 * Returns client configuration
 */
router.get('/api/config', (req, res) => {
  res.json({ clientId: CLIENT_ID });
});

export default router;
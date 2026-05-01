import express from 'express';
import cors from 'cors';
import dotenvFlow from 'dotenv-flow';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { clog } from '@lirdle/logger';

// Import route modules
import authRoutes from './routes/auth.js';
import guessRoutes from './routes/guess.js';
import sessionRoutes from './routes/session.js';
import configRoutes from './routes/config.js';
import leaderboardRoutes from './routes/leaderboard.js';
import teaseRoutes from './routes/tease.js';
import statsRoutes from './routes/stats.js';
import usageRoutes from './routes/usage.js';

dotenvFlow.config({ path: '../../' });

const { db } = await import('@lirdle/db');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID.trim();
const CLIENT_SECRET = process.env.CLIENT_SECRET;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

// Set up route dependencies
authRoutes.setDependencies({ CLIENT_ID, CLIENT_SECRET });
guessRoutes.setDependencies({ db, crypto, CLIENT_SECRET });
sessionRoutes.setDependencies({ db, crypto });
configRoutes.setDependencies({ CLIENT_ID });
// leaderboardRoutes doesn't need additional setup as it uses imported modules directly
teaseRoutes.setDependencies({ __dirname });
statsRoutes.setDependencies({ __dirname });
// usageRoutes doesn't need additional setup

// API routes
app.use('/', authRoutes);
app.use('/', guessRoutes);
app.use('/', sessionRoutes);
app.use('/', configRoutes);
app.use('/', leaderboardRoutes);
app.use('/', usageRoutes);
app.use('/', teaseRoutes);
app.use('/', statsRoutes);
app.use('/', usageRoutes);

app.listen(PORT, () => {
  clog(
    console.log,
    `[apps/web/index.js] Lirdle frontend & API running at http://localhost:${PORT}`,
  );
});

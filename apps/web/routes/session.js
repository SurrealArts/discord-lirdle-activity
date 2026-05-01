import express from 'express';
import { clog } from '@lirdle/logger';

const router = express.Router();

// These will be set by the main app
let db;
let crypto;

/**
 * Set dependencies for this route
 * @param {Object} deps - Dependencies object
 */
router.setDependencies = function(deps) {
  db = deps.db;
  crypto = deps.crypto;
};

/**
 * POST /api/save-session
 * Save user's game session
 */
router.post('/api/save-session', async (req, res) => {
  try {
    const { userId, date, guesses, won, guildId, channelId } = req.body || {};

    if (!userId || !date || !guesses) {
      return res.status(400).json({
        error: 'Missing required fields',
        body: req.body,
      });
    }

    // Compute tries count from the guesses state
    let tries = 0;
    try {
      const parsed = typeof guesses === 'string' ? JSON.parse(guesses) : guesses;
      if (Array.isArray(parsed?.guessWords)) tries = parsed.guessWords.length;
    } catch {
      /* ignore */
    }

    const guessesString = JSON.stringify(guesses);

    await db.dailyWord.upsert({
      where: { date: date },
      update: {},
      create: {
        date: date,
        word: 'SECRET_PRNG',
      },
    });

    const existingSession = await db.session.findUnique({
      where: { userId_date: { userId, date } },
    });
    const isFirstWin = won && (!existingSession || !existingSession.won);

    const allUserSessions = await db.session.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true, won: true },
    });
    allUserSessions.unshift({ date, won });

    let currentStreak = 0;
    let maxStreak = 0;
    let run = 0;
    for (const s of allUserSessions) {
      if (s.won) {
        run++;
        if (run > maxStreak) maxStreak = run;
      } else {
        run = 0;
      }
    }
    currentStreak = 0;
    for (const s of allUserSessions) {
      if (s.won) currentStreak++;
      else break;
    }

    await db.user.upsert({
      where: { id: userId },
      update: {
        gamesPlayed: isFirstWin ? { increment: 1 } : undefined,
        wins: isFirstWin ? { increment: 1 } : undefined,
        currentStreak,
        maxStreak,
      },
      create: {
        id: userId,
        gamesPlayed: won ? 1 : 0,
        wins: won ? 1 : 0,
        currentStreak: currentStreak || (won ? 1 : 0),
        maxStreak: maxStreak || (won ? 1 : 0),
        seed: crypto.randomUUID(),
      },
    });

    const session = await db.session.upsert({
      where: {
        userId_date: { userId, date },
      },
      update: {
        guesses: guessesString,
        won: won,
        tries,
        guildId: guildId || null,
        completedAt: new Date(),
      },
      create: {
        userId,
        date,
        tries,
        guildId: guildId || null,
        guesses: guessesString,
        won: won,
      },
    });

    if (guildId) {
      await db.userGuild.upsert({
        where: { userId_guildId: { userId, guildId } },
        create: { userId, guildId },
        update: {},
      });
    }

    if (guildId && channelId) {
      await db.guildConfig.upsert({
        where: { guildId },
        create: { guildId, activeChannelId: channelId },
        update: {},
      });
    }

    clog(console.log, `[apps/web/routes/session.js] Saved session for User ${userId} on ${date}`);
    res.json({ success: true, session });
  } catch (error) {
    clog(console.error, '[apps/web/routes/session.js] Error saving session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/load-session
 * Load user's game session
 */
router.get('/api/load-session', async (req, res) => {
  try {
    const { userId, date } = req.query;

    if (!userId || !date) {
      return res.status(400).json({ error: 'Missing userId or date' });
    }

    let user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      user = { id: userId, currentStreak: 0, maxStreak: 0, gamesPlayed: 0, wins: 0 };
    }

    const session = await db.session.findUnique({
      where: {
        userId_date: { userId, date },
      },
    });

    res.json({
      success: true,
      user: user,
      session: session || null,
    });
  } catch (error) {
    clog(console.error, '[apps/web/routes/session.js] Error loading session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
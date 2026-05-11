import express from 'express';
import { clog } from '@lirdle/logger';
import { getUniqueWordForUser, evaluateTrueScore, xmur3, mulberry32 } from '../utils/prng.js';
import { lie, getDateNumber } from '../public/numbers.js';

const router = express.Router();

// These will be set by the main app
let db;
let crypto;
let CLIENT_SECRET;
let ENCRYPTION_KEY;

/**
 * Set dependencies for this route
 * @param {Object} deps - Dependencies object
 */
router.setDependencies = function (deps) {
  db = deps.db;
  crypto = deps.crypto;
  CLIENT_SECRET = deps.CLIENT_SECRET;

  // Initialize encryption key after crypto is available
  ENCRYPTION_KEY = crypto.createHash('sha256').update(CLIENT_SECRET).digest('base64').substr(0, 32);
};
const IV_LENGTH = 16;

/**
 * POST /api/guess
 * Process a word guess and return game state
 */
router.post('/api/guess', async (req, res) => {
  try {
    const { userId, guessString, lettersByPosition, changes, encryptedChanges, solverData } =
      req.body;

    let user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await db.user.create({
        data: {
          id: userId,
          gamesPlayed: 0,
          seed: crypto.randomUUID(),
        },
      });
    }

    const targetWord = getUniqueWordForUser(user.seed, getDateNumber());
    const trueScores = evaluateTrueScore(targetWord, guessString);
    const guessedIt = guessString === targetWord;

    // Resolve the accumulated changes array from the client-sent encrypted state.
    // decryptState returns null on failure — never []. This distinction matters:
    // silently falling back to [] would reset the lie history mid-game, causing
    // the lie markers shown on win to be indexed to the wrong rows (off-by-one).
    // On failure we fall back to the last session saved in the DB, which always
    // includes the encryptedChanges as part of the guesses blob. If both fail
    // we return 500 so the client surfaces the error rather than silently
    // continuing with a corrupted state.
    let parsedChanges = null;
    if (encryptedChanges) {
      parsedChanges = decryptState(encryptedChanges);
    } else if (typeof changes === 'string') {
      parsedChanges = decryptState(changes);
    } else if (Array.isArray(changes)) {
      parsedChanges = changes;
    }

    if (parsedChanges === null) {
      const today = new Date().toISOString().split('T')[0];
      const storedSession = await db.session.findUnique({
        where: { userId_date: { userId, date: today } },
      });
      if (storedSession?.guesses) {
        try {
          const storedState = JSON.parse(storedSession.guesses);
          if (storedState?.encryptedChanges) {
            parsedChanges = decryptState(storedState.encryptedChanges);
          }
        } catch {
          // Stored guesses blob is malformed — fall through to error below
        }
      }
    }

    if (parsedChanges === null) {
      clog(
        console.error,
        '[apps/web/routes/guess.js] Could not recover changes state for user ${userId} — returning error',
      );
      return res.status(500).json({ error: 'Could not recover game state. Please reload.' });
    }
    let finalScores = [...trueScores];
    let newChanges = [...parsedChanges];

    if (!guessedIt) {
      const lieSeedString = `${user.seed}-${user.gamesPlayed}-turn${parsedChanges.length}`;
      const deterministicRand = mulberry32(xmur3(lieSeedString)());
      lie(guessString, finalScores, lettersByPosition, newChanges, solverData, deterministicRand);
    }

    let outgoingChanges;
    if (guessedIt) {
      outgoingChanges = newChanges;
    } else {
      outgoingChanges = encryptState(newChanges);
    }

    res.json({
      guessedIt: guessedIt,
      scores: finalScores,
      changes: outgoingChanges,
      encryptedChanges: guessedIt ? null : encryptState(newChanges),
    });
  } catch (error) {
    clog(console.error, '[apps/web/routes/guess.js] Error processing guess:', error);
    res.status(500).json({ error: 'Server error processing guess' });
  }
});

// Helper functions
function encryptState(data) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(JSON.stringify(data));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptState(text) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
  } catch (error) {
    clog(console.error, '[apps/web/routes/guess.js] Error decrypting state:', error);
    return null;
  }
}

export default router;

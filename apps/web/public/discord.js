import { DiscordSDK } from './vendor/discord-sdk.js';

let discordSdk;
let discordUser = null;

/**
 * Authenticate with Discord SDK, with retry logic and cached token support.
 * First tries a cached access token from localStorage. If that fails,
 * initiates the OAuth authorization flow and exchanges the code for a
 * token via the backend /api/token endpoint. Retries up to maxRetries
 * times on failure.
 * @param {string} clientId - Discord application client ID
 * @param {number} [maxRetries=3] - Maximum authentication attempts
 * @returns {Promise<Object>} Authentication result with user info
 */
async function authenticateWithRetry(clientId, maxRetries = 3) {
  let cachedToken = null;
  try {
    cachedToken = localStorage.getItem('discord_access_token');
  } catch {
    // Browser blocked storage, proceed to normal auth
  }

  if (cachedToken) {
    try {
      const authResult = await discordSdk.commands.authenticate({ access_token: cachedToken });
      return authResult;
    } catch {
      console.warn('Cached token was expired or invalid. Fetching a fresh code.');
      try {
        localStorage.removeItem('discord_access_token');
      } catch {
        // Browser blocked storage, ignore
      }
    }
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      const { code } = await discordSdk.commands.authorize({
        client_id: clientId,
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: ['identify', 'guilds'],
      });

      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      if (!data.access_token) {
        throw new Error(`Backend token exchange failed. Discord API said: ${JSON.stringify(data)}`);
      }

      try {
        localStorage.setItem('discord_access_token', data.access_token);
      } catch {
        // Browser blocked storage, ignore
      }

      return await discordSdk.commands.authenticate({ access_token: data.access_token });
    } catch (err) {
      console.warn(`Discord SDK Auth attempt ${i + 1} stumbled:`, err);
      if (i === maxRetries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

/**
 * Initialize the Discord SDK, authenticate the user, and restore
 * cloud-saved game state from the backend. Called on page load.
 * Falls back to local state if cloud sync fails.
 */
async function setupDiscord() {
  try {
    const configRes = await fetch('/api/config');
    const { clientId } = await configRes.json();

    discordSdk = new DiscordSDK(clientId);
    await discordSdk.ready();

    await new Promise((resolve) => setTimeout(resolve, 200));

    const authResult = await authenticateWithRetry(clientId);
    discordUser = authResult.user;

    window.DISCORD_USER_ID = discordUser.id;

    if (discordSdk.channelId && discordSdk.guildId) {
      try {
        await fetch('/api/activity-launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guildId: discordSdk.guildId,
            channelId: discordSdk.channelId,
          }),
        });
      } catch {
        // Ignore errors - bot may not be running
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const syncRes = await fetch(`/api/load-session?userId=${discordUser.id}&date=${today}`);

    if (syncRes.ok) {
      const syncData = await syncRes.json();
      window.LIRDLE_CLOUD_SAVE = syncData.session;

      if (!syncData.session) {
        try {
          localStorage.removeItem('saveableState');
          console.log('DB is empty for today. Local board wiped.');
        } catch {
          // Ignore browser security blocks
        }
      } else {
        try {
          if (syncData.session && syncData.session.guesses) {
            const guessesStr =
              typeof syncData.session.guesses === 'string'
                ? syncData.session.guesses
                : JSON.stringify(syncData.session.guesses);
            localStorage.setItem('saveableState', guessesStr);
          }
          if (syncData.session && syncData.session.stats) {
            const statsStr =
              typeof syncData.session.stats === 'string'
                ? syncData.session.stats
                : JSON.stringify(syncData.session.stats);
            localStorage.setItem('stats', statsStr);
          }
        } catch {
          console.warn('Browser blocked localStorage, relying purely on Memory Bypass.');
        }
      }
    }
  } catch (err) {
    console.error('Cloud sync failed. Proceeding with local state.', err);
  } finally {
    if (window.startLirdle) window.startLirdle();

    setupMyStatsPanel();
  }
}

/**
 * Save the current game session to the cloud backend.
 * Stores guesses, stats, and outcome for cross-device sync.
 * Called by the game model when the player completes a game
 * or makes progress.
 * @param {string} targetWord - The daily target word
 * @param {Object} fullStateObject - Full game state (guesses, scores, etc.)
 * @param {Object} statsObject - Player stats
 * @param {boolean} won - Whether the player won
 */
window.saveLirdleSession = async function (targetWord, fullStateObject, statsObject, won) {
  if (!discordUser) return;
  const payload = {
    userId: discordUser.id,
    guildId: discordSdk.guildId || null,
    channelId: discordSdk.channelId || null,
    date: new Date().toISOString().split('T')[0],
    targetWord: targetWord,
    guesses: fullStateObject,
    won: won,
    stats: statsObject,
  };
  try {
    await fetch('/api/save-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Failed to save to cloud', err);
  }
};

async function fetchUserStats(userId, sortBy = 'date', order = 'desc') {
  try {
    const res = await fetch(
      `/api/user/history?userId=${userId}&sortBy=${sortBy}&order=${order}&limit=50`,
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch user stats:', err);
    return null;
  }
}

function renderStatsSummary(data) {
  const body = document.getElementById('myStatsBody');
  if (!body) return;

  if (!data || !data.stats) {
    body.innerHTML = '<div class="my-stats-loading">Could not load stats.</div>';
    return;
  }

  const s = data.stats;
  body.innerHTML = [
    '<div class="stat-grid">',
    '<span class="stat-label">Games Played</span>',
    `<span class="stat-value">${s.gamesPlayed}</span>`,
    '<span class="stat-label">Games Won</span>',
    `<span class="stat-value">${s.wins} (${s.gamesPlayed > 0 ? Math.round((s.wins / s.gamesPlayed) * 100) : 0}%)</span>`,
    '<span class="stat-label">Forgot to Finish</span>',
    `<span class="stat-value">${s.gamesForgot}</span>`,
    '<span class="stat-label">Avg Tries (won)</span>',
    `<span class="stat-value">${s.avgTries ? s.avgTries.toFixed(2) : '-'}</span>`,
    '<span class="stat-label">Fewest Tries</span>',
    `<span class="stat-value">${s.fewestTries || '-'}</span>`,
    '<span class="stat-label">Most Tries</span>',
    `<span class="stat-value">${s.mostTries || '-'}</span>`,
    '<span class="stat-label">Avg Tries (quit)</span>',
    `<span class="stat-value">${s.avgTriesBeforeStop ? s.avgTriesBeforeStop.toFixed(2) : '-'}</span>`,
    '<span class="stat-label">Current Streak</span>',
    `<span class="stat-value">${s.currentStreak}</span>`,
    '<span class="stat-label">Best Streak</span>',
    `<span class="stat-value">${s.maxStreak}</span>`,
    '</div>',
  ].join('\n');
}

function renderStatsHistory(data) {
  const list = document.getElementById('myStatsList');
  if (!list) return;

  if (!data || !data.sessions || data.sessions.length === 0) {
    list.innerHTML = '<div class="my-stats-loading">No games found.</div>';
    return;
  }

  list.innerHTML = data.sessions
    .map((s) => {
      const wonClass = s.won ? 'won' : 'lost';
      const resultText = s.won
        ? `&#x2705; Won in ${s.tries}`
        : `&#x274C; Unfinished (${s.tries} tries)`;
      return `<div class="history-entry">
        <span class="entry-date">${s.date}</span>
        <span class="entry-result ${wonClass}">${resultText}</span>
      </div>`;
    })
    .join('');
}

async function refreshMyStats() {
  if (!window.DISCORD_USER_ID) return;
  const sortSelect = document.getElementById('myStatsSort');
  const sortBy = sortSelect ? sortSelect.value : 'date';
  const data = await fetchUserStats(window.DISCORD_USER_ID, sortBy);
  renderStatsSummary(data);
  renderStatsHistory(data);
}

function setupMyStatsPanel() {
  const toggleBtn = document.getElementById('myStatsToggle');
  const panel = document.getElementById('myStatsPanel');
  const closeBtn = document.getElementById('closeMyStats');
  const sortSelect = document.getElementById('myStatsSort');
  const refreshBtn = document.getElementById('myStatsRefresh');

  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener('click', async () => {
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
      panel.classList.remove('hidden');
      panel.classList.add('show');
      await refreshMyStats();
    } else {
      panel.classList.remove('show');
      panel.classList.add('hidden');
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      panel.classList.remove('show');
      panel.classList.add('hidden');
    });
  }

  const backdrop = document.getElementById('myStatsBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      panel.classList.remove('show');
      panel.classList.add('hidden');
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', refreshMyStats);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshMyStats);
  }
}

setupDiscord();

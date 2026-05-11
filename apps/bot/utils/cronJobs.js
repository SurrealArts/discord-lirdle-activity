import cron from 'node-cron';
import { AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { clog } from '@lirdle/logger';
import { generateGridDashboard } from './imageGenerator.js';

async function resolveLeaderboardChannel(guild, config) {
  const channelId = config.leaderboardChannelId || config.activeChannelId;
  if (!channelId) return null;
  try {
    return await guild.channels.fetch(channelId);
  } catch {
    return null;
  }
}

function buildLeaderboardText(entries, usernameMap) {
  const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];
  const lines = [];
  const topShown = Math.min(entries.length, 20);

  for (let i = 0; i < topShown; i++) {
    const e = entries[i];
    const username = usernameMap.get(e.userId) || e.userId.slice(0, 8);
    const medal = i < 3 ? MEDAL_EMOJIS[i] : `${i + 1}.`;

    if (e.wins > 0) {
      const avgTries = Number.isInteger(e.avgTries) ? e.avgTries : e.avgTries.toFixed(1);
      const winRate = e.gamesPlayed > 0 ? Math.round((e.wins / e.gamesPlayed) * 100) : 0;
      lines.push(
        `${medal} **${username}** — ${e.wins} win${e.wins !== 1 ? 's' : ''} · avg ${avgTries} tries · ${winRate}% win rate`,
      );
    } else {
      const bestTries = e.bestTries > 0 ? `${e.bestTries} tries` : '-';
      lines.push(
        `${medal} **${username}** — ${e.gamesPlayed} game${e.gamesPlayed !== 1 ? 's' : ''} · best ${bestTries}`,
      );
    }
  }

  return lines.join('\n');
}

function createPlayNowRow() {
  const button = new ButtonBuilder()
    .setCustomId('play_now')
    .setLabel('Play Now!')
    .setStyle(ButtonStyle.Primary);
  return new ActionRowBuilder().addComponents(button);
}

export async function runDailyLeaderboard(client, targetDateOverride = null) {
  clog(console.log, '[apps/bot/utils/cronJobs.js] Running Daily Leaderboard...');

  const { db } = await import('@lirdle/db');
  const targetDate =
    targetDateOverride || new Date(Date.now() - 3600000).toISOString().split('T')[0];

  const configs = await db.guildConfig.findMany();

  for (const config of configs) {
    try {
      const guild = await client.guilds.fetch(config.guildId).catch(() => null);
      if (!guild) continue;

      const channel = await resolveLeaderboardChannel(guild, config);
      if (!channel) continue;

      const userIds = (
        await db.userGuild.findMany({
          where: { guildId: config.guildId },
          select: { userId: true },
        })
      ).map((r) => r.userId);

      if (userIds.length === 0) continue;

      const sessions = await db.session.findMany({
        where: { date: targetDate, userId: { in: userIds } },
        include: { dailyWord: true },
      });

      if (sessions.length === 0) continue;

      let memberMap = new Map();
      try {
        const playerIds = sessions.map((s) => s.userId);
        const members = await guild.members.fetch({ user: playerIds });
        for (const [id, member] of members) {
          memberMap.set(id, {
            username: member.user.username,
            avatarUrl: member.user.displayAvatarURL(),
            mention: `<@${id}>`,
          });
        }
      } catch {
        /* fallback: show userId */
      }

      const players = sessions.map((session) => {
        const memberData = memberMap.get(session.userId);
        const username = memberData?.username || 'Unknown';
        const avatarUrl = memberData?.avatarUrl || null;
        const mention = memberData?.mention || session.userId;
        const state = JSON.parse(session.guesses || '{}');
        const guessArray = Array.isArray(state.guessWords) ? state.guessWords : [];
        return {
          username,
          avatarUrl,
          mention,
          guessWords: guessArray,
          perceivedScores: Array.isArray(state.scores) ? state.scores : [],
          won: session.won,
          isFinished: session.won === true,
          tries: guessArray.length,
        };
      });

      players.sort((a, b) => {
        if (a.won && !b.won) return -1;
        if (!a.won && b.won) return 1;
        if (a.won && b.won) return a.tries - b.tries;
        return b.tries - a.tries;
      });

      const lines = [];
      const topShown = Math.min(players.length, 20);
      const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

      for (let i = 0; i < topShown; i++) {
        const p = players[i];
        const medal = i < 3 ? MEDAL_EMOJIS[i] : `${i + 1}.`;
        const name = config.leaderboardPing ? p.mention : `**${p.username}**`;
        if (p.won) {
          lines.push(`${medal} ${name} — ${p.tries} tries ✅`);
        } else {
          lines.push(`${medal} ${name} — ${p.tries} tries (unfinished)`);
        }
      }

      if (players.length > 20) {
        lines.push(`\n*...and ${players.length - 20} more players*`);
      }

      const title = `📊 Lirdle Daily Leaderboard — ${targetDate}`;
      const content = `**${title}**\n\n${lines.join('\n')}`;

      const imageBuffer = await generateGridDashboard(players, `Daily Leaderboard — ${targetDate}`);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'daily-leaderboard.png' });

      await channel.send({ content, files: [attachment], components: [createPlayNowRow()] });
    } catch (err) {
      clog(
        console.error,
        `[apps/bot/utils/cronJobs.js] Error processing guild ${config.guildId}:`,
        err,
      );
    }
  }
}

export async function runMonthlyLeaderboard(client, yearMonthOverride = null) {
  clog(console.log, '[apps/bot/utils/cronJobs.js] Running Monthly Leaderboard...');

  const { db } = await import('@lirdle/db');
  const { getLeaderboard } = await import('@lirdle/db/leaderboard.js');

  let yearMonth;
  if (yearMonthOverride) {
    yearMonth = yearMonthOverride;
  } else {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = String(prevMonth.getMonth() + 1).padStart(2, '0');
    yearMonth = `${year}-${month}`;
  }

  const configs = await db.guildConfig.findMany({
    where: { monthlyStatsEnabled: true },
  });

  for (const config of configs) {
    try {
      const guild = await client.guilds.fetch(config.guildId).catch(() => null);
      if (!guild) continue;

      const channel = await resolveLeaderboardChannel(guild, config);
      if (!channel) continue;

      const entries = await getLeaderboard(config.guildId, 'monthly', `${yearMonth}-01`);
      if (entries.length === 0) continue;

      const usernameMap = new Map();
      try {
        const members = await guild.members.fetch({ user: entries.map((e) => e.userId) });
        for (const [id, m] of members) usernameMap.set(id, m.user.username);
      } catch {
        /* fallback */
      }
      const leaderboardText = buildLeaderboardText(entries, usernameMap);

      const [year, month] = yearMonth.split('-');
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];

      const title = `📊 Lirdle Monthly Leaderboard — ${monthNames[parseInt(month, 10) - 1]} ${year}`;
      const content = `**${title}**\n\n${leaderboardText}\n\n*${entries.length} player${entries.length !== 1 ? 's' : ''} • Monthly stats*`;

      await channel.send({ content, components: [createPlayNowRow()] });
    } catch (err) {
      clog(
        console.error,
        `[apps/bot/utils/cronJobs.js] Error posting monthly for guild ${config.guildId}:`,
        err,
      );
    }
  }
}

export const startCronJobs = (client) => {
  cron.schedule(
    '0 0 * * *',
    async () => {
      await runDailyLeaderboard(client);
    },
    { timezone: 'UTC' },
  );

  cron.schedule(
    '5 0 1 * *',
    async () => {
      await runMonthlyLeaderboard(client);
    },
    { timezone: 'UTC' },
  );
};

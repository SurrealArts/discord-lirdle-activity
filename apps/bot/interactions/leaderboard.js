import { clog } from '@lirdle/logger';
import { getLeaderboard } from '@lirdle/db/leaderboard.js';
import { db } from '@lirdle/db';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

export const run = async (client, interaction) => {
  try {
    await interaction.deferReply();

    const period = interaction.options.getString('period') || 'daily';
    const guildId = interaction.guildId;

    if (!guildId) {
      return await interaction.editReply({ content: 'This command can only be used in a server.' });
    }

    const config = await db.guildConfig.findUnique({ where: { guildId } });
    const leaderboardPing = config?.leaderboardPing || false;

    const entries = await getLeaderboard(guildId, period);

    if (entries.length === 0) {
      const periodLabel = period === 'daily' ? 'Daily' : period === 'monthly' ? 'Monthly' : 'All-Time';
      return await interaction.editReply({ content: `📊 Lirdle ${periodLabel} Leaderboard\n\nNo games played yet for this period!\nUse /lirdle to start playing` });
    }

    const memberMap = new Map();
    try {
      const members = await interaction.guild.members.fetch({ user: entries.map((e) => e.userId) });
      for (const [id, member] of members) {
        memberMap.set(id, {
          username: member.user.username,
          mention: `<@${id}>`,
        });
      }
    } catch {
      /* fallback: show userId */
    }

    const lines = [];
    const topShown = Math.min(entries.length, 20);

    for (let i = 0; i < topShown; i++) {
      const e = entries[i];
      const memberData = memberMap.get(e.userId);
      const username = memberData?.username || e.userId.slice(0, 8);
      const mention = memberData?.mention || e.userId;
      const name = leaderboardPing ? mention : `**${username}**`;
      const medal = i < 3 ? MEDAL_EMOJIS[i] : `${i + 1}.`;

      if (e.wins > 0) {
        const avgTries = Number.isInteger(e.avgTries) ? e.avgTries : e.avgTries.toFixed(1);
        if (period === 'daily') {
          lines.push(`${medal} ${name} — ${avgTries} tries ✅`);
        } else {
          const winRate = e.gamesPlayed > 0 ? Math.round((e.wins / e.gamesPlayed) * 100) : 0;
          lines.push(`${medal} ${name} — ${e.wins} win${e.wins !== 1 ? 's' : ''} · avg ${avgTries} tries · ${winRate}% win rate`);
        }
      } else {
        if (period === 'daily') {
          const tries = e.avgTriesBeforeStop > 0 ? Math.round(e.avgTriesBeforeStop) : '-';
          lines.push(`${medal} ${name} — ${tries} tries (unfinished)`);
        } else {
          const bestTries = e.bestTries > 0 ? `${e.bestTries} tries` : '-';
          lines.push(`${medal} ${name} — ${e.gamesPlayed} game${e.gamesPlayed !== 1 ? 's' : ''} · best ${bestTries}`);
        }
      }
    }

    if (entries.length > 20) {
      lines.push(`\n*...and ${entries.length - 20} more players*`);
    }

    let title;
    if (period === 'daily') {
      title = `📊 Lirdle Daily Leaderboard — ${new Date().toISOString().split('T')[0]}`;
    } else if (period === 'monthly') {
      const now = new Date();
      const monthName = now.toLocaleString('default', { month: 'long' });
      const year = now.getFullYear();
      title = `📊 Lirdle Monthly Leaderboard — ${monthName} ${year}`;
    } else {
      title = `📊 Lirdle All-Time Leaderboard`;
    }

    const content = `**${title}**\n\n${lines.join('\n')}`;

    const playButton = new ButtonBuilder()
      .setCustomId('play_now')
      .setLabel('Play Now!')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(playButton);

    await interaction.editReply({ content, components: [row] });
  } catch (error) {
    clog(console.error, '[apps/bot/interactions/leaderboard.js] Error:', error);
    await interaction.editReply({ content: 'Failed to fetch leaderboard.' });
  }
};
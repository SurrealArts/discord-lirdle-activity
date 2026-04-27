import { InteractionResponseType, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { clog } from '@lirdle/logger';
import { generateGridDashboard, type Player } from '../utils/imageGenerator.js';

const activeDashboards = new Map();

/** @returns {string} Today's date in YYYY-MM-DD format */
const getTodayDate = () => new Date().toISOString().split('T')[0];

/**
 * Handle the /lirdle command. Responds with a LAUNCH_ACTIVITY callback to open
 * the Discord Activity, then sets up a live spectator dashboard that polls the
 * database every 10 seconds for active players and renders their progress as a
 * grid image. The dashboard auto-sleeps after 15 minutes of inactivity.
 * @param {import('discord.js').Client} client - Discord client instance
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - The /lirdle interaction
 */
export const run = async (client, interaction) => {
  try {
    await client.rest.post(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      body: { type: InteractionResponseType.LaunchActivity },
    });
    clog(
      console.log,
      `[apps/bot/interactions/lirdle.js] User ${interaction.user.id} launched lirdle activity`,
    );

    if (!interaction.guild || !interaction.channel) return;
    const channelId = interaction.channelId;
    const guildId = interaction.guildId;

    if (activeDashboards.has(channelId)) {
      clearInterval(activeDashboards.get(channelId));
      activeDashboards.delete(channelId);
    }

    const { db } = await import('@lirdle/db');
    const guildMembers = await interaction.guild.members.fetch();
    await db.guildConfig.upsert({
      where: { guildId: guildId },
      update: { activeChannelId: channelId },
      create: { guildId: guildId, activeChannelId: channelId },
    });

    const embed = new EmbedBuilder()
      .setColor('#ef4444')
      .setTitle('🔴 Lirdle Live Spectator')
      .setDescription('Loading live data...')
      .setFooter({ text: 'Updates automatically • Shows all players today' });

    const dashboardMessage = await interaction.channel.send({ embeds: [embed] });

    let lastHash = '';

    const pollInterval = setInterval(async () => {
      try {
        const today = getTodayDate();

        const activeSessions = await db.session.findMany({
          where: {
            date: today,
            userId: { in: Array.from(guildMembers.keys()) },
          },
          include: { dailyWord: true },
        });

        const currentHash = activeSessions.map((s) => s.updatedAt.getTime()).join('-');

        if (currentHash === lastHash) {
          return;
        }
        lastHash = currentHash;

        const activePlayers: Player[] = activeSessions.map((session) => {
          const member = guildMembers.get(session.userId);
          const state = JSON.parse(session.guesses || '{}');
          const guessArray = Array.isArray(state.guessWords) ? state.guessWords : [];
          return {
            username: member ? member.user.username : 'Unknown',
            avatarUrl: member
              ? member.user.displayAvatarURL({ extension: 'png', size: 128 })
              : null,
            guessWords: guessArray,
            perceivedScores: Array.isArray(state.scores) ? state.scores : [],
            changes: Array.isArray(state.changes) ? state.changes : [],
            won: session.won,
            isFinished: session.won === true,
            tries: guessArray.length,
          };
        });

        const imageBuffer = await generateGridDashboard(
          activePlayers,
          undefined,
          'LIVE LIRDLE SPECTATOR',
        );
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'lirdle-live.png' });

        const liveEmbed = new EmbedBuilder()
          .setColor('#ef4444')
          .setImage('attachment://lirdle-live.png')
          .setFooter({ text: '🔴 LIVE • Updates automatically' });

        await dashboardMessage.edit({ embeds: [liveEmbed], files: [attachment] });
      } catch (err) {
        clog(console.error, '[apps/bot/interactions/lirdle.js][Poll Loop Error]', err);
      }
    }, 10000);

    activeDashboards.set(channelId, pollInterval);
  } catch (error) {
    clog(console.error, '[apps/bot/interactions/lirdle.js] Error:', error);
  }
};

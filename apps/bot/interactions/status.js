import {
  ActionRowBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { clog } from '@lirdle/logger';
import { generateLirdleImage } from '../utils/imageGenerator.js';

/** @returns {string} Today's date in YYYY-MM-DD format */
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Handle the /status command. Fetches the user's game progress for today and
 * replies with an ephemeral embed showing their current status, guess count,
 * and overall stats.
 * @param {import('discord.js').Client} client - Discord client instance
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - The /status interaction
 */
export const run = async (client, interaction) => {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    const today = getTodayDate();
    const { db } = await import('@lirdle/db');

    const user = await db.user.findUnique({ where: { id: userId } });
    const session = await db.session.findUnique({
      where: { userId_date: { userId, date: today } },
      include: { dailyWord: true },
    });

    if (!session || !user) {
      const embed = new EmbedBuilder()
        .setColor('#6b7280')
        .setTitle('No Game Found')
        .setDescription("You haven't started Lirdle today yet!")
        .setFooter({ text: 'Use /lirdle to start playing' });
      return await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const state = JSON.parse(session.guesses || '{}');
    const guessWords = Array.isArray(state.guessWords) ? state.guessWords : [];
    const perceivedScores = Array.isArray(state.scores) ? state.scores : [];
    const changes = Array.isArray(state.changes) ? state.changes : [];
    const isFinished = session.won === true;

    const imageBuffer = await generateLirdleImage(
      guessWords,
      perceivedScores,
      changes,
      isFinished,
      true,
    );
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'lirdle-status.png' });

    const statusText = isFinished ? '✅ Won!' : '⏳ In Progress';
    const color = isFinished ? '#22c55e' : '#3b82f6';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎮 Your Lirdle Progress Today')
      .setDescription(`Status: **${statusText}**`)
      .addFields(
        { name: 'Total Guesses', value: `${guessWords.length}`, inline: true },
        {
          name: 'Overall Stats',
          value: `**${user.gamesPlayed}** games played\n**${user.wins}** won\n**${user.currentStreak}** current streak`,
          inline: false,
        },
      )
      .setImage('attachment://lirdle-status.png')
      .setFooter({ text: 'Use /lirdle to continue playing' });

    const playButton = new ButtonBuilder()
      .setCustomId('play_now')
      .setLabel('Play Now!')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(playButton);

    await interaction.editReply({
      embeds: [embed],
      files: [attachment],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    clog(console.error, '[apps/bot/interactions/status.js] Error:', error);
    await interaction.editReply({
      content: 'Failed to fetch status.',
      flags: MessageFlags.Ephemeral,
    });
  }
};

import { ActionRowBuilder, EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { clog } from '@lirdle/logger';
import { generateLirdleImage } from '../utils/imageGenerator.js';

const getTodayDate = () => new Date().toISOString().split('T')[0];

/**
 * Handle the /share command. Fetches the user's completed game session and
 * generates a shareable image of their result grid, posted as an embed in
 * the current channel.
 * @param {import('discord.js').Client} client - Discord client instance
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - The /share interaction
 */
export const run = async (client, interaction) => {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const today = getTodayDate();
    const { db } = await import('@lirdle/db');

    const user = await db.user.findUnique({ where: { id: userId } });
    const session = await db.session.findUnique({
      where: { userId_date: { userId, date: today } },
      include: { dailyWord: true },
    });

    if (!session || !session.won) {
      const playButton = new ButtonBuilder()
        .setCustomId('play_now')
        .setLabel('Play Now!')
        .setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(playButton);

      const embed = new EmbedBuilder()
        .setColor('#f97316')
        .setTitle('Game Not Finished')
        .setDescription('You must finish your game today before you can share your results!')
        .setFooter({ text: 'Use /lirdle to finish playing' });
      return await interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (guildId) {
      await db.userGuild.upsert({
        where: { userId_guildId: { userId, guildId } },
        create: { userId, guildId },
        update: {},
      });
    }

    const state = JSON.parse(session.guesses || '{}');
    const guessWords = Array.isArray(state.guessWords) ? state.guessWords : [];
    const perceivedScores = Array.isArray(state.scores) ? state.scores : [];
    const changes = Array.isArray(state.changes) ? state.changes : [];

    const imageBuffer = await generateLirdleImage(guessWords, perceivedScores, changes, true);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'lirdle-share.png' });

    const embed = new EmbedBuilder()
      .setColor('#22c55e')
      .setTitle(`🎮 ${interaction.user.username}'s Lirdle Result`)
      .setDescription(`Solved in **${guessWords.length}** tries!`)
      .addFields(
        { name: 'Games Won', value: `${user.wins} / ${user.gamesPlayed}`, inline: true },
        { name: 'Current Streak', value: `${user.currentStreak}`, inline: true },
        { name: 'Best Streak', value: `${user.maxStreak}`, inline: true },
      )
      .setImage('attachment://lirdle-share.png');

    const playButton = new ButtonBuilder()
      .setCustomId('play_now')
      .setLabel('Play Now!')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(playButton);

    await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
  } catch (error) {
    clog(console.error, '[apps/bot/interactions/share.js] Error:', error);
    await interaction.editReply({ content: 'Failed to share result.' });
  }
};

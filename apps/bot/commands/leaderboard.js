import { SlashCommandBuilder } from 'discord.js';

/**
 * Slash command definition for /leaderboard.
 * Displays the daily, monthly, or all-time leaderboard for this server.
 * @type {import('discord.js').SlashCommandBuilder}
 */
export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Display the server leaderboard for Lirdle')
  .addStringOption((option) =>
    option
      .setName('period')
      .setDescription('Time period for the leaderboard')
      .setRequired(false)
      .addChoices(
        { name: 'Daily', value: 'daily' },
        { name: 'Monthly', value: 'monthly' },
        { name: 'All Time', value: 'all' },
      ),
  );

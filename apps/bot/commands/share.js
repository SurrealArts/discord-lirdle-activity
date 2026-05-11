import { SlashCommandBuilder } from 'discord.js';

/**
 * Slash command definition for /share.
 * Shares the user's daily Lirdle result as an image in the current channel.
 * @type {import('discord.js').SlashCommandBuilder}
 */
export const data = new SlashCommandBuilder()
  .setName('share')
  .setDescription('Share your daily Lirdle game result');

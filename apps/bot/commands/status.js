import { SlashCommandBuilder } from 'discord.js';

/**
 * Slash command definition for /status.
 * Shows the user's current progress on today's Lirdle game (ephemeral reply).
 * @type {import('discord.js').SlashCommandBuilder}
 */
export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription("Check your current progress on today's Lirdle game");

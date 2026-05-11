import { SlashCommandBuilder } from 'discord.js';

/**
 * Slash command definition for /lirdle.
 * Launches the Lirdle Discord Activity in the current voice channel.
 * @type {import('discord.js').SlashCommandBuilder}
 */
export const data = new SlashCommandBuilder()
  .setName('lirdle')
  .setDescription('Start or open your Lirdle game');

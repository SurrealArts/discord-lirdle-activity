import { MessageFlags } from 'discord.js';

export const run = async (client, interaction) => {
  if (interaction.customId === 'play_now') {
    await interaction.reply({
      content: 'This feature is under maintenance. Use `/lirdle` or Discord Activity Menu to start the game.',
      flags: MessageFlags.Ephemeral,
    });
  }
};
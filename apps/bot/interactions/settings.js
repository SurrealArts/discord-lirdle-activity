import { MessageFlags } from 'discord.js';
import { clog } from '@lirdle/logger';
import { db } from '@lirdle/db';

/**
 * Handle the /settings command. Manages guild-level Lirdle settings via
 * direct DB access (bot and web share the same SQLite volume).
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export const run = async (client, interaction) => {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId;
    if (!guildId) {
      return await interaction.editReply({ content: 'This command can only be used in a server.' });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'monthly_stats') {
      const enable = interaction.options.getBoolean('enable', true);

      await db.guildConfig.upsert({
        where: { guildId },
        update: { monthlyStatsEnabled: enable },
        create: { guildId, activeChannelId: '', monthlyStatsEnabled: enable },
      });

      await interaction.editReply({
        content: `✅ Monthly statistics have been **${enable ? 'enabled' : 'disabled'}**.`,
      });
    } else if (subcommand === 'channel_default') {
      const channel = interaction.options.getChannel('channel');
      const leaderboardChannelId = channel ? channel.id : null;

      await db.guildConfig.upsert({
        where: { guildId },
        update: { leaderboardChannelId },
        create: { guildId, activeChannelId: '', leaderboardChannelId },
      });

      const msg = channel
        ? `✅ Automatic leaderboard messages will be sent to <#${channel.id}>.`
        : '✅ Automatic leaderboard channel has been cleared. The active channel will be used instead.';

      await interaction.editReply({ content: msg });
    } else if (subcommand === 'leaderboard_ping') {
      const enable = interaction.options.getBoolean('enable', true);

      await db.guildConfig.upsert({
        where: { guildId },
        update: { leaderboardPing: enable },
        create: { guildId, activeChannelId: '', leaderboardPing: enable },
      });

      await interaction.editReply({
        content: `✅ Leaderboard @mentions have been **${enable ? 'enabled' : 'disabled'}**.`,
      });
    } else {
      await interaction.editReply({ content: 'Unknown subcommand.' });
    }
  } catch (error) {
    clog(console.error, '[apps/bot/interactions/settings.js] Error:', error);
    await interaction.editReply({ content: 'Failed to update settings.' });
  }
};

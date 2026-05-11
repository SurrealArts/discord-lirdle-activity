import {
  InteractionResponseType,
  EmbedBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import { clog } from '@lirdle/logger';
import { generateGridDashboard } from '../utils/imageGenerator.js';

const activeDashboards = new Map();
const dashboardData = new Map();
const dashboardLatestAttachment = new Map();

const getTodayDate = () => new Date().toISOString().split('T')[0];

function formatDateTitle(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function createPlayNowButton() {
  return new ButtonBuilder()
    .setCustomId('play_now')
    .setLabel('Play Now!')
    .setStyle(ButtonStyle.Primary);
}

async function markDashboardOutdated(client, channelId) {
  const data = dashboardData.get(channelId);
  if (!data || !data.messageId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;
    const message = await channel.messages.fetch({ message: data.messageId, force: true });
    if (!message) return;
    const currentEmbed = message.embeds[0];
    if (!currentEmbed) return;

    const lastAttachment = dashboardLatestAttachment.get(channelId);

    const outdatedEmbed = EmbedBuilder.from(currentEmbed)
      .setColor('#6b7280')
      .setFooter({ text: 'OUTDATED • Scroll down for updated dashboard' });

    const editPayload = {
      embeds: [outdatedEmbed]
    };

    if (lastAttachment) {
      outdatedEmbed.setImage('attachment://lirdle-live.png');
      editPayload.files = [lastAttachment];
      editPayload.attachments = [];
    } else {
      const attachedImage = message.attachments.first();
      if (attachedImage) {
        outdatedEmbed.setImage(`attachment://${attachedImage.name}`);
        editPayload.attachments = [{ id: attachedImage.id, filename: attachedImage.name }];
      }
    }

    await message.edit(editPayload);
  } catch {
    /* message may have been deleted */
  }
  dashboardData.delete(channelId);
}

async function markDashboardDayEnded(client, channelId) {
  const data = dashboardData.get(channelId);
  if (!data || !data.messageId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;
    const message = await channel.messages.fetch({ message: data.messageId, force: true });
    if (!message) return;
    const currentEmbed = message.embeds[0];
    if (!currentEmbed) return;

    const lastAttachment = dashboardLatestAttachment.get(channelId);

    const endedEmbed = EmbedBuilder.from(currentEmbed)
      .setColor('#6b7280')
      .setFooter({ text: 'DAY ENDED • Check out today\'s leaderboard' });
    
    const editPayload = {
      embeds: [endedEmbed]
    };

    if (lastAttachment) {
      endedEmbed.setImage('attachment://lirdle-live.png');
      editPayload.files = [lastAttachment];
      editPayload.attachments = [];
    } else {
      const attachedImage = message.attachments.first();
      if (attachedImage) {
        endedEmbed.setImage(`attachment://${attachedImage.name}`);
        editPayload.attachments = [{ id: attachedImage.id, filename: attachedImage.name }];
      }
    }

    await message.edit(editPayload);
  } catch {
    /* message may have been deleted */
  }
  dashboardData.delete(channelId);
}

async function createDashboard(client, guildId, channelId) {
  const guild = await client.guilds.fetch(guildId);
  if (!guild) return;

  const channel = await guild.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) return;

  const today = getTodayDate();
  const existingData = dashboardData.get(channelId);

  if (existingData) {
    if (existingData.date === today) {
      await markDashboardOutdated(client, channelId);
    } else {
      await markDashboardDayEnded(client, channelId);
    }
  }

  if (activeDashboards.has(channelId)) {
    clearInterval(activeDashboards.get(channelId));
    activeDashboards.delete(channelId);
  }

  const { db } = await import('@lirdle/db');

  await db.guildConfig.upsert({
    where: { guildId },
    update: { activeChannelId: channelId },
    create: { guildId, activeChannelId: channelId },
  });

  const dateTitle = formatDateTitle(today);

  const embed = new EmbedBuilder()
    .setColor('#ef4444')
    .setTitle(`🔴 ${dateTitle}`)
    .setDescription('Loading live data...')
    .setFooter({ text: 'LIVE • Updates automatically' });

  const row = new ActionRowBuilder().addComponents(createPlayNowButton());

  const dashboardMessage = await channel.send({ embeds: [embed], components: [row] });

  dashboardData.set(channelId, { messageId: dashboardMessage.id, date: today });

  let lastHash = '';

  const pollInterval = setInterval(async () => {
    try {
      const pollToday = getTodayDate();

      if (pollToday !== today) {
        const data = dashboardData.get(channelId);
        if (data && data.messageId) {
          try {
            const channel = await client.channels.fetch(channelId);
            if (channel) {
              const message = await channel.messages.fetch({ message: data.messageId, force: true });
              if (message) {
                const currentEmbed = message.embeds[0];
                if (!currentEmbed) return;

                const lastAttachment = dashboardLatestAttachment.get(channelId);

                const endedEmbed = EmbedBuilder.from(currentEmbed)
                  .setColor('#6b7280')
                  .setFooter({ text: 'DAY ENDED • Check out today\'s leaderboard' });

                const editPayload = { embeds: [endedEmbed] };

                if (lastAttachment) {
                  endedEmbed.setImage('attachment://lirdle-live.png');
                  editPayload.files = [lastAttachment];
                  editPayload.attachments = [];
                } else {
                  const attachedImage = message.attachments.first();
                  if (attachedImage) {
                    endedEmbed.setImage(`attachment://${attachedImage.name}`);
                    editPayload.attachments = [{ id: attachedImage.id, filename: attachedImage.name }];
                  }
                }

                await message.edit(editPayload);
              }
            }
          } catch {
            /* message may have been deleted */
          }
        }
        dashboardData.delete(channelId);
        clearInterval(pollInterval);
        activeDashboards.delete(channelId);
        return;
      }

      const userIds = (
        await db.userGuild.findMany({
          where: { guildId },
          select: { userId: true },
        })
      ).map((r) => r.userId);

      if (userIds.length === 0) return;

      const activeSessions = await db.session.findMany({
        where: {
          date: pollToday,
          userId: { in: userIds },
        },
      });

      const currentHash = activeSessions.map((s) => s.updatedAt.getTime()).join('-');

      if (currentHash === lastHash) {
        return;
      }
      lastHash = currentHash;

      const activeIds = activeSessions.map((s) => s.userId);
      let memberLookup = new Map();
      try {
        const fetched = await guild.members.fetch({ user: activeIds });
        for (const [id, member] of fetched) {
          memberLookup.set(id, member);
        }
      } catch {
        /* fallback: no member data */
      }

      const activePlayers = activeSessions.map((session) => {
        const member = memberLookup.get(session.userId);
        const state = JSON.parse(session.guesses || '{}');
        return {
          username: member ? member.user.username : 'Unknown',
          avatarUrl: member
            ? member.user.displayAvatarURL({ extension: 'png', size: 128 })
            : null,
          guessWords: Array.isArray(state.guessWords) ? state.guessWords : [],
          perceivedScores: Array.isArray(state.scores) ? state.scores : [],
          changes: Array.isArray(state.changes) ? state.changes : [],
          won: session.won,
          isFinished: session.won === true,
        };
      });

      const imageBuffer = await generateGridDashboard(activePlayers, dateTitle);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'lirdle-live.png' });
      dashboardLatestAttachment.set(channelId, attachment);

      const liveEmbed = new EmbedBuilder()
        .setColor('#ef4444')
        .setImage('attachment://lirdle-live.png')
        .setFooter({ text: '🔴 LIVE • Updates automatically' });

      await dashboardMessage.edit({
        embeds: [liveEmbed],
        files: [attachment],
        attachments: []
      });
    } catch (err) {
      clog(console.error, '[apps/bot/interactions/lirdle.js][Poll Loop Error]', err);
    }
  }, 10000);

  activeDashboards.set(channelId, pollInterval);
}

export { createDashboard, createPlayNowButton };

export const run = async (client, interaction) => {
  try {
    await client.rest.post(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      body: { type: InteractionResponseType.LaunchActivity },
    });
    clog(
      console.log,
      `[apps/bot/interactions/lirdle.js] User ${interaction.user.id} launched lirdle activity`,
    );
  } catch (error) {
    clog(console.error, '[apps/bot/interactions/lirdle.js] Error:', error);
  }
};

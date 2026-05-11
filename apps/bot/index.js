import '../../config.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { readdirSync, readdir } from 'fs';
import {
  ActivityType,
  Client,
  GatewayIntentBits,
} from 'discord.js';
import express from 'express';

import { clog } from '@lirdle/logger';
import { startCronJobs } from './utils/cronJobs.js';

const app = express();
const PORT = process.env.BOT_PORT || 3001;
const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.TOKEN;

app.use(express.static('public'));
app.use(express.json());

export { app };

app.listen(PORT, () => {
  clog(console.log, `[apps/bot/index.js] Lirdle bot listening on port ${PORT}`);
});

const cmds = [];

let createDashboardFn = null;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

client.once('clientReady', async () => {
  clog(console.log, `[apps/bot/index.js] Logged in as ${client.user.tag}!`);

  const lirdle = await import('./interactions/lirdle.js');
  createDashboardFn = lirdle.createDashboard;

  app.post('/api/activity-launch', async (req, res) => {
    try {
      const { guildId, channelId } = req.body;
      if (!guildId || !channelId) {
        return res.status(400).json({ error: 'Missing guildId or channelId' });
      }
      if (!createDashboardFn) {
        return res.status(500).json({ error: 'Dashboard not initialized' });
      }
      await createDashboardFn(client, guildId, channelId);
      res.json({ success: true });
    } catch (err) {
      clog(console.error, '[apps/bot/index.js] /api/activity-launch error:', err);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  const commands = [];

  const getCommandFiles = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        files.push(...getCommandFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  };

  const commandFiles = getCommandFiles('./commands');
  for (const file of commandFiles) {
    const command = await import(`./${file}`);
    commands.push(command.data.toJSON());
  }

  const rest = new REST({
    version: '10',
  }).setToken(TOKEN);

  (async () => {
    try {
      clog(console.log, '[apps/bot/index.js] Started refreshing application (/) commands.');

      const existingCommands = await rest.get(Routes.applicationCommands(CLIENT_ID));
      for (const command of existingCommands) {
        cmds.push(command);
        clog(console.log, `[apps/bot/index.js] Pushed '${command.name}'.`);
      }

      const preservedCommands = existingCommands.filter(
        (existing) => !commands.some((c) => c.name === existing.name),
      );

      await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: [...commands, ...preservedCommands],
      });

      clog(console.log, '[apps/bot/index.js] Successfully reloaded application (/) commands.');
    } catch (error) {
      clog(console.error, error);
    }
  })();

  client.user.setPresence({
    activities: [
      {
        type: ActivityType.Custom,
        name: 'custom',
        state: 'Play Lirdle!',
      },
    ],
    status: 'online',
  });

  startCronJobs(client);
});

client.once('reconnecting', () => {
  clog(console.log, '[apps/bot/index.js] Bot Reconnecting...');
});

client.once('disconnect', () => {
  clog(console.log, '[apps/bot/index.js] Bot Disconnected.');
});

readdir('./events/', (err, files) => {
  if (err) return console.error;
  files.forEach(async (file) => {
    if (!file.endsWith('.js')) return;
    const evt = await import(`./events/${file}`);
    let evtName = file.split('.')[0];
    clog(console.log, `[apps/bot/index.js] Loaded event '${evtName}'`);
    client.on(evtName, evt.default.bind(null, client));
  });
});

client.login(TOKEN);

export default { cmds };
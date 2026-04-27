import { clientid, token } from './config.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { readdirSync, readdir } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  ActivityType,
  Client,
  GatewayIntentBits,
  // Collection,
  // MessageFlags
} from 'discord.js';
import express from 'express';

import { clog } from '@lirdle/logger';
import { startCronJobs } from './utils/cronJobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsDir = path.join(__dirname, 'commands');
const eventsDir = path.join(__dirname, 'events');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.listen(PORT, () => {
  clog(console.log, `[apps/bot/index.js] Lirdle Web App listening on port ${PORT}`);
});

const cmds: unknown[] = [];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    // GatewayIntentBits.GuildMessages,
    // GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    // GatewayIntentBits.GuildMessageReactions,
  ],
});

client.once('clientReady', async () => {
  clog(console.log, `[apps/bot/index.js] Logged in as ${client.user!.tag}!`);

  const commands: any[] = [];

  /**
   * Recursively find all .js files in a command directory.
   * @param {string} dir - Directory path to search
   * @returns {string[]} Array of file paths
   */
  const getCommandFiles = (dir: string): string[] => {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getCommandFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  };

  const commandFiles = getCommandFiles(commandsDir);
  for (const file of commandFiles) {
    const command = await import(pathToFileURL(file).href);
    commands.push(command.data.toJSON());
  }

  const rest = new REST({
    version: '10',
  }).setToken(token);

  (async () => {
    try {
      clog(console.log, '[apps/bot/index.js] Started refreshing application (/) commands.');

      const existingCommands = (await rest.get(Routes.applicationCommands(clientid))) as Array<{
        name: string;
      }>;
      for (const command of existingCommands) {
        cmds.push(command);
        clog(console.log, `[apps/bot/index.js] Pushed '${command.name}'.`);
      }

      const preservedCommands = existingCommands.filter(
        (existing) => !commands.some((c) => c.name === existing.name),
      );

      await rest.put(Routes.applicationCommands(clientid), {
        body: [...commands, ...preservedCommands],
      });

      clog(console.log, '[apps/bot/index.js] Successfully reloaded application (/) commands.');
    } catch (error) {
      clog(console.error, error);
    }
  })();

  client.user!.setPresence({
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

readdir(eventsDir, (err, files) => {
  if (err) return console.error;
  files.forEach(async (file) => {
    if (!file.endsWith('.js')) return;
    const evt = await import(pathToFileURL(path.join(eventsDir, file)).href);
    const evtName = file.split('.')[0];
    clog(console.log, `[apps/bot/index.js] Loaded event '${evtName}'`);
    client.on(evtName, evt.default.bind(null, client));
  });
});

client.login(token);

export default { cmds };

import dotenvFlow from 'dotenv-flow';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, GatewayIntentBits } from 'discord.js';
import { runDailyLeaderboard, runMonthlyLeaderboard } from '../utils/cronJobs.js';
import { clog } from '@lirdle/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenvFlow.config({ path: path.resolve(__dirname, '../../..') });

const args = process.argv.slice(2);
const type = args[0];

if (!type || !['daily', 'monthly'].includes(type)) {
  console.log('Usage: node scripts/run-cron.js <daily|monthly> [date]');
  console.log('  daily [YYYY-MM-DD]  - Run daily leaderboard for specified date (default: yesterday)');
  console.log('  monthly [YYYY-MM]   - Run monthly leaderboard for specified month (default: last month)');
  process.exit(1);
}

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('TOKEN environment variable is required');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('clientReady', async () => {
  clog(console.log, `[scripts/run-cron.js] Logged in as ${client.user.tag}`);

  try {
    if (type === 'daily') {
      const date = args[1] || null;
      await runDailyLeaderboard(client, date);
    } else if (type === 'monthly') {
      const yearMonth = args[1] || null;
      await runMonthlyLeaderboard(client, yearMonth);
    }
  } catch (err) {
    clog(console.error, '[scripts/run-cron.js] Error:', err);
    process.exit(1);
  } finally {
    await client.destroy();
    process.exit(0);
  }
});

client.login(TOKEN);
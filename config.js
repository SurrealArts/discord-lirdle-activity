import dotenvFlow from 'dotenv-flow';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname);

dotenvFlow.config({ path: repoRoot });

const BOT_REQUIRED = ['CLIENT_ID', 'TOKEN'];
const WEB_REQUIRED = ['CLIENT_ID', 'CLIENT_SECRET'];
const OPTIONAL = ['VERSION', 'LOG_WITH_TIME', 'LOG_TIMEZONE', 'WEB_PORT', 'BOT_PORT', 'IS_DOCKER'];

let missing = { essential: [], nonEssential: [] };

const checkVars = (requiredVars, context) => {
  for (const key of requiredVars) {
    if (!process.env[key]) {
      missing.essential.push(`${context}:${key}`);
    }
  }
};

const checkOptional = () => {
  for (const key of OPTIONAL) {
    if (!process.env[key]) {
      missing.nonEssential.push(key);
    }
  }
};

if (fs.existsSync(path.join(repoRoot, 'apps', 'bot'))) {
  checkVars(BOT_REQUIRED, 'bot');
}
if (fs.existsSync(path.join(repoRoot, 'apps', 'web'))) {
  checkVars(WEB_REQUIRED, 'web');
}
checkOptional();

const log = (...args) => console.log(...args);
const error = (...args) => console.error(...args);
const warn = (...args) => console.warn(...args);

if (missing.essential.length > 0) {
  error(`[config.js] Missing essential variables: ${missing.essential.join(', ')}`);
  process.exit(1);
}
if (missing.nonEssential.length > 0) {
  warn(`[config.js] Missing non-essential variables: ${missing.nonEssential.join(', ')}`);
}
const optionalValues = OPTIONAL.map((k) => `${k}=${process.env[k] || '(default)'}`).join(', ');
log(`[config.js] Optional vars: ${optionalValues}`);
log('[config.js] Validation Success.');

export const isDocker = process.env.IS_DOCKER === 'true';
export const botPort = process.env.BOT_PORT || 3001;
export const webPort = process.env.WEB_PORT || 3000;
export const botHost = isDocker ? 'bot' : 'localhost';
export const botUrl = `http://${botHost}:${botPort}`;
export default { log, error, warn };
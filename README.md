![version](https://img.shields.io/badge/version-1.0.0-blue)

# Lirdle: Discord Activity & Bot

A full-stack Discord application bringing the "One Lie Per Line" word game natively to Discord voice channels. This project is structured as a **pnpm v10 monorepo** and includes the interactive Activity frontend, an Express backend, a Discord.js utility bot, and a persistent SQLite database. I dedicate this to Eric Promislow for the original [lirdle game](https://lirdle.com)! (His [github repo](https://github.com/ericpromislow/lirdle))

## Features

- **Discord Activity:** Play Lirdle natively inside Discord voice channels.
- **Bot Commands:** Features `/status` and `/share`.
- **Cross-Device Sync:** Play on desktop, pick up on mobile. All synced.

---

## Deployment

This application is designed to be deployed using Docker. The database is stored in a persistent Docker volume (`lirdle_sqlite_data`) so game streaks are never lost.

### 1. Environment Setup

Create a `.env` file from `.env.example` in the root directory:

```env
# Key configuration for discord bot.
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
TOKEN=your_bot_token
VERSION=1.0.0

IS_DOCKER=true
WEB_PORT=3000
BOT_PORT=3001

# Configure timezones for console output.
LOG_WITH_TIME=true
LOG_TIMEZONE=UTC

# Get your token from cloudflare's cloudflared.
TUNNEL_TOKEN=your_cloudflare_tunnel_token
```

### 2. Launch the Stack

Start the Web server, Bot, and Cloudflare Tunnel:

```bash
docker-compose up -d --build
```

### 3. Initialize the Database (First Run Only)

Once the containers are running, push the Prisma schema to the SQLite volume:

```bash
docker-compose exec web pnpm --filter @lirdle/db exec prisma db push
docker-compose exec web pnpm --filter @lirdle/db exec prisma generate
```

Or, from the project, which exists as an option to force-reset the db:

```bash
pnpm run force-reset-db
```

---

## Local Development

If you are developing locally without Docker, follow these steps:

1. **Install Dependencies:**
   _(Note: Native packages like canvas and better-sqlite3 require build approvals in pnpm v10)_

   ```bash
   pnpm install
   pnpm approve-builds --all
   ```

2. **Generate Prisma Client:**

   ```bash
   pnpm --filter @lirdle/db exec prisma generate
   ```

3. **Set `IS_DOCKER` in `.env` to `false`:**

   ```env
   # [...]
   VERSION=1.0.0

   IS_DOCKER=false
   WEB_PORT=3000
   BOT_PORT=3001
   # [...]
   ```

4. **Start Development Servers:**

   ```bash
   # Terminal 1: Run the Tunnel (./apps/web)
   npx cloudflared tunnel run --token <token>

   # Or this, just to make sure to use the provided free URL to
   # Discord Dev Portal -> Activity -> URL Mappings
   # Every run of this command changes the URL, so take note.
   npx cloudflared tunnel --url http://localhost:3000

   # Terminal 2: Run the Web and Bot App (./apps/web)
   pnpm run dev
   ```

### Docker

In case of running it with docker, do step 1 and 2 from [`Local
Development`](#local-development), and then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

# LICENSE

Copyright (C) 2023 Bovination Productions, MIT License.\
Revamped for Lirdle Discord Activity 2026.

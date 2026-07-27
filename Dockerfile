FROM node:22-bullseye-slim AS base

RUN apt-get update && apt-get install -y \
	python3 \
	build-essential \
	libcairo2-dev \
	libpango1.0-dev \
	libjpeg-dev \
	libgif-dev \
	librsvg2-dev \
	&& rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/logger/package.json ./packages/logger/
COPY apps/web/package.json ./apps/web/
COPY apps/bot/package.json ./apps/bot/

RUN pnpm install
RUN pnpm approve-builds --all

COPY . .

RUN pnpm --filter @lirdle/db exec prisma generate

FROM node:22-bullseye-slim
RUN apt-get update && apt-get install -y --fix-missing \
	libcairo2 \
	libjpeg62-turbo \
	libpango-1.0-0 \
	libgif7 \
	librsvg2-2 \
	&& rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

COPY --from=base /app /app

COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

CMD ["pnpm", "-w", "run", "dev"]
ENTRYPOINT ["entrypoint.sh"]
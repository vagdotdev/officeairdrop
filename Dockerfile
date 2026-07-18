# Drop signaling server (WebSocket + in-memory/Redis presence). Never stores files.
FROM node:22-bookworm-slim

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile --prod=false

ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 8787

CMD ["pnpm", "--filter", "@beam/server", "start"]

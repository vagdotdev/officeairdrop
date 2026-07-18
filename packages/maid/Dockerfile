# Build from the repository root:
# docker build -f packages/maid/Dockerfile -t drop-maid .
FROM node:22-bookworm-slim

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile --prod=false

ENV NODE_ENV=production
ENV MAID_BIND_HOST=0.0.0.0
ENV MAID_PORT=8788
ENV MAID_DATA_DIR=/data
EXPOSE 8788

USER node
CMD ["pnpm", "--filter", "@beam/maid", "start"]

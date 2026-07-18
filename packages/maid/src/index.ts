import { buildMaid } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { app, close } = await buildMaid({ config });

const shutdown = async () => {
  await close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

await app.listen({ host: config.host, port: config.port });

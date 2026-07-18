/**
 * Server entrypoint. Boots Fastify and installs graceful-shutdown handlers so
 * Redis connections close cleanly on SIGINT/SIGTERM.
 */
import { buildApp } from './app.js';
import { config } from './config.js';

async function main(): Promise<void> {
  const { app, close } = await buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err, 'failed to start');
    process.exit(1);
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`received ${signal}, shutting down`);
    await app.close();
    await close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();

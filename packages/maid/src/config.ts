export interface MaidConfig {
  host: string;
  port: number;
  dataDir: string;
  accessToken: string;
  corsOrigins: string[];
  maxParkBytes: number;
  minFreeBytes: number;
  defaultTtlSeconds: number;
  maxTtlSeconds: number;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function loadConfig(): MaidConfig {
  const accessToken = process.env.MAID_ACCESS_TOKEN;
  if (!accessToken || accessToken.length < 24) {
    throw new Error('MAID_ACCESS_TOKEN must be set to at least 24 characters');
  }

  return {
    host: process.env.HOST ?? '0.0.0.0',
    port: positiveInteger('PORT', 8788),
    dataDir: process.env.MAID_DATA_DIR ?? './data/maid',
    accessToken,
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    maxParkBytes: positiveInteger('MAX_PARK_BYTES', 125_000_000_000),
    minFreeBytes: positiveInteger('MIN_FREE_BYTES', 5_000_000_000),
    defaultTtlSeconds: positiveInteger('DEFAULT_TTL_SECONDS', 259_200),
    maxTtlSeconds: positiveInteger('MAX_TTL_SECONDS', 2_592_000),
  };
}

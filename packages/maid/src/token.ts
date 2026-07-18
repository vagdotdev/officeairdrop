import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function newCapability(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function secretMatches(actual: string, expected: string): boolean {
  const actualHash = Buffer.from(hashToken(actual), 'hex');
  const expectedHash = Buffer.from(hashToken(expected), 'hex');
  return timingSafeEqual(actualHash, expectedHash);
}

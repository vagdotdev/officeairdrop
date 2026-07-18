import { createHash } from 'node:crypto';
import {
  BASE_NONCE_LENGTH,
  CHUNK_SIZE,
  GCM_TAG_BITS,
  SHA256_LENGTH,
  type FileDescriptor,
  type ParkManifest,
} from '@beam/shared';

const TAG_BYTES = GCM_TAG_BITS / 8;
const MAX_FILES = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeFixed(value: unknown, length: number, field: string): Buffer {
  if (typeof value !== 'string') throw new Error(`${field} must be a base64url string`);
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length !== length) throw new Error(`${field} has the wrong length`);
  return decoded;
}

function parseFile(value: unknown, index: number): FileDescriptor {
  if (!isRecord(value)) throw new Error(`files[${index}] is invalid`);
  const { id, name, size, type, chunkCount } = value;
  if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
    throw new Error(`files[${index}].id is invalid`);
  }
  if (typeof name !== 'string' || name.length === 0 || name.length > 255) {
    throw new Error(`files[${index}].name is invalid`);
  }
  if (!Number.isSafeInteger(size) || (size as number) < 0) {
    throw new Error(`files[${index}].size is invalid`);
  }
  if (typeof type !== 'string' || type.length > 255) {
    throw new Error(`files[${index}].type is invalid`);
  }
  const expectedChunks = Math.max(1, Math.ceil((size as number) / CHUNK_SIZE));
  if (chunkCount !== expectedChunks) {
    throw new Error(`files[${index}].chunkCount does not match its size`);
  }
  return { id, name, size: size as number, type, chunkCount: chunkCount as number };
}

function merkleRoot(leaves: Buffer[]): Buffer {
  if (leaves.length === 0) return Buffer.alloc(SHA256_LENGTH);
  let level = leaves;
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left;
      next.push(createHash('sha256').update(Buffer.concat([left, right])).digest());
    }
    level = next;
  }
  return level[0]!;
}

function parseHashList(value: unknown, count: number, field: string): string[] {
  if (!Array.isArray(value) || value.length !== count) {
    throw new Error(`${field} must contain exactly ${count} hashes`);
  }
  return value.map((hash, index) => {
    decodeFixed(hash, SHA256_LENGTH, `${field}[${index}]`);
    return hash as string;
  });
}

export function parseManifest(value: unknown, maxParkBytes: number): ParkManifest {
  if (!isRecord(value)) throw new Error('manifest is required');
  if (value.version !== 1) throw new Error('unsupported manifest version');
  if (
    typeof value.transferId !== 'string' ||
    value.transferId.length < 6 ||
    value.transferId.length > 100
  ) {
    throw new Error('transferId is invalid');
  }
  if (!Array.isArray(value.files) || value.files.length === 0 || value.files.length > MAX_FILES) {
    throw new Error(`files must contain 1-${MAX_FILES} entries`);
  }
  const files = value.files.map(parseFile);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const totalChunks = files.reduce((sum, file) => sum + file.chunkCount, 0);
  if (value.chunkSize !== CHUNK_SIZE) throw new Error('unsupported chunk size');
  if (value.totalBytes !== totalBytes) throw new Error('totalBytes does not match files');
  if (value.totalChunks !== totalChunks) throw new Error('totalChunks does not match files');

  const cipherBytes = totalBytes + totalChunks * TAG_BYTES;
  if (cipherBytes > maxParkBytes) throw new Error('park exceeds the configured size limit');

  decodeFixed(value.baseNonce, BASE_NONCE_LENGTH, 'baseNonce');
  const chunkHashes = parseHashList(value.chunkHashes, totalChunks, 'chunkHashes');
  const cipherChunkHashes = parseHashList(
    value.cipherChunkHashes,
    totalChunks,
    'cipherChunkHashes',
  );
  const plainRoot = decodeFixed(value.merkleRoot, SHA256_LENGTH, 'merkleRoot');
  const cipherRoot = decodeFixed(
    value.cipherMerkleRoot,
    SHA256_LENGTH,
    'cipherMerkleRoot',
  );
  if (!merkleRoot(chunkHashes.map((hash) => Buffer.from(hash, 'base64url'))).equals(plainRoot)) {
    throw new Error('plaintext Merkle root does not match chunk hashes');
  }
  if (
    !merkleRoot(cipherChunkHashes.map((hash) => Buffer.from(hash, 'base64url'))).equals(
      cipherRoot,
    )
  ) {
    throw new Error('ciphertext Merkle root does not match chunk hashes');
  }

  return {
    version: 1,
    transferId: value.transferId,
    files,
    chunkSize: CHUNK_SIZE,
    totalChunks,
    totalBytes,
    baseNonce: value.baseNonce as string,
    chunkHashes,
    merkleRoot: value.merkleRoot as string,
    cipherChunkHashes,
    cipherMerkleRoot: value.cipherMerkleRoot as string,
  };
}

export function expectedCiphertextLength(manifest: ParkManifest, chunkIndex: number): number {
  let start = 0;
  for (const file of manifest.files) {
    const end = start + file.chunkCount;
    if (chunkIndex >= start && chunkIndex < end) {
      const localIndex = chunkIndex - start;
      const plainStart = localIndex * manifest.chunkSize;
      const plaintextLength = Math.min(manifest.chunkSize, file.size - plainStart);
      return plaintextLength + TAG_BYTES;
    }
    start = end;
  }
  throw new Error('chunk index out of range');
}

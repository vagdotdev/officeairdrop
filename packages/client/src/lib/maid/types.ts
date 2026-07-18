import type { CompletedFile, TransferProgress } from '../transfer/types.js';

export type ParkState = 'idle' | 'preparing' | 'uploading' | 'complete' | 'error';
export type RecoverState =
  | 'idle'
  | 'connecting'
  | 'downloading'
  | 'verifying'
  | 'complete'
  | 'deleted'
  | 'error';

export interface ParkCallbacks {
  onState?: (state: ParkState) => void;
  onProgress?: (progress: TransferProgress) => void;
  onComplete?: (recoveryUrl: string, expiresAt: string) => void;
  onError?: (message: string) => void;
}

export interface RecoverCallbacks {
  onState?: (state: RecoverState) => void;
  onProgress?: (progress: TransferProgress) => void;
  onComplete?: (files: CompletedFile[], expiresAt: string) => void;
  onError?: (message: string) => void;
}

export function encodeRecoveryFragment(keyFragment: string, token: string): string {
  return `${keyFragment}.${token}`;
}

export function decodeRecoveryFragment(fragment: string): {
  keyFragment: string;
  token: string;
} {
  const separator = fragment.indexOf('.');
  if (separator <= 0 || separator === fragment.length - 1) {
    throw new Error('Recovery link is missing its key or capability.');
  }
  return {
    keyFragment: fragment.slice(0, separator),
    token: fragment.slice(separator + 1),
  };
}

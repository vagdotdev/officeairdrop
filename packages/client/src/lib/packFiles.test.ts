import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import { filesByFolderName, packFilesForSend } from './packFiles.js';

describe('packFilesForSend', () => {
  it('leaves a single file alone', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'solo.txt', { type: 'text/plain' });
    const out = await packFilesForSend([file], 'Ada');
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe('solo.txt');
  });

  it('zips multiple files into a Files by {name} folder', async () => {
    const a = new File([new Uint8Array([1])], 'a.txt', { type: 'text/plain' });
    const b = new File([new Uint8Array([2, 3])], 'b.txt', { type: 'text/plain' });
    const out = await packFilesForSend([a, b], 'Priya · Design');
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe('Files by Priya · Design.zip');

    const bytes = new Uint8Array(await out[0]!.arrayBuffer());
    const unzipped = unzipSync(bytes);
    const paths = Object.keys(unzipped).sort();
    expect(paths).toEqual(['Files by Priya · Design/a.txt', 'Files by Priya · Design/b.txt']);
  });

  it('sanitizes folder names', () => {
    expect(filesByFolderName('A/B:C')).toBe('Files by ABC');
  });
});

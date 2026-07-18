import { zipSync } from 'fflate';

/** Safe-ish folder/file name from a display name. */
export function filesByFolderName(displayName: string): string {
  const cleaned = displayName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40);
  return `Files by ${cleaned || 'Someone'}`;
}

/**
 * One file → sent as-is.
 * Multiple files → zipped into a single "Files by {name}.zip" containing a
 * folder of that name, so the receiver downloads once and gets everything.
 */
export async function packFilesForSend(
  files: File[],
  senderName: string,
): Promise<File[]> {
  if (files.length <= 1) return files;

  const folder = filesByFolderName(senderName);
  const entries: Record<string, Uint8Array> = {};

  // Avoid colliding names inside the zip.
  const used = new Map<string, number>();
  for (const file of files) {
    const base = file.name || 'file';
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const unique = count === 0 ? base : appendBeforeExt(base, count + 1);
    const bytes = new Uint8Array(await file.arrayBuffer());
    entries[`${folder}/${unique}`] = bytes;
  }

  const zipped = zipSync(entries, { level: 1 });
  // Copy into a fresh ArrayBuffer-backed view for File/Blob typing.
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return [
    new File([copy], `${folder}.zip`, {
      type: 'application/zip',
      lastModified: Date.now(),
    }),
  ];
}

function appendBeforeExt(name: string, n: number): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return `${name} (${n})`;
  return `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
}

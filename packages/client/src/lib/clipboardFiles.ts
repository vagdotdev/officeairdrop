/**
 * Turn the system clipboard into File[] so Drop can send it like any other drop.
 * Prefers ClipboardItem (images + text); falls back to readText().
 */

function extForMime(type: string): string {
  const subtype = type.split('/')[1]?.split(';')[0]?.trim();
  if (!subtype) return 'bin';
  if (subtype === 'jpeg') return 'jpg';
  if (subtype === 'svg+xml') return 'svg';
  if (subtype === 'plain') return 'txt';
  return subtype.replace(/[^a-z0-9]+/gi, '') || 'bin';
}

async function fileFromClipboardItem(item: ClipboardItem): Promise<File[]> {
  const out: File[] = [];
  const types = item.types.filter((t) => t.startsWith('image/') || t === 'text/plain');

  for (const type of types) {
    try {
      const blob = await item.getType(type);
      if (type === 'text/plain') {
        const text = (await blob.text()).replace(/\r\n/g, '\n');
        if (!text.trim()) continue;
        out.push(new File([text], 'Clipboard.txt', { type: 'text/plain' }));
        continue;
      }
      const ext = extForMime(type);
      out.push(new File([blob], `Clipboard.${ext}`, { type: blob.type || type }));
    } catch {
      /* skip unreadable type */
    }
  }
  return out;
}

export async function filesFromClipboard(): Promise<File[]> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard isn’t available in this browser.');
  }

  if (typeof navigator.clipboard.read === 'function') {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        files.push(...(await fileFromClipboardItem(item)));
      }
      if (files.length > 0) return files;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NotAllowedError') {
        throw new Error('Allow clipboard access, then try Share Clipboard again.');
      }
      /* fall through to readText for browsers that only allow text */
    }
  }

  if (typeof navigator.clipboard.readText !== 'function') {
    throw new Error('Clipboard isn’t available in this browser.');
  }

  const text = (await navigator.clipboard.readText()).replace(/\r\n/g, '\n');
  if (!text.trim()) {
    throw new Error('Clipboard is empty — copy something first.');
  }
  return [new File([text], 'Clipboard.txt', { type: 'text/plain' })];
}

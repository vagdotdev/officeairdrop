/** Soft AirDrop-style avatar gradients (macOS Big Sur energy). */
export const ACCENTS: ReadonlyArray<readonly [string, string]> = [
  ['#FF6B6B', '#FF8E53'],
  ['#FF9F1C', '#FFBF69'],
  ['#2EC4B6', '#80ED99'],
  ['#5B8CFF', '#7BDFF2'],
  ['#B388FF', '#F78DA7'],
  ['#FF5D8F', '#FFC6FF'],
  ['#00BBF9', '#00F5D4'],
  ['#9B5DE5', '#F15BB5'],
];

export function accentGradient(accent: number): string {
  const pair = ACCENTS[((accent % ACCENTS.length) + ACCENTS.length) % ACCENTS.length]!;
  return `linear-gradient(145deg, ${pair[0]}, ${pair[1]})`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase();
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

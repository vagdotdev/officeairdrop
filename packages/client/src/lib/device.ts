/** Best-effort device label for lobby presence. */
export function guessDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Device';
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';

  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'iPad';
  }
  if (/Android/.test(ua)) return 'Android';
  if (/Win/.test(platform) || /Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(platform) && !/Android/.test(ua)) return 'Linux';
  if (/Mac/.test(platform) || /Macintosh/.test(ua)) {
    if (/Mobile/.test(ua)) return 'iPhone';
    return 'Mac';
  }
  return 'Device';
}

const NAME_KEY = 'drop.displayName';

export function loadDisplayName(): string {
  try {
    return localStorage.getItem(NAME_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function saveDisplayName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    /* ignore */
  }
}

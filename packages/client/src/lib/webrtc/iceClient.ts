/**
 * Fetches ICE server configuration from the signaling server's `GET /ice`.
 *
 * This is the only thing the client needs from the server besides the
 * WebSocket — and notably it carries no secret. TURN credentials (when the
 * deployment uses TURN) are short-lived/relay-only and never expose file data.
 */
import type { IceConfigResponse } from '@beam/shared';

export async function fetchIceServers(
  signalingBaseUrl: string,
): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(`${signalingBaseUrl.replace(/\/$/, '')}/ice`);
    if (!res.ok) throw new Error(`ICE config request failed: ${res.status}`);
    const body = (await res.json()) as IceConfigResponse;
    return body.iceServers as RTCIceServer[];
  } catch {
    // Fall back to a public STUN server so local/dev still works offline-ish.
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
}

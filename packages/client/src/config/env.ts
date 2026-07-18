/**
 * Client environment. Vite inlines `import.meta.env.VITE_*` at build time.
 */

/** Base URL of the signaling server (http/https; upgraded to ws/wss internally). */
export const SIGNALING_URL: string =
  import.meta.env.VITE_SIGNALING_URL ?? 'http://localhost:8787';

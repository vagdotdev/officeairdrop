/**
 * Transport layer public API. Knows about peers and channels — never about
 * files, chunks, or keys.
 */
export { PeerConnection } from './connection.js';
export { DataChannelTransport } from './dataChannel.js';
export type { ChannelMessage } from './dataChannel.js';
export type { Transport, ChannelData } from './transport.js';
export { fetchIceServers } from './iceClient.js';

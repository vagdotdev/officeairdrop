# Drop

**Internal office AirDrop** — see who’s online, tap a person, send files.

For the full story — problem, feel, how it works, what it is not — read [WHAT-THIS-IS.md](./WHAT-THIS-IS.md).

## Live

| | URL |
|---|---|
| **App** | https://officeairdrop.vercel.app |
| **Signaling API** | https://officeairdrop-api-production.up.railway.app |
| **GitHub** | https://github.com/vagdotdev/officeairdrop |

Built on the [Beam](https://github.com/Kroszborg/beam) peer-to-peer pipeline:
files are encrypted in the browser, streamed over a WebRTC DataChannel, and
never uploaded to a server. The backend only brokers presence + WebRTC signaling.

```
Your browser ──encrypt──▶ ░░ WebRTC P2P ░░ ──decrypt──▶ Their browser
                                ▲
                     signaling (lobby + SDP/ICE)
                                │
                         Drop server + Redis
```

## Why this exists

AirDrop is amazing Mac ↔ Mac. Offices are Mac + Windows + Linux.
Drop is the cross-platform version: open the site, see teammates, send files.

## Features

- **Office lobby** — display name + live presence
- **Tap to send** — pick a person, they Accept / Decline
- **E2E encrypted** WebRTC transfers (AES-256-GCM + Merkle integrity)
- **Resumable** chunked transfers
- **Share-link fallback** at `/send` and `/r/:roomId`
- **Optional encrypted parking** at `/park` with a blind, self-hosted maid
- Works in Chrome, Edge, Firefox, Safari on any OS

## Quick start

Prerequisites: **Node ≥ 20**, **pnpm ≥ 9**, **Redis**.

```bash
pnpm install
cp .env.example .env

# Redis (Homebrew example)
brew services start redis

pnpm dev
```

- App: http://localhost:5173
- Signaling: http://localhost:8787

To run the optional maid locally:

```bash
MAID_ACCESS_TOKEN="$(openssl rand -base64 32)" pnpm dev:maid
```

- Maid: http://localhost:8788

Open the app in two browsers (or a normal window + an incognito window),
join with different names, drop a file on one side, tap the other person.

## Monorepo

```
packages/
  shared/   wire contracts (lobby + rooms + transfer protocol)
  server/   Fastify + WebSocket signaling, Redis presence
  client/   React + Vite + Tailwind AirDrop UI
  maid/     blind encrypted temporary storage API
```

## Deploy notes

Host the client + signaling server on your office network (or VPN).
On the same LAN, WebRTC usually connects directly — very AirDrop-like.
For restrictive NAT/VPN, set `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL`.

See `DEPLOY.md` for production tips (originally from Beam; same shape).
See `deploy/oracle/README.md` for the Oracle Always Free maid.

# What this is

**Drop** is an internal office AirDrop — a small web app your team opens in a browser so anyone can send files to anyone else nearby, whether they’re on a Mac, a Windows machine, or Linux.

It exists because Apple’s AirDrop is excellent at one thing and quietly terrible at another. When both people have Macs, it feels like magic: you pick a person, the file goes, and nobody thinks about servers, USB sticks, or Slack size limits. The moment the other person is on Windows or Linux, that magic ends. You’re back to email attachments, chat uploads, shared drives, or walking a thumb drive across the room.

Drop is the version of that magic that doesn’t care what operating system the other desk is running.

---

## The problem it solves

Modern offices are mixed. Design might be on MacBooks. Engineering might be on Linux. Ops or finance might be on Windows. People still need to move screenshots, PDFs, builds, decks, recordings, and folders between each other constantly — often just across a few meters of open floor.

The usual tools are the wrong shape for that:

- **Cloud chat and email** upload everything to someone else’s computers, sit behind file-size caps, and turn a two-second handoff into a multi-step ritual.
- **Shared drives** are great for lasting documents and awful for “here, take this right now.”
- **Real AirDrop** only works in Apple’s garden.
- **USB sticks** still exist, which is somehow both funny and sad.

Drop is for the moment in between: *I have a file. You’re right there. Just take it.*

---

## What it feels like

You open the site. You type a name your teammates will recognize — “Priya · Design,” “Devan · Eng,” whatever makes sense in your office. You’re in the lobby.

Everyone else who currently has Drop open shows up as a person: a colorful orb, a name, a little device hint (Mac, Windows PC, Linux). It feels less like a form and more like looking around the room.

Then the AirDrop part:

1. Drop files into the tray (or browse for them).
2. Tap the person.
3. They get an incoming offer — what you’re sending, how big it is.
4. They hit **Accept** or **Decline**.
5. The file moves. Progress shows. Done.

No account. No “upload complete, now download.” No hunting for a Slack thread from Tuesday. Just people and files.

There’s also a classic **share-link** path if someone isn’t in the lobby: create a link, send it however you want, they open it and receive. Same underlying pipes. The lobby is just the version that feels like AirDrop.

---

## How it actually works (without the fog)

Under the hood, Drop is built on a peer-to-peer file transfer stack inspired by — and originally based on — [Beam](https://github.com/Kroszborg/beam).

### The important idea

**Your files do not get uploaded to Drop’s server.**

The server’s job is introductions, not shipping. It’s a matchmaker:

- Who’s online in the office lobby right now?
- Who tapped whom?
- Did they accept?
- Can these two browsers shake hands over WebRTC?

Once that handshake succeeds, the browsers open a direct **WebRTC DataChannel** and stream the file between each other. On a normal office Wi‑Fi, that often means the bytes travel across the local network — fast, local, and privately enough for day-to-day internal use.

### Encryption and integrity

Before anything leaves the sender’s browser, the file is encrypted there (AES-256-GCM). It’s sent in chunks. Those chunks are hashed and checked with a Merkle tree so the receiver can tell if anything arrived wrong, incomplete, or tampered with. Transfers can resume if a connection blips instead of restarting from zero like a cursed progress bar from 2009.

So even though the signaling server helps people find each other, **it never stores your files** and never sits in the middle of the payload path once the peer connection is up.

### What “nearby” means here

This is not Bluetooth AirDrop. Browsers don’t get to scan the room with radios the way Apple’s stack does.

In Drop, “nearby” means **online in the office Drop right now** — people who opened the same internal site and joined the lobby. In practice, for a team on the same floor or VPN, that’s the useful definition. You see who’s available to receive, not every laptop that happens to be powered on in the building.

That’s a tradeoff worth naming honestly: both people need the site open (or kept as a tab / installed-style PWA). It won’t catch a locked laptop in a bag the way system AirDrop sometimes can. In exchange, it works across operating systems and only needs a modern browser.

---

## Who it’s for

Drop is for a team that already knows each other — an office, a studio, a small company floor, a coworking pod that wants something nicer than “email me that.”

It’s especially good when:

- You mix Mac / Windows / Linux every day
- You constantly pass mid-size files around
- You don’t want every casual handoff to become a cloud artifact
- You want something that feels obvious to non-engineers: open page → see people → send

It’s not trying to replace your document system of record. It’s trying to replace the awkward five minutes between “I have it” and “you have it.”

---

## What it is not

A few boundaries, so nobody gets the wrong mental model:

- **Not Apple AirDrop.** No system tray, no Bluetooth discovery, no OS integration. It’s a web app that *behaves* like AirDrop for an office.
- **Not a cloud drive.** Nothing is meant to live on the server. If both tabs close mid-thought, there’s no magical archive of the file waiting in Drop.
- **Not anonymous public file sharing for the internet at large.** The lobby assumes an internal deployment — your office URL, your network, your people.
- **Not a guarantee against every network.** Same Wi‑Fi / LAN is the happy path. Weird corporate NAT or locked-down VPNs may need a TURN server so WebRTC can still punch through. The app can be configured for that; it’s optional until you need it.

---

## The shape of the project

This repo is a small monorepo:

- **Client** — the polished React app people actually open: lobby, orbs, accept/decline, progress, the macOS-inspired glass-and-aurora UI.
- **Server** — a lightweight signaling service (plus Redis for ephemeral presence and rooms). It brokers presence and WebRTC handshake messages.
- **Shared contracts** — the typed language both sides speak: lobby events, transfer offers, room signaling, the transfer protocol.

The visual language is intentional: soft aurora color like a Sonoma wallpaper, frosted panels, person-orbs instead of spreadsheets of users. The point is not “another internal tool with a sidebar.” The point is that sending a file across the office should feel light.

---

## How to think about trust

For link-based sends, the decryption key rides in the URL fragment (the `#...` part), which browsers don’t send to servers in normal navigation. That’s the stricter “keys never touch the backend” model.

For the lobby tap-to-send flow, the offer has to tell the other person enough to join the transfer — including the session key — through the signaling channel. In an **internal office** deployment, that’s a deliberate convenience trade: the signaling box is yours, the files still move peer-to-peer and encrypted, and teammates aren’t forced to paste links at each other all day.

If you deploy this, treat the signaling server like any other internal service: on your network or VPN, not casually exposed to the whole internet without thinking about it.

---

## The short version

Drop is what you wish AirDrop was at work:

**Open the page. See your people. Send the file. Mac, Windows, Linux — same gesture.**

It’s a small product on a serious peer-to-peer pipe: encrypted in the browser, delivered device to device, introduced by a server that never needed to hold the file in the first place.

That’s what this is.

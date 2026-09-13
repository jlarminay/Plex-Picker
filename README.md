# Plex Picker

A Vue + TypeScript dashboard for connecting to your Plex account, indexing your movie libraries, exploring metadata, and picking a random movie.

This is a **frontend-only app** — no backend server. Your browser talks directly to `plex.tv` (for sign-in and server discovery) and to your Plex Media Server itself (for the library), the same way the official `app.plex.tv` web client does. Nothing runs on your machine besides the static site.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and click **Sign in with Plex**. A plex.tv tab opens for you to approve access — no password ever touches this app. Once approved, the browser:

1. Asks plex.tv (`/api/v2/resources`) which Plex Media Servers your account can see.
2. Picks a reachable connection to that server — a direct remote connection if your network allows it, otherwise Plex's own relay tunnel, falling back to a local address last.
3. Indexes every library whose section type is `movie`.

Because step 2 goes through Plex's own remote-access/relay network instead of a hardcoded local URL, this works from anywhere your Plex server itself has remote access enabled (Settings → Remote Access, in Plex) — no VPN or port-forwarding setup in this app is required.

## Where things are stored

Everything lives in the browser's `localStorage`, scoped to whatever origin the app is served from:

- **Session** (`plex-picker:session`) — your plex.tv account token, account info, and the resolved server connection. There's no server-side session file anymore, so this token is readable by any JavaScript running on the page — a real tradeoff of going backend-less, worth keeping in mind if this is ever deployed somewhere less trusted than your own device.
- **Movie library cache** (`plex-picker:movies:<server id>`) — the indexed library, so reopening the app doesn't re-index every time. Use **Refresh library** (in the account menu) to force a live re-index after adding movies in Plex.

Click **Sign out** to clear the session (the library cache is left in place so a future sign-in to the same server loads instantly).

## Manual connection (fallback)

If plex.tv discovery can't reach your server (e.g. relay is disabled and there's no direct remote connection), use "Connect manually instead" on the sign-in screen and paste a directly reachable server URL and an `X-Plex-Token`.

## Deploying

Since it's a static site, `npm run build` produces a `dist/` folder you can host anywhere — Netlify, GitHub Pages, S3, or just `npm run preview` locally. There's no process to keep running; the app works as long as your Plex server has remote access enabled.

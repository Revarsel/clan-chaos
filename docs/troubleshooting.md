# Troubleshooting

## The page doesn't load on a phone
- Use the **computer's LAN address**, not `localhost`: `http://192.168.x.x:3000`. The server prints its addresses at startup.
- Phone and computer must be on the **same Wi-Fi network**. Guest networks and "client isolation" settings block device-to-device traffic.
- Allow Node.js through the computer's firewall on private networks (Windows: see `setup.md`). Ports **3000** (web) and **4000** (game server) must both be reachable.

## The home page says "Server: unreachable"
The page loaded, but the browser can't reach the game server on port 4000 of that same address.
- Is `pnpm dev` (or `pnpm start`) still running? Check `http://<address>:4000/health` from the same device; it should show `{"ok":true,...}`.
- Port 4000 blocked by a firewall (the most common cause when port 3000 works).
- You changed `SERVER_PORT`: create `apps/web/.env.local` with `NEXT_PUBLIC_SERVER_URL=http://<address>:<port>` and restart the web app (rebuild for a production build).

## Server won't start: database error
The server refuses to start if PostgreSQL isn't reachable (it never silently falls back to memory).
- Is PostgreSQL running? (`pg_isready`, or start the service.)
- Does `DATABASE_URL` in `.env` match your user, password, port and database?
- Did you run `pnpm db:migrate`?
- To play without a database for now: `PERSISTENCE=off pnpm dev` (results will not be stored).

## `pnpm db:migrate:dev` fails with a permission error
Development migrations use a temporary shadow database, so the PostgreSQL role needs `CREATEDB` (`ALTER USER clanchaos CREATEDB;`). `pnpm db:migrate` (deploy) doesn't need it.

## "Cannot find module '@prisma/client'" / "did not initialize yet"
Run `pnpm install` (it generates the client) or `pnpm db:generate`.

## `EADDRINUSE` (port already in use)
Another process is using 3000 or 4000. Stop it, or change `SERVER_PORT` (and set `NEXT_PUBLIC_SERVER_URL` as above). For the web port, change `-p 3000` in `apps/web/package.json`.

## "tsx: --env-file not supported" / unknown option
Use Node.js 20.6 or newer (22 is tested).

## A player gets "Too many requests, slow down" when joining
Room creation/joining is limited to 20 per minute per IP address. Wait a minute. Many players behind one shared address count together.

## A player is stuck on "Reconnecting to room…"
The server could be unreachable (check the connection badge), or the room no longer exists, in which case the saved session is cleared and the join form or an error appears. After a **server restart** all rooms and matches are gone; create a new room.

## The match disappeared after I restarted the server
Expected. Live matches are in memory only (see `database.md`). The interrupted match is marked `abandoned` in the database.

## "Copy link" doesn't copy
Browsers restrict the clipboard on plain `http://` pages. The game shows a prompt with the link instead; copy it from there or just read out the room code.

## Safari: my clan was lost after closing the tab
Private browsing clears `localStorage`, which holds the reconnect token. Use a normal tab.

## A test fails once and passes on re-run
The socket integration tests use real timers with short phases; a heavily loaded machine can make one flaky. Re-run it. If it fails consistently, treat it as a real failure.

## Everything looks stale or half-updated after pulling changes
Run `pnpm install` (dependencies and Prisma client), `pnpm db:migrate` (new migrations), then restart `pnpm dev`. For the web app, delete `apps/web/.next` if the dev server misbehaves.

# Setup

## Prerequisites
- Node.js 20 or later (tested on 22)
- pnpm 9 or later: `npm i -g pnpm` or `corepack enable`
- PostgreSQL 14 or later (tested on 16)

## 1. Database
### Windows
1. Install PostgreSQL from https://www.postgresql.org/download/windows/ (the EDB installer). Keep port 5432 and remember the `postgres` password.
2. Open **SQL Shell (psql)** and run:
   ```sql
   CREATE USER clanchaos WITH PASSWORD 'clanchaos' CREATEDB;
   CREATE DATABASE clanchaos OWNER clanchaos;
   ```
### macOS / Linux
```bash
sudo -u postgres psql -c "CREATE USER clanchaos WITH PASSWORD 'clanchaos' CREATEDB;"
sudo -u postgres createdb -O clanchaos clanchaos
```
Docker alternative: `docker run -d --name clanchaos-db -e POSTGRES_USER=clanchaos -e POSTGRES_PASSWORD=clanchaos -p 5432:5432 postgres:16`

## 2. Install and migrate
```bash
pnpm install
cp .env.example .env        # Windows: copy .env.example .env
pnpm db:migrate
pnpm db:seed                # optional: checks the connection
```

## 3. Run
```bash
pnpm dev                    # development: server on :4000, web on :3000
# or
pnpm build && pnpm start    # production build
```
Open http://localhost:3000.

## Playing over Wi-Fi
- The server and web app listen on `0.0.0.0`. At startup the server prints its LAN address, for example `192.168.1.20`.
- Other devices open `http://192.168.1.20:3000`. The web app automatically connects to port 4000 on the same host. Set `NEXT_PUBLIC_SERVER_URL` to override this.
- **Windows firewall:** allow Node.js on *Private* networks when prompted, or run in an admin PowerShell:
  ```powershell
  New-NetFirewallRule -DisplayName "Clan Chaos" -Direction Inbound -Protocol TCP -LocalPort 3000,4000 -Action Allow -Profile Private
  ```
  Keep your Wi-Fi network profile set to *Private*. Don't open these ports on public networks.
- To restrict who can connect, set `CORS_ORIGINS=http://192.168.1.20:3000`. To bind the game server to one interface, set `SERVER_HOST`.
- Copying the room link uses the browser clipboard. Over plain http on a LAN, some browsers block the clipboard, and the game falls back to a prompt.

## Tests
```bash
pnpm test               # everything (the PostgreSQL test runs when DATABASE_URL is set)
SKIP_DB_TESTS=1 pnpm test
```
Note: the persistence test runs the server's start-up step, which marks any `in_progress` match rows as `abandoned`. Don't run it against a database used by a live server.

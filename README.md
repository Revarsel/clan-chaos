# Clan Chaos v1.2

A 2–8 player real-time multiplayer browser strategy and deception game. Gather resources, build a fort, buy tactical cards, trade, scheme, and launch secret raids. Each player uses their own phone or computer. A match lasts about 10 minutes.

## Quick start

Prerequisites: Node.js 20+ (22 tested), pnpm 9+, and PostgreSQL 14+ (16 tested).

```bash
pnpm install                 # installs everything and generates the Prisma client
cp .env.example .env         # then edit DATABASE_URL if needed
pnpm db:migrate              # applies the Prisma migrations
pnpm dev                     # game server :4000 and web app :3000
```

Open http://localhost:3000. Other devices on the same Wi-Fi can open `http://<your-LAN-IP>:3000`. The server prints your LAN addresses when it starts. See [docs/setup.md](docs/setup.md) for Windows, PostgreSQL and firewall setup.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the game server and the web app (development mode) |
| `pnpm build` then `pnpm start` | Production build and start |
| `pnpm test` | Run all tests (unit, integration, simulation) |
| `pnpm test:unit` / `test:integration` / `test:simulation` | Run one test suite |
| `pnpm lint` / `pnpm typecheck` | Run ESLint / strict TypeScript checks |
| `pnpm check` | Lint, typecheck and run all tests |
| `pnpm db:migrate` / `pnpm db:seed` | Apply migrations / print a database summary |

## Layout

```
apps/web               Next.js 14 client (UI only; no game rules)
apps/server            Socket.IO server: rooms, match runners, persistence
packages/shared        Types, Zod schemas, socket protocol
packages/game-content  Data: cards, clans, events, map, balance config
packages/game-engine   Pure TypeScript rules engine (authoritative)
prisma/                Schema, migrations, seed script
tests/                 unit / integration / simulation
docs/                  Rules, architecture, protocol, cards, balance, setup
```

See [docs/](docs) for the full rules and design notes, and [CHECKLIST.md](CHECKLIST.md) for implementation status and known limitations.

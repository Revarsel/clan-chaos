# Clan Chaos v1.2

A 2–8 player real-time multiplayer browser strategy and deception game. Lead a rival clan: gather resources with travelling parties, fortify your stronghold, buy tactical cards, trade and bargain, and send **secret raids** that are all revealed at the same moment. Everyone plays on their own phone or computer, and a match takes about ten minutes.

- No accounts: pick a guest name and share a six-character room code.
- The server is authoritative; the browser only sends commands and displays what it is told.
- Original SVG art, no remote assets, no hosted services. It's self-hosted Node.js + PostgreSQL.

## Quick start

Requirements: Node.js 20+ (22 tested), pnpm 9+, PostgreSQL 14+ (16 tested).

```bash
git clone https://github.com/Revarsel/clan-chaos.git && cd clan-chaos
pnpm install                 # installs everything and generates the Prisma client
cp .env.example .env         # edit DATABASE_URL if yours differs
pnpm db:migrate              # creates the tables
pnpm dev                     # game server :4000 + web app :3000
```

Open <http://localhost:3000>. To play with phones on the same Wi-Fi, open `http://<your-computer's-LAN-IP>:3000` (the server prints it at start-up). Database creation, Windows steps and firewall settings are in [docs/setup.md](docs/setup.md).

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Server and web app in development mode |
| `pnpm build` then `pnpm start` | Production build and run |
| `pnpm test` | All 140 tests (unit, integration, simulation) |
| `pnpm test:unit` / `test:integration` / `test:simulation` | One suite |
| `pnpm lint` / `pnpm typecheck` | ESLint / strict TypeScript |
| `pnpm check` | Lint + typecheck + tests |
| `pnpm db:migrate` / `db:seed` / `db:generate` | Apply migrations / check the database / regenerate the Prisma client |
| `pnpm docs:cards` | Regenerate `docs/card_reference.md` from the card data |

## What's inside

```
apps/server            Socket.IO game server: rooms, matches, persistence
apps/web               Next.js client (UI only; no game rules)
packages/shared        Types, Zod schemas, socket protocol
packages/game-content  Data: cards, clans, events, map, balance numbers
packages/game-engine   Pure TypeScript rules engine
prisma/                Database schema and migrations
tests/                 unit · integration · simulation
docs/                  Documentation
```

## Status

Everything in the v1.2 specification is implemented: lobby and reconnectable identities, the illustrated map with gathering parties, the economy, all 22 cards, all 4 clan abilities, secret simultaneous raids, trading and chat, random events, upkeep, elimination and spectating, scoring with tie-breakers, results, rematch, and results stored in PostgreSQL. It is verified by 140 automated tests and by a full browser playthrough on desktop and phone-sized screens. New players get a six-card intro and a guided practice tutorial against a bot (`/practice`).

Known limitations: live matches are held in memory (a server restart ends them; there is no crash recovery), the connection is plain HTTP intended for a trusted network, and it hasn't been tested on physical phones. Full details in [docs/features.md](docs/features.md) and [CHECKLIST.md](CHECKLIST.md).

## Documentation

Start at the index, **[docs/README.md](docs/README.md)**. Highlights: [Player guide](docs/player_guide.md) · [Rules](docs/rules.md) · [Project structure](docs/project_structure.md) · [How it works](docs/how_it_works.md) · [Developer guide](docs/developer_guide.md) · [Troubleshooting](docs/troubleshooting.md).

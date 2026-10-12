# Project Structure

Clan Chaos is a **pnpm workspace monorepo** with three libraries (`packages/*`) and two applications (`apps/*`).

```
clan-chaos/
├── apps/
│   ├── server/                  Node.js + Socket.IO game server
│   │   └── src/
│   │       ├── main.ts          Process entry point: loads config, starts the server, prints LAN addresses
│   │       ├── index.ts         startGameServer(): HTTP /health + Socket.IO + RoomManager wiring
│   │       ├── config.ts        Reads environment variables into a typed ServerConfig
│   │       ├── socket/
│   │       │   └── handlers.ts  Every Socket.IO event: Zod validation, auth, rate limits, acks, broadcasts
│   │       ├── rooms/
│   │       │   └── RoomManager.ts   Rooms, lobby, identities, reconnect tokens, host handover, start/rematch
│   │       ├── matches/
│   │       │   └── MatchRunner.ts   One live match: 200 ms tick loop, command entry point, persistence queue
│   │       ├── persistence/
│   │       │   └── persistence.ts   Persistence interface, Prisma/PostgreSQL implementation, explicit no-op mode
│   │       └── services/
│   │           ├── tokens.ts    Token/ID/room-code generation and hashing
│   │           └── rateLimit.ts Sliding-window rate limiter
│   └── web/                     Next.js 14 (App Router) client
│       ├── app/
│       │   ├── layout.tsx       Root layout, viewport and metadata
│       │   ├── page.tsx         Home: create / join room, how-to-play
│       │   └── room/[code]/page.tsx   Room page (hands off to RoomClient)
│       ├── components/
│       │   ├── RoomClient.tsx   Chooses the screen: join form, lobby, game, results
│       │   ├── Lobby.tsx        Room code, players, clan picker, ready, host controls
│       │   ├── Logo.tsx, Toasts.tsx, ConnectionBadge.tsx
│       │   └── game/            In-match UI (map, panels, overlays; see docs/frontend.md)
│       ├── hooks/useGame.tsx    GameProvider: socket connection, session resume, state, command sending
│       ├── lib/                 socket/session/format, plus display logic: phaseInfo, availability, cardInfo,
│       │                        resourceInfo, raidPlan, resolutionText, objective, feed (unit-tested)
│       ├── styles/globals.css   Tailwind layers and shared component classes
│       └── tailwind.config.ts   Custom theme (parchment, bark, moss, ember, royal, gold)
├── packages/
│   ├── shared/src/              Contracts shared by client and server
│   │   ├── types.ts             Core domain types and ID lists (resources, clans, cards, events, phases)
│   │   ├── phases.ts            COMMAND_PHASES: which phases accept each command (enforced by the engine, read by the UI)
│   │   ├── commands.ts          Zod schemas: gameplay commands, room/lobby payloads
│   │   ├── views.ts             PlayerView: the per-player projection sent to clients
│   │   ├── protocol.ts          Typed Socket.IO events, ack and error types, LobbyState
│   │   └── resources.ts         Small resource helpers
│   ├── game-content/src/        Data only; no logic
│   │   ├── config.ts            MatchConfig defaults, action COSTS, ACTION_VALUES, SCORING
│   │   ├── cards.ts             The 22 card definitions
│   │   ├── clans.ts             The 4 clans and their abilities
│   │   ├── events.ts            The 6 random events
│   │   └── map.ts               Map size, 7 locations, 8 stronghold slots, player colours
│   └── game-engine/src/         The rules. Pure TypeScript with no I/O
│       ├── state.ts             MatchState and related types
│       ├── create.ts            createMatch(): deck, seats, starting kit, parties
│       ├── commands.ts          applyCommand(): validation, idempotency, rollback, all player actions
│       ├── gathering.ts         Party state machine, stock reservation/regeneration, yields, ambush interception
│       ├── raids.ts             Raid ordering and resolution, card effects, theft, damage, scoring
│       ├── round.ts             tick(), phase machine, upkeep, events, truces, match end, results, tie-breaks
│       ├── view.ts              buildPlayerView(): the only place state is turned into client data
│       ├── preview.ts           Pure raid-strength helpers shared by resolution and the client preview
│       ├── helpers.ts           RuleError, payment, storage caps, drawing cards, scoring, logging
│       └── rng.ts               Seeded deterministic random number generator
├── prisma/
│   ├── schema.prisma            Database schema
│   ├── migrations/              SQL migrations (init)
│   └── seed.mts                 Connection/summary check (the game needs no seed data)
├── tests/
│   ├── helpers.ts               Match-building and phase-advancing helpers for tests
│   ├── unit/                    Engine rules (economy, gathering, raids, cards, clans/events/scoring)
│   ├── integration/             Real Socket.IO clients against a real server; PostgreSQL persistence test
│   └── simulation/              Randomised full-match simulations with invariant checks
├── docs/                        This documentation
├── scripts/                     Developer scripts (card reference generator)
├── .env.example                 Environment template
├── package.json, pnpm-workspace.yaml
├── tsconfig.base.json           Strict TypeScript settings shared by everything
├── tsconfig.json                Type-checks packages, server, tests (path aliases to package sources)
├── vitest.config.ts             Test runner config (aliases workspace packages to their sources)
├── eslint.config.mjs            ESLint (typescript-eslint, no-explicit-any)
├── README.md, CHECKLIST.md
```

## Dependency rules

```
shared  ◀──  game-content  ◀──  game-engine  ◀──  apps/server
   ▲               ▲               ▲ (pure preview helpers only)
   └───────────────┴───────────────┴────────────  apps/web
```

- `shared` depends on nothing but `zod`.
- `game-content` depends on `shared`.
- `game-engine` depends on `shared` and `game-content`. It never imports Node, React, Socket.IO, or Prisma.
- `apps/server` depends on all three libraries plus Socket.IO and Prisma.
- `apps/web` depends on `shared` and `game-content`, and imports only **pure helper functions** from `game-engine` (raid preview, travel time) so previews use exactly the server's maths. It never creates or mutates match state; the server stays authoritative.

## Source-level conventions
- Workspace packages are consumed as **TypeScript source** (`"main": "src/index.ts"`); there is no separate build step for them. Next.js compiles them via `transpilePackages`, the server runs them with `tsx`, and Vitest aliases them directly.
- Imports inside packages use `.js` specifiers (NodeNext style) that resolve to `.ts` files. `next.config.mjs` adds an `extensionAlias` so webpack understands this.
- TypeScript is `strict` with `noUncheckedIndexedAccess`. ESLint forbids `any`.
- Domain constants (card IDs, resource types, clan IDs, event IDs) are declared once in `packages/shared/src/types.ts` and everything else is derived from them.

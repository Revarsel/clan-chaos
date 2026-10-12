# Configuration

## Environment variables
Defined in `.env` (copy `.env.example`). The server loads the root `.env` through `tsx --env-file`.

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | none; required | PostgreSQL connection string used by Prisma and the server |
| `SERVER_HOST` | `0.0.0.0` | Address the game server binds to. `0.0.0.0` = all network interfaces (needed for phones). `127.0.0.1` = this computer only |
| `SERVER_PORT` | `4000` | Game server (Socket.IO + `/health`) port |
| `CORS_ORIGINS` | `*` | Allowed browser origins, comma separated. `*` allows any origin (convenient for LAN, not for the open internet) |
| `PERSISTENCE` | `on` | `off` runs without PostgreSQL; nothing is stored. Never switched on or off silently |
| `BUILD_SECONDS` | `30` | Build & Gather phase length |
| `SCHEME_SECONDS` | `30` | Scheme & Commit phase length |
| `RESOLUTION_SECONDS` | `15` | Resolution phase length |

**Web app settings.** The Next.js app reads env files only from `apps/web/`, not from the root `.env`.
- `NEXT_PUBLIC_SERVER_URL` (in `apps/web/.env.local`): where the browser connects. Default is the page's own hostname on port 4000. Fixed at build time for production builds.
- The web port is `3000`, set in `apps/web/package.json` (`dev` and `start` scripts, `-p 3000`).

## Balance and rule values
Everything numeric lives in `packages/game-content/src/config.ts` and is documented in `balance_decisions.md`. Restart the server to apply a change.

| Group | Where | Examples |
|---|---|---|
| `DEFAULT_CONFIG` (match settings) | `config.ts` | rounds (8), event rounds (3, 5, 7), event length, inactivity time (60 s), player limits, starting resources, fort and storage caps, hand size, party count and capacity, party speed, deck copies, base attack (2), steal cap (6), failed-raid penalty (2), trade-offer limit (3), defense-card limit (2), market rates, stock regeneration interval |
| `COSTS` | `config.ts` | Card, mercenary, barricade, repair, scout, growth, party-training prices |
| `ACTION_VALUES` | `config.ts` | Mercenary +2, barricade +2, repair 2, growth 1, upkeep amounts |
| `SCORING` | `config.ts` | Raid 2, fort 3, elimination 4, intact fort 2, 1 point per 5 resources |
| Map | `map.ts` | Location yields, gather times, stock and regeneration, safe/contested |
| Cards | `cards.ts` | Cost and `params` numbers per card |
| Clans / events | `clans.ts`, `events.ts` | Text and points |

`createMatch()` also accepts a partial config override (the server uses it for the three phase lengths; tests use it for short matches).

Server rate limits (`DEFAULT_RATE_LIMITS` in `socket/handlers.ts`): 20 room joins/creates/resumes per minute per IP, 5 chat messages per 5 seconds per player, 25 commands per second per socket. Tests override them through `ServerConfig.rateLimits`.

## Useful setups
- **Fast test match (about 3 minutes):** `BUILD_SECONDS=10 SCHEME_SECONDS=10 RESOLUTION_SECONDS=5 pnpm dev`
- **No database (nothing stored):** `PERSISTENCE=off pnpm dev`
- **This computer only:** `SERVER_HOST=127.0.0.1`

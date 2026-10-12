# Database

PostgreSQL via Prisma. Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations/`.

## What is stored, and when
| Table | Written | Contents |
|---|---|---|
| `GuestSession` | When a player joins or creates a room | Player id, name, room code, **SHA-256 hash** of the reconnect token (never the token), created/expiry/last-seen times |
| `Match` | When a match starts; updated at the end | Match id, room code, status (`in_progress`, `finished`, `abandoned`), random seed, the full match config (JSON), player count, start/end time, end reason |
| `MatchParticipant` | When a match starts | One row per player: name, clan, seat, link to the guest session |
| `MatchEvent` | During the match | Public history: `raids_resolved` (all raid results of a round) and `round_end`, one of each per round |
| `MatchSnapshot` | At the end of each round and at match end | Full authoritative state as JSON (debug information; secrets included, so treat the table as private) |
| `MatchResult` | When the match finishes | One row per player: rank, score, winner flag, eliminated flag, raids won, resources, fort, and the score breakdown (JSON) |

A completed 8-round match produces 1 `Match`, N participants, N results, 16 events and 8 snapshots.

## Persistence strategy
- The live match is held in server memory, and **memory is authoritative**. The database is a record, not the source of truth.
- Writes happen on a background queue per match; a failed write is logged and does not affect the game.
- **After a server restart** all live matches are lost. On startup the server marks every `in_progress` match as `abandoned`. Players' saved tokens no longer match any room, so their browsers return to the join form. Crash recovery is **not** supported, and the snapshots are not used to restore matches.
- `GuestSession.expiresAt` is recorded (24 hours) but not enforced, and old sessions are not cleaned up automatically. A session is only usable while its in-memory room exists.
- Chat is not stored.

## Commands
```bash
pnpm db:migrate        # apply migrations (prisma migrate deploy)
pnpm db:migrate:dev    # create a new migration after editing schema.prisma (development only)
pnpm db:generate       # regenerate the Prisma client
pnpm db:seed           # check the connection and print a summary (the game needs no seed data)
npx prisma studio      # browse the data in a web UI
```

## Handy queries
Table and column names are case-sensitive, so quote them.
```sql
-- Recent matches
SELECT "roomCode", status, "playerCount", "startedAt", "endedReason"
FROM "Match" ORDER BY "startedAt" DESC LIMIT 10;

-- Standings of one match
SELECT rank, name, clan, score, "successfulRaids", "isWinner"
FROM "MatchResult" WHERE "matchId" = '<match id>' ORDER BY rank;

-- Wins per clan
SELECT clan, count(*) AS played, count(*) FILTER (WHERE "isWinner") AS wins
FROM "MatchResult" GROUP BY clan ORDER BY wins DESC;

-- What happened in a round
SELECT round, kind, payload FROM "MatchEvent" WHERE "matchId" = '<match id>' ORDER BY id;
```

## Changing the schema
1. Edit `prisma/schema.prisma`.
2. `pnpm db:migrate:dev --name <what_changed>` creates and applies a migration (needs a role that can create databases, `CREATEDB`).
3. Commit the new folder under `prisma/migrations/`.
4. Other environments apply it with `pnpm db:migrate`.

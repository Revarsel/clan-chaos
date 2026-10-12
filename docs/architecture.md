# Architecture

```
browser (Next.js) ──Socket.IO──▶ apps/server ──▶ packages/game-engine (pure TS)
                                     │                  ▲
                                     └──▶ PostgreSQL     └── packages/game-content (data)
                                          (Prisma)
packages/shared: types, Zod schemas and socket contracts used by both sides
```

## Separation of concerns
- **game-engine** has no I/O, React, sockets or database code. Its public API:
  - `createMatch`
  - `applyCommand(state, playerId, commandId, cmd, now)`
  - `tick(state, now)`
  - `buildPlayerView(state, playerId, now)`

  All time is passed in as `now`, so tests control the clock. Randomness comes from a seeded mulberry32 generator whose state is stored on the match, which makes matches deterministic.
- **game-content** holds data only: cards (with numeric `params`), clans, events, map nodes and balance configuration. The engine's effect handlers read these values instead of hard-coding them.
- **server** handles rooms and lobby (`RoomManager`), one `MatchRunner` per match, socket handlers (Zod validation, authorization, rate limits) and persistence.
- **web** renders only `PlayerView`s. Every button sends a command, and the server decides what happens. Display logic (phase explanations, "why unavailable" reasons, raid previews) reads the player's own view plus shared rule data: `COMMAND_PHASES` (the same table the engine enforces) and pure engine helpers for previews.

## Authority and consistency
- **Serialized commands:** each match's commands and ticks run synchronously on Node's single thread inside `MatchRunner`, so two commands for the same match can never interleave. Before applying a command, the runner first advances the match to the current time.
- **Atomic commands:** each command is validated against phase, ownership, costs and limits. The engine snapshots state before running a command. If the command throws a `RuleError`, the snapshot is restored in place, so a failed command never leaves partial changes behind.
- **Idempotency:** the result of every `(playerId, commandId)` is stored, and a duplicate returns that stored result without applying anything. The client retries with the same id.
- **Sequence numbers:** every authoritative change increments `seq`, and clients drop stale views.
- **Server-owned timers:** a 200 ms interval calls `tick()`. Phase transitions run at their exact scheduled timestamps, so a late tick still processes events in the correct order. Raids resolve inside the Scheme→Resolution transition, which happens exactly once.
- **Private views:** `buildPlayerView` builds a separate view for each player, and the server never broadcasts internal state. Tests check that other players' hands, card uids, raid orders and defenses never appear in a view.

## Persistence strategy
- Live match state is held **in memory**, and that copy is authoritative.
- PostgreSQL stores:
  - guest sessions (only a SHA-256 hash of each reconnect token, plus its expiry)
  - matches and participants
  - a public event history (`raids_resolved` and `round_end` rows for every round)
  - a debug snapshot at the end of each round
  - final results and rankings
- Database writes go through a per-match promise queue. A write failure is logged and never stops the game.
- **Server restarts:** live matches are lost. On startup, the server marks any `in_progress` matches as `abandoned`. Crash recovery from snapshots is **not** supported.
- `PERSISTENCE=off` must be set explicitly to run without a database. Tests do this. Otherwise, if PostgreSQL is unreachable the server refuses to start and prints how to fix it.

## Security notes
- Reconnect tokens are 256-bit random values, stored as SHA-256 hashes and compared in constant time. Neither a name nor a room code proves identity.
- Every socket payload is validated with Zod.
- Rate limits: room create/join/resume is limited per IP (20 per minute), chat per player (5 per 5 seconds), and game commands per socket (25 per second).
- CORS is `*` by default for LAN play. Set `CORS_ORIGINS` to lock it down.

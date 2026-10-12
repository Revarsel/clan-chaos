# How It Works

A walkthrough of the running system, from opening the page to the final scoreboard. See `architecture.md` for the design principles and `rules.md` for the game rules.

## 1. The big picture

```
 Phone / laptop browser                         Host computer
┌────────────────────────┐                ┌──────────────────────────────────────┐
│ Next.js page           │   WebSocket    │ apps/server                          │
│  useGame (state, send) │◀──────────────▶│  handlers.ts  ── validate, auth      │
│  renders PlayerView    │  Socket.IO     │  RoomManager  ── rooms, identities   │
└────────────────────────┘                │  MatchRunner  ── 200 ms tick loop    │
                                          │      │                               │
                                          │      ▼                               │
                                          │  game-engine (pure rules)            │
                                          │      │ results/events/snapshots      │
                                          │      ▼                               │
                                          │  PostgreSQL (via Prisma)             │
                                          └──────────────────────────────────────┘
```

The browser never decides anything. It sends *commands* ("send party 1 to the mine") and renders whatever *view* the server pushes back.

## 2. Room lifecycle

1. **Create or join.** The home page sends `room:create` or `room:join`. The server creates a player identity and replies with `{ roomCode, playerId, token }`. The `token` is a random 256-bit secret. The browser stores it in `localStorage` (`clanchaos:session:<CODE>`); the server stores only its SHA-256 hash.
2. **Lobby.** All players receive `lobby:state`. Players pick clans and ready up. The host (the creator, or the next connected player if the host leaves) can remove players and start the match. Starting needs at least 2 players, all connected and ready.
3. **Match.** `RoomManager.start()` creates a `MatchRunner`, which builds the initial `MatchState` using the engine's `createMatch()`, then starts the tick loop. From now on every player gets `game:state` messages.
4. **Finished.** After the last round (or when only one clan remains) the match is saved to PostgreSQL and the room status becomes `finished`. The host can press *Rematch* to return everyone to the lobby.
5. **Cleanup.** A sweeper removes rooms that nobody has been connected to for 30 minutes.

## 3. The life of one command

Example: a player taps **Buy card**.

1. `useGame.send()` creates a `commandId` (a UUID) and emits `game:command` with `{ commandId, command: { type: "buyCard" } }`.
2. `handlers.ts` looks up the sender's room and player from the socket, applies the per-socket rate limit, and validates the payload with Zod (`commandEnvelopeSchema`).
3. `MatchRunner.command()` first calls `advance()`, which moves the match forward to the present time, so a command arriving at the moment a phase changes is judged against the correct phase.
4. `applyCommand()` in the engine:
   - returns the stored result at once if `(playerId, commandId)` was already processed (**idempotency**);
   - rejects the command if the match has ended, the clan is eliminated, or the phase is Resolution;
   - takes a snapshot of the state, runs the action, and **restores the snapshot if any rule check throws**, so a rejected command never leaves a half-applied change;
   - bumps the match `seq` counter on success and stores the result.
5. The server acknowledges `{ ok: true, seq }` or `{ ok: false, code, message }`. The client shows a toast.
6. On success `MatchRunner` calls `onChange`, which builds a **separate `PlayerView` for each player** and pushes it as `game:state`.

If the acknowledgement times out, the client retries once **with the same `commandId`**. The server therefore can never apply the same action twice.

Because Node runs one piece of JavaScript at a time and `command()` and `advance()` are synchronous, commands for a match are naturally processed one after another with no race conditions.

## 4. Time and phases

- `MatchRunner` calls `tick(state, Date.now())` every 200 ms.
- A match stores `phase`, `phaseStartedAt` and `phaseEndsAt`. When `now >= phaseEndsAt`, the engine advances the phase **at the exact scheduled timestamp**, not at "now". A late tick therefore still produces the same results as a perfectly timed one, and a very late tick processes several phases in order.
- Phase order per round: `build (30s) → scheme (30s) → resolution (15s) → next round's build`. After round 8's resolution the match ends.
- Entering **resolution** runs `resolveRaids()` exactly once, then (in rounds 3, 5 and 7) announces the next event, then checks whether only one clan is left.
- Leaving **resolution** runs `endRound()`: upkeep, return of evacuated resources, discard of defense cards, reset of per-round counters, truce payouts, trade-offer expiry, event expiry, round increment, and activation of any announced event.
- The browser counts down using the server's `phaseEndsAt` plus a clock offset measured from every `game:state` (`serverNow - Date.now()`). This is display only.

## 5. Gathering

A party is a small state machine, advanced by `tickParties()`:

```
idle ──send──▶ traveling ──arrive──▶ gathering ──work done──▶ returning ──home──▶ idle
                   │                      │
                   └──recall (empty)──────┤ recall (partial load)
                                          ▼
                                       returning

gathering ──ambushed──▶ intercepted ──2 s──▶ returning (empty)
```

- Travel time is `distance / 220 map-units per second` (minimum 0.5 s).
- When a party **arrives**, the trip's yield is **reserved from the site's stock** (limited by what is left). This is why two clans cannot both get the last units.
- When the work timer ends, the reserved amount becomes the party's **load** and it walks home. On arrival the load is added to the owner's resources, capped at 100 per resource (overflow spoils).
- **Recall while gathering**: the party keeps `floor(reserved × time spent / total time)` and the rest goes back to the site's stock.
- Stock regenerates every 10 seconds. Yields depend on the site and on effects: Resource Rush and Trail Markers add, Sabotage Supplies and Food Shortage subtract (never below 1).
- The **Ancient Ruins** pick a random resource each trip, using the match's seeded random number generator.

## 6. Raid resolution

When Scheme ends, all committed raids resolve **one at a time**, so each raid sees the world left by the previous ones.

**Order.** The seat order (shuffled once at match start) is rotated by one seat every round: round 1 starts with seat 0, round 2 with seat 1, and so on.

**Stronghold raid, step by step** (`raids.ts`):

1. If the attacker and defender share a truce, the truce is marked broken by the attacker.
2. **Attack** = 2 (base) + mercenaries + each attached card's attack bonus.
3. **Fort defense** is read. *Tunnel Rats* removes up to 3 of it.
4. **Other defense** is added: barricade, Last-Minute Reinforcements, Booby Trap (first raid only), Reinforced Gates. *Decoy Caravan* then removes up to 2 of this other defense (never fort defense).
5. *Counter-Ambush* lowers the attack (3 if the attack is 6 or more, otherwise 1).
6. The raid **succeeds if attack > defense**. The barricade is used up either way; Reinforcements are used up if they were counted.
7. **On success**: the steal cap is 6 (Hit and Run: 3; Counter-Ambush halves it; Decoy Vault subtracts 3). Units are taken starting with the attacker's chosen resource, limited by the attacker's free storage. Sneaky Heist then takes up to 4 more gold. Fort damage is 1 (+2 with Battering Ram, 0 with Counter-Ambush). Points: +2 for the raid, +3 if the fort just dropped to 0, +2 Bounty Contract, +3 Bounty Board, and +4 (with elimination) if the defender now has no fort and no resources.
8. **On failure**: the attacker loses 2 gold (0 with Hit and Run), plus 2 more if a Booby Trap defeated them.

**Location ambush**: defense is the number of enemy parties currently gathering there; on success the attacker takes the parties' partial loads and the parties are sent home empty.

Every raid produces a `RaidResolutionView` (strengths, breakdown lines, cards, loot, damage, points, notes) that is shown to everybody during Resolution.

## 7. Hidden information

`view.ts` is the **only** place where match state becomes client data. `PlayerView` is built per player and contains:

| Visible to everyone | Visible only to the owner |
|---|---|
| Names, clans, colours, seats, scores, raid wins | Own hand (card uids and types) |
| Fort defense and *whether* a barricade exists | Own resources and safe reserve |
| Hand **size**, party count | Own raid order (target, cards, priority) |
| Whether a clan **has committed** a raid (not what) | Own committed defense cards |
| Connection, inactive and eliminated flags | Own trade offers (and offers made to them) |
| Party positions and statuses | Own party loads |
| Site stock *level* (rich/steady/poor/empty) | Intel reports from own scouting and cards |
| Active event, announced event, merchant card | Private log lines (own gathering, taxes, sabotage...) |
| Truces; raid results after the reveal | |

Nobody else's resources, hand, orders, or defenses are ever in the payload. Tests check this against the serialised JSON.

## 8. Disconnects and reconnecting

- A socket disconnect marks the player *disconnected* and records the time. The match keeps running and already-submitted orders resolve normally.
- After 60 seconds offline, the clan is flagged *inactive* (shown with 💤). It keeps its resources and defenses.
- On reconnect, the browser sends `room:resume` with the stored token. The server compares hashes, re-attaches the new socket to the **same player**, drops any older socket for that player, clears the offline flags, and sends the current lobby, chat, and game state.
- A wrong token or unknown room clears the saved session and shows the join form. Joining after a match has started is rejected.

## 9. Persistence

During a match everything lives in memory. A per-match promise queue writes to PostgreSQL in the background (a failed write is logged and never interrupts play). See `database.md` for what is stored and what happens after a server restart.

## 10. Determinism

All randomness (deck shuffle, seat order, event order, Ancient Ruins resource) comes from a seeded generator whose state is part of `MatchState`. The same seed and the same command stream produce the same match, which makes bugs reproducible. A test checks this.

## 11. Errors

- Rule violations throw `RuleError(code, message)` inside the engine and become `{ ok: false, code, message }` acknowledgements.
- Validation errors from Zod become `VALIDATION`. Unexpected errors are logged and returned as `INTERNAL`; they never crash the match or the server.
- Handlers always acknowledge exactly once, so the client's buttons never hang (the client also has a 6-second ack timeout).

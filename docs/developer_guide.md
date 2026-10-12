# Developer Guide

## Ground rules
1. Game rules go in `packages/game-engine`. Never in React, never in socket handlers.
2. Numbers and texts go in `packages/game-content`. The engine reads them.
3. Anything the client and server both need (types, schemas, ids) goes in `packages/shared`.
4. State changes only through `applyCommand()` / `tick()`; they must keep the engine's promises: validate first, no partial changes, no negative balances, deterministic.
5. Never put another player's private data into `buildPlayerView()` for a different viewer. Add a test if you add fields.
6. No `any`. Run `pnpm check` before committing.

## Everyday loop
```bash
pnpm dev                       # server (restarts on change) + web (hot reload)
pnpm test:unit                 # fast feedback on rules
pnpm check                     # before you commit
```
The server watches files with `tsx watch`. The packages are plain TypeScript source, so engine changes are picked up automatically by both apps.

## Recipes

### Change a balance number
Edit `packages/game-content/src/config.ts` (costs, caps, scoring), `map.ts` (yields, stock), or a card's `params` in `cards.ts`. Update `docs/balance_decisions.md` and any test that asserts the number.

### Add a card
1. Add its id to `CARD_IDS` in `packages/shared/src/types.ts`. TypeScript now demands a definition.
2. Add the definition in `packages/game-content/src/cards.ts`: category, timing (`attack`, `defense`, `instant`), slot (attack cards), target, cost, `params`, icon, text, counters.
3. Implement the effect:
   - **Attack cards:** a numeric `attack` param is applied automatically. Other effects go in `raids.ts` (use `raidUses(raid, "your_card")`).
   - **Defense cards:** committing is generic (`commitDefense`); the effect goes in `resolveStrongholdRaid` in `raids.ts`.
   - **Instant cards:** add a `case` in `playInstant()` in `engine/commands.ts` (an unknown card falls to `default` and fails).
4. UI: the hand and raid panels build from the definition (targets, slots). A card with unusual input (like Emergency Evacuation) needs a small addition in `HandPanel.tsx`.
5. Tests: add a behavioural test to `tests/unit/cards.test.ts` and call `cover("your_card")`. Update the "exactly 22 cards" test if the count changes.
6. `pnpm docs:cards` regenerates `docs/card_reference.md`.

### Add a clan
Add the id to `CLAN_IDS` (shared), a definition in `clans.ts`, and implement the rule: a starting bonus in `create.ts`, a passive in the place it applies (for example `cardBuyCost` in `commands.ts`), or an active ability as a command in `commands.ts` plus a button (see `useClanAbility` and `foxfireRetarget`). Add tests to `clans-events-scoring.test.ts`. The lobby shows the clan automatically.

### Add an event
Add the id to `EVENT_IDS` (shared) and a definition in `events.ts`. Implement activation effects in `activatePendingEvent()` (`round.ts`), and any ongoing effect where it applies (yields in `gathering.ts`, raids in `raids.ts`). Track one-time claims in `ActiveEvent.claimed`. Banners show the description automatically.

### Add a map location
Add it to `MAP_LOCATIONS` in `map.ts`. A new `LocationKind` also needs art in the `LocationArt` switch in `MapView.tsx`. Stock is initialised from the map data.

### Add a player command
1. Add a Zod schema variant in `packages/shared/src/commands.ts`, and list the phases that accept it in `COMMAND_PHASES` (`packages/shared/src/phases.ts`); TypeScript requires an entry. The engine enforces it and the UI uses it to explain availability.
2. Add a `case` in `execute()` in `packages/game-engine/src/commands.ts`: check the phase, validate everything, then pay and apply. Throw `fail(code, message)` to reject.
3. Call `send({ type: ... })` from a component.
4. Test it, including a rejection that must leave state unchanged. Note that the `switch` has no exhaustiveness check, so make sure you add the case.

### Show new information to players
Add a field to `PlayerView` (`shared/views.ts`), fill it in `engine/view.ts`, render it. Decide deliberately whether it is public or private, and extend the privacy test if it is private.

### Add a database field or table
See "Changing the schema" in `database.md`. Persistence code is in `apps/server/src/persistence/persistence.ts`.

## Debugging tips
- **Reproduce a match:** the seed is in the `Match` table and in `MatchState.rng`. Simulations show how to drive a match with scripted commands and a fake clock.
- **Inspect a round:** `MatchSnapshot.state` holds the full state at the end of each round.
- **Watch traffic:** open the browser dev tools → Network → WS to see `game:state` and `game:command` frames.
- **Health:** `GET http://localhost:4000/health` returns the room count and whether persistence is on.
- Server logs show unexpected errors (`[socket] unexpected error`) and persistence failures (`[persistence] ...`).

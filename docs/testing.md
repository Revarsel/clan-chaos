# Testing

140 automated tests, run with [Vitest](https://vitest.dev). Everything runs from the repository root.

```bash
pnpm test               # all suites (about a minute, mostly the simulations and the 8-round socket match)
pnpm test:unit          # engine rules only (under a second)
pnpm test:integration   # real Socket.IO server + PostgreSQL persistence
pnpm test:simulation    # randomised full matches
pnpm check              # lint + typecheck + all tests
npx vitest run tests/unit/cards.test.ts            # one file
npx vitest run -t "Booby Trap"                     # tests whose name matches
SKIP_DB_TESTS=1 pnpm test                          # skip the PostgreSQL test
```

## Suites
| Suite | Tests | What it proves |
|---|---|---|
| `unit/economy.test.ts` | 13 | Starting kit, every economy action and its limits, rollback on failure (no negative balances), upkeep, phase locking, idempotent commands |
| `unit/gathering.test.ts` | 10 | Full party lifecycle, capacity and storage caps, recall (partial yield, stock returned), shared contested stock, regeneration, Food Shortage, Gold Rush |
| `unit/raids.test.ts` | 14 | Order and limits of raid commitment, strict "attack > defense", theft priority, fort damage, exposed fort, barricades, elimination, last-clan-standing end, sequential simultaneous raids, rotating order, resolve-once, ambushes |
| `unit/cards.test.ts` | 28 | Each of the 22 cards' effect, cost and restriction. A final test fails if any card has no test |
| `unit/clans-events-scoring.test.ts` | 16 | The 4 clan abilities, 8-round flow and timing, event announce/activate schedule, each event, end scoring, tie-breakers, inactivity, **no private data in other players' views** |
| `unit/feed-phases-preview.test.ts` | 9 | Every command is rejected exactly outside its `COMMAND_PHASES` phases; the defense-card limit counts Last-Minute Reinforcements; action-feed entries record the real resource change, stay private where needed and never reveal a raid target early; the raid preview matches the resolved attack for every card combination |
| `unit/web-ui-helpers.test.ts` | 11 | The UI's display logic against real engine views: phase explanations, "why unavailable" reasons, card explanations for all 22 cards, raid draft → submitted → resolved status, known-vs-hidden preview that ignores hidden defenses, illegal-card reasons, resolution explanations and personal summaries, feed rows, objectives |
| `unit/practice.test.ts` | 7 | Practice mode on the real engine: seeded hand without creating cards, the virtual clock only moves when advanced, the bot only uses legal commands and its round-1 raid fails against a starting fort, a full practice match finishes, every tutorial step completes from real state when followed (party, delivery, card, Scheme, target, preview, submission, reveal, upkeep), and helper buttons pressed out of order don't break the match |
| `integration/socket.test.ts` | 18 | Real clients and a real server: rooms, invalid codes, duplicate names, host permissions, 2–8 limits, kick, late join, command validation and de-duplication, secret orders, trades, contested gathering, reconnect (good and bad token), inactivity, a full 8-round match with rematch, eliminated players, chat rate limits |
| `integration/persistence.test.ts` | 1 | A full match is saved to PostgreSQL: match, participants, results, 8 snapshots, events |
| `simulation/fullMatch.test.ts` | 13 | Random legal and illegal commands (and duplicates) in complete matches for 2, 3, 5, 8 players × 3 seeds, plus determinism. Invariants after every step: no negative or over-cap resources, fort and hand limits, scores equal their breakdown, every card in exactly one place, no leaks into other views, every match terminates |

## How the tests are built
- `tests/helpers.ts` creates matches, issues commands with unique ids, hands a specific card to a player, and moves the match to the Scheme/Resolution/next-round boundary by calling `tick()` with a chosen time. **Tests control the clock**, so unit and simulation tests don't wait in real time.
- Integration tests start the real server on a random port with very short phases (1.2 s) and a no-op persistence layer, then connect real `socket.io-client` sockets.
- Vitest aliases the workspace packages to their source files (`vitest.config.ts`), so no build is needed.

## Notes
- The PostgreSQL test needs `DATABASE_URL` (it reads the root `.env`). It starts the same persistence layer as the server, which marks any `in_progress` matches as `abandoned`, so **do not run it against a database used by a live server**. It deletes the match it creates.
- The integration tests rely on real timers; on a very slow machine you may need to re-run if a timing-based test fails once.
- Browser end-to-end scripts live in `tests/e2e/` (`first-time-player.e2e.mjs`, `post-match-feedback.e2e.mjs`, `practice-tutorial.e2e.mjs`). They are not part of `pnpm test` because Playwright isn't a project dependency; see `first_time_player_test.md` §5 for how to run them. Earlier, the UI was also verified with Playwright in headless Chromium during development: a full match (desktop and iPhone-sized windows, reconnect by reload, rematch), and a two-browser walkthrough of the gameplay HUD with 25 acceptance checks (phase banner, unavailable reasons, costs, known vs hidden combat information, order status, resolution explanation, feed, mobile layout). Those scripts are not part of the repo.

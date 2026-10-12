# Implemented Features

Status of everything in the Clan Chaos v1.2 spec. ✅ = implemented and covered by automated tests, 🟡 = implemented with a documented interpretation or a gap, ❌ = not implemented. "Tests" refer to files under `tests/`.

## Platform and setup
| Feature | Status | Notes |
|---|---|---|
| Browser play on phones and computers | 🟡 | Responsive layout; verified in headless Chromium (desktop and iPhone-13 emulation). Not tested on physical devices |
| Six-character room codes + guest names, no accounts | ✅ | `socket.test.ts` |
| 2–8 players | ✅ | Room limit and start rules tested; simulations at 2, 3, 5, 8 players |
| Server-authoritative rules | ✅ | The client only sends commands and renders views |
| Local development and Wi-Fi play | ✅ | Server binds `0.0.0.0` and prints LAN addresses; `docs/setup.md` |
| Self-hosted PostgreSQL (no hosted services) | ✅ | |
| Original artwork only | ✅ | Inline SVG map and emoji icons; no remote images |

## Lobby and identity
| Feature | Status | Notes |
|---|---|---|
| Create / join / leave rooms | ✅ | |
| Clan selection, ready status | ✅ | Changing clan clears ready |
| Host controls: start, remove player | ✅ | Host passes to another connected player if the host leaves |
| Duplicate names handled | ✅ | "Sam" → "Sam 2" |
| Clear start requirements | ✅ | Blocker list shown (needs 2+, everyone connected and ready) |
| Copy room link | ✅ | Falls back to a prompt when the clipboard is unavailable (plain http) |
| Reconnect with a secure token | ✅ | 256-bit token; only its hash is stored; the old socket is dropped |
| No late joining | ✅ | |
| Rematch / return to lobby | ✅ | Host only |

## Match flow
| Feature | Status | Notes |
|---|---|---|
| 8 rounds × (Build 30s, Scheme 30s, Resolution 15s) | ✅ | Configurable by env vars; server-owned timers |
| Public events announced after rounds 3, 5, 7 | ✅ | Announced at the end of the round, active from the next round, for 2 rounds |
| Match ends after round 8 or when one clan remains | ✅ | |
| Match never pauses for disconnects | ✅ | Orders already committed still resolve |
| Inactive after 60 s offline; resources and defenses kept | ✅ | |
| Eliminated players become spectators | ✅ | Spectator view: chat, intel, scoreboard |

## Economy
| Feature | Status | Notes |
|---|---|---|
| Starting kit (10/6/6, fort 5, 3 cards, 2 parties) | ✅ | `economy.test.ts` |
| Storage cap 100, fort max 7, hand max 7, parties max 4 | ✅ | Plus invariants checked in simulations |
| Buy card, mercenaries, barricade, repair, scout, clan growth | ✅ | Costs exactly as specified |
| Upkeep: 1 food, else 1 gold, else nothing | ✅ | |
| No negative balances / double spending | ✅ | Pay-or-throw with rollback; idempotent commands |
| Extra gathering parties | 🟡 | "Train party" action added so the 3rd/4th party is reachable |
| Trading Post market | 🟡 | 3:1 exchange (2:1 with Merchant Caravan), an interpretation |

## Map and gathering
| Feature | Status | Notes |
|---|---|---|
| Gold mines, forests, farms, ruins, trading post, strongholds | ✅ | 7 locations + 8 stronghold slots |
| Parties with visible states and positions | ✅ | idle / traveling / gathering / returning / intercepted |
| Gather duration 8–15 s, carrying capacity, stock and regeneration | ✅ | `gathering.test.ts` |
| Safe vs contested sites | ✅ | Contested sites pay more and can be ambushed |
| Recall with partial yield | ✅ | |
| Server-validated movement and delivery; no duplication of resources | ✅ | |

## Cards (22)
| Feature | Status | Notes |
|---|---|---|
| All 22 cards with real effects, costs, timing, targets, counters | ✅ | `cards.test.ts` includes a coverage test that fails if any card lacks a test |
| Shared deck, shuffle, reshuffle of discards | ✅ | 2 copies of each card (44 cards) |
| One primary + one support card per raid | ✅ | Slot rules enforced |
| Secret commitment and reveal at resolution | ✅ | |
| Data-driven definitions | ✅ | `packages/game-content/src/cards.ts` |

See `card_reference.md` for all card texts.

## Clans
| Clan | Status |
|---|---|
| Rats of the Racket (Protection Money, once per match) | ✅ |
| Iron Toads (start at fort 7) | ✅ |
| Mushroom Merchants (first card each round costs 2) | ✅ |
| Foxfire Bandits (change a raid target once) | ✅ |

## Raids and combat
| Feature | Status | Notes |
|---|---|---|
| One raid per round; stronghold or contested-location targets | ✅ | |
| Attack = 2 + mercenaries + modifiers; success only if attack > defense | ✅ | |
| Steal up to 6 (priority resource first), 1 fort damage, +2 points | ✅ | |
| Failed raid: lose 2 gold | ✅ | |
| Exposed fort (0 defense), destruction and elimination rules | ✅ | |
| Deterministic sequential resolution for simultaneous raids | ✅ | Seat order rotated each round |
| Defense: barricades, reinforcements, defense cards | ✅ | No "troops" exist (the spec defines none) |
| Secret orders never leak | ✅ | Checked on serialised views and over real sockets |

## Trade, chat, diplomacy
| Feature | Status | Notes |
|---|---|---|
| Direct trade offers, accept/reject, max 3 offers per round | ✅ | Both sides re-validated at acceptance |
| No transfers to eliminated players | ✅ | |
| Real-time chat | ✅ | Rate limited; last 200 messages kept in memory (not stored in the database) |
| Truces (Unstable Truce card) | ✅ | Betrayal allowed, forfeits the bonus |

## Events and scoring
| Feature | Status | Notes |
|---|---|---|
| Gold Rush, Food Shortage, Wandering Merchant, Bounty Board, Fort Inspection, Goblin Tax | ✅ | One-time effects are claim-tracked |
| Victory points and tie-breakers | ✅ | Every point is recorded with a reason and shown on the results screen |
| Final standings, winner, statistics, rematch | ✅ | |

## Protocol, security, persistence
| Feature | Status | Notes |
|---|---|---|
| Typed Socket.IO contracts shared by client and server | ✅ | `packages/shared` |
| Zod validation, auth, phase and cost checks, acks, idempotent command IDs | ✅ | |
| Sequence numbers; per-match serialised commands; separate view per player | ✅ | |
| Rate limits | ✅ | Joins, chat, commands |
| PostgreSQL: matches, participants, sessions, results, events, snapshots | ✅ | `docs/database.md` |
| Crash recovery of live matches | ❌ | Live state is in memory only; documented |

## Quality
| Feature | Status | Notes |
|---|---|---|
| Unit, integration and simulation tests | ✅ | 112 tests; see `testing.md` |
| Lint, strict TypeScript, production build | ✅ | |
| Browser end-to-end test in the repo | ❌ | A 3-player playthrough was run manually with Playwright during development, but the script is not part of the repository |
| Physical-device testing | ❌ | |

## Not implemented / ideas for later
- Persisting live match state for crash recovery (the snapshots already stored could be a starting point).
- A repository-owned Playwright end-to-end test.
- Sound effects and richer animations; accessibility work on the map (keyboard control, screen-reader descriptions).
- Public matchmaking, accounts, and a leaderboard page (the database already stores what is needed for a leaderboard).
- Troops as a separate unit type, if the design wants one.
- Admin tooling (watching a live match, replaying a stored match from its events).
- HTTPS support and deployment guides beyond a trusted LAN.

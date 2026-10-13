# Frontend

Next.js 14 (App Router) + React 18 + Tailwind CSS. All screens are client components. The frontend contains **no game rules**: it renders the `PlayerView` the server sends and issues commands.

## Routes
| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Home: guest name, Create Room, Join with code, server status, how to play, clan summary |
| `/room/[code]` | `app/room/[code]/page.tsx` → `RoomClient` | Everything inside a room |
| `/practice` | `app/practice/page.tsx` → `practice/PracticeClient` | Solo practice match against a bot, with the optional guided tutorial. Never connects to the game server |

`RoomClient` picks the screen from the connection and room state: **join form** (no session) → **Lobby** → **GameScreen** (match running) → **Results** (match ended). If a saved session exists it first tries to resume it.

## State management (`hooks/useGame.tsx`)
`GameProvider` (one per room page) owns the socket connection and exposes `useGame()`:
- `status`: connecting / connected / reconnecting / offline, shown by `ConnectionBadge`.
- Automatic **resume**: on every (re)connect it sends `room:resume` with the token from `localStorage` (`clanchaos:session:<CODE>`).
- `lobby`, `view` (the latest `PlayerView`), `chat`, and `toasts`.
- `send(command, successMessage?)`: adds a fresh `commandId`, waits for the ack (6 s timeout), retries once with the same id on a timeout, shows an error toast on failure.
- Stale-update guard: views with a lower `seq` than the last one are ignored. A new match resets the counter.
- `clockOffset`: `serverNow - Date.now()` from each view, used by `useNow()` so countdowns and party movement follow the server's clock.

`GameContextValue` also carries `mode` (`"live"` or `"practice"`), an optional `getNow` clock override (`useNow` uses it) and optional `practice` hooks. The game screen only uses these to report UI events to the tutorial, open a requested panel and hide Chat and Trade in practice. Every other component works the same in both modes.

`lib/socket.ts` creates the single Socket.IO client (server URL = page hostname + `:4000`, or `NEXT_PUBLIC_SERVER_URL`). `lib/session.ts` handles `localStorage` safely (it works with storage disabled, but then sessions don't survive a reload).

## Screens and components
The in-match screen is ordered by importance: **phase & deadline → immediate objective → resources & fort → map & parties → actions → cards → opponents & standings → feed, trade and chat.**

| Component | Role |
|---|---|
| `Lobby` | Room code with copy link, player cards, clan picker with ability text, ready, host Start / remove, start blockers, chat |
| `game/GameScreen` | Layout and tab routing. Desktop: map-centred with primary panels (Actions, Cards, Raid) on the right and secondary panels (Feed, Players, Trade, Chat) under the map. Phones: sticky phase banner, bottom tab bar, panels open in a bottom sheet that leaves the map usable. Also raises live notifications for new feed rows that matter to the player |
| `game/PhaseBanner` | Sticky banner: round x/8, phase name, one-sentence purpose, countdown, the next deadline, what can still be submitted, and an expandable "What can I do?" list derived from the shared `COMMAND_PHASES` table |
| `game/ObjectiveStrip` | The immediate objective plus optional suggestions computed from the player's own state (`lib/objective.ts`); "Go" buttons only navigate, never act |
| `game/ResourceHud` | Gold/materials/food with storage cap, recent gain/loss, key costs, and tap-to-open explanations (purpose, what consumes it, what you can afford, where to gather it). Fort (exposed warning), barricade, reinforcements, mercenaries, points and clan ability chips with explanations |
| `game/MapView` | Illustrated SVG map. Sites show resource icon, safe 🛡 / contested ⚔ badge and stock level; strongholds show fort, barricade, "★ YOU", idle-party count and the "raid submitted" marker. Sites, castles and your parties are keyboard-focusable buttons with labels. `MapLegend` explains the symbols |
| `game/PartiesStrip` | Always-visible pills for your parties: status, destination, countdown, load/capacity |
| `game/SelectionPanel` | Details for the selected site (yield, trip time, stock, who is gathering, send/recall your parties, plan an ambush), party (capacity, destination chooser, dispatch/recall with consequences) or stronghold (public info only, scout/trade/plan raid) |
| `game/ActionsPanel` | Economy actions with effect, cost on the button and the exact reason when unavailable; Rats ability; Wandering Merchant; market; active effects |
| `game/HandPanel` + `CardView` / `CardDetails` | Hand grouped as Play now / Defend / Raid cards, each with availability status; tapping a card opens a sheet with name, plain effect, cost, type, timing, target, when it takes effect, limits, counterplay and term explanations, plus the matching action |
| `game/RaidPanel` | Guided raid planner: Draft → Submitted → Locked → Resolved stepper; target choice; known vs hidden target info (and your latest scouting); legal card slots with reasons; mercenaries; steal priority; attack vs defense preview from public data only; cost and failure penalty; confirmation sheet; inline rejection reason; Foxfire's Change of Heart |
| `game/FeedPanel` | Chronological action feed (newest first, grouped by round, filters All / Mine / Raids / Points): what happened, who, resource changes, points, why. Private rows are marked "only you". Also holds the last round's raid results and your intel reports |
| `game/PlayersPanel` | Standings (points, raids won, fort, status), what is public vs hidden, how to win, tie-breakers, and your own points |
| `game/TradePanel` | Offers with affordability checks, informal-alliance note, truce offers |
| `game/ResolutionOverlay` | Personal summary plus one `RaidResultCard` per raid: attacker and target, revealed cards, attack and defense breakdowns, final values, why it succeeded or failed, what was stolen, fort damage, points |
| `ui/Popover`, `ui/Sheet` | Accessible tap/click popovers (no hover needed) and modal sheets |
| `RulesSummary` | One-minute plain-language rules from the rule constants: home page, join form, lobby, and the 📖 Rules sheet in the phase banner |
| `game/FeedbackForm` | Optional post-match feedback (4 questions) on the results screen, sent with `feedback:submit` |

Display logic lives in framework-free modules in `apps/web/lib/` (`phaseInfo`, `availability`, `cardInfo`, `resourceInfo`, `raidPlan`, `resolutionText`, `objective`, `feed`). They only read the player's own `PlayerView` plus shared rule data; the server still validates everything. The raid preview and trip-time estimate call pure helpers exported by the game engine (`previewStrongholdRaid`, `previewAmbush`, `travelDurationMs`), the same functions the server uses, so the preview can't drift from the real calculation.

### Onboarding and practice
| Piece | Role |
|---|---|
| `Onboarding.tsx` | `OnboardingModal` (6 topics, Back/Next/Skip, arrow keys and Escape) and `useAutoOnboarding()`, which opens it once per browser. Numbers come from the rule constants |
| `lib/practice/match.ts` | `PracticeMatch`: the real `createMatch` / `applyCommand` / `tick` / `buildPlayerView` on an isolated state with a **virtual clock** (`advance`, `advanceUntil`, `skipPhase`). Seeds the tutorial hand (Sneaky Heist, Booby Trap, Eagle-Eye Scout) by swapping with the deck, so no cards are created |
| `lib/practice/bot.ts` | "Training Dummy" (Mushroom Merchants). It sends ordinary commands through the engine and reads only public information. In round 1 it raids your stronghold with no cards, so the reveal shows a failed raid and its penalty. Later it gathers, repairs, builds barricades, hires mercenaries, and raids or ambushes when its public preview says it can win |
| `lib/practice/tutorial.ts` | The 14 tutorial steps as data: text built from the live view, `data-tour` anchors, the task, a completion test on the real view or on UI signals, and an optional helper button |
| `lib/practice/controller.ts` | Helper buttons: fast-forward to a delivery, skip to Scheme, skip to the deadline, finish the round, open a panel |
| `lib/practice/progress.ts` | `localStorage` flags `clanchaos:onboarding` and `clanchaos:tutorial` (`completed` / `skipped`) |
| `practice/PracticeProvider` | Supplies the same `GameContext` as a live room from a `PracticeMatch`, plus practice controls (pause, skip, tutorial navigation). The clock only runs when neither the player nor the tutorial holds it |
| `practice/TutorialOverlay` | Pulsing ring and arrow over the first visible anchor (with no pointer events, so the real controls stay usable), and a panel placed away from the highlight, above an open phone sheet. Back / Next (or "Skip step") / Skip tutorial / minimise |
| `practice/PracticeClient` | Start screen (name, clan, guided or free), the practice bar (pause/resume, next phase, restart tutorial, exit) and the results screen with "Practice again" |

Eliminated players (and observers) see only the **Feed, Players and Chat** panels and a "spectating" banner.

## Responsive design
- **Desktop (≥ 1024 px):** sticky phase banner; map with parties and selection details in the main column; Actions/Cards/Raid in a sticky right panel; Feed/Players/Trade/Chat under the map.
- **Phones:** the phase banner stays pinned at the top; resources scroll horizontally; map labels and markers are enlarged; a fixed bottom tab bar opens each panel in a bottom sheet (with its own countdown) that leaves the top of the screen and the map visible. The game starts scrolled to the top. Explanations open on tap.

## Look and feel
Theme tokens are in `tailwind.config.ts` (parchment, bark, moss, ember, royal, gold) and shared classes (`panel`, `btn-*`, `chip`, `input`) are in `styles/globals.css`. The map, castles, locations and icons are inline SVG and emoji, so nothing depends on remote images. Animations (pop, slide, pulse) are short and never block input.

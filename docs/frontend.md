# Frontend

Next.js 14 (App Router) + React 18 + Tailwind CSS. All screens are client components. The frontend contains **no game rules**: it renders the `PlayerView` the server sends and issues commands.

## Routes
| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Home: guest name, Create Room, Join with code, server status, how to play, clan summary |
| `/room/[code]` | `app/room/[code]/page.tsx` → `RoomClient` | Everything inside a room |

`RoomClient` picks the screen from the connection and room state: **join form** (no session) → **Lobby** → **GameScreen** (match running) → **Results** (match ended). If a saved session exists it first tries to resume it.

## State management (`hooks/useGame.tsx`)
`GameProvider` (one per room page) owns the socket connection and exposes `useGame()`:
- `status`: connecting / connected / reconnecting / offline, shown by `ConnectionBadge`.
- Automatic **resume**: on every (re)connect it sends `room:resume` with the token from `localStorage` (`clanchaos:session:<CODE>`).
- `lobby`, `view` (the latest `PlayerView`), `chat`, and `toasts`.
- `send(command, successMessage?)`: adds a fresh `commandId`, waits for the ack (6 s timeout), retries once with the same id on a timeout, shows an error toast on failure.
- Stale-update guard: views with a lower `seq` than the last one are ignored. A new match resets the counter.
- `clockOffset`: `serverNow - Date.now()` from each view, used by `useNow()` so countdowns and party movement follow the server's clock.

`lib/socket.ts` creates the single Socket.IO client (server URL = page hostname + `:4000`, or `NEXT_PUBLIC_SERVER_URL`). `lib/session.ts` handles `localStorage` safely (it works with storage disabled, but then sessions don't survive a reload).

## Screens and components
| Component | Role |
|---|---|
| `Lobby` | Room code with copy link, player cards, clan picker with ability text, ready, host Start / remove, start blockers, chat |
| `game/GameScreen` | Match layout: header (round + phase timer + connection), resource HUD, event banners, map, selection panel, tabbed side panel, resolution overlay |
| `game/PhaseTimer` | Round counter, phase name, progress bar, countdown (pulses in the last 5 s) |
| `game/ResourceHud` | Gold / materials / food (with safe reserve), fort, barricade, reinforcements, mercenaries, score, clan ability state |
| `game/MapView` | The illustrated SVG map: terrain, locations with stock badges, castles with fort values and 🧱/⚔ markers, moving parties |
| `game/SelectionPanel` | Opens when you tap a location (send/recall parties, ambush) or a stronghold (scout, trade, raid) |
| `game/ActionsPanel` | **Build** tab: buy card, mercenaries, barricade, repair, growth, train party, clan ability, merchant card, market exchange, active effects |
| `game/HandPanel` | **Cards** tab: your cards with play / commit-defense controls, committed defenses |
| `game/RaidPanel` | **Raid** tab: target, primary and support cards, False Flag decoy, steal priority, attack estimate, commit; after committing: the sealed order and Foxfire's Change of Heart |
| `game/TradePanel` | **Trade** tab: new offers, incoming/outgoing offers, truce offers |
| `game/ChatPanel` | **Chat** tab (also in the lobby) |
| `game/IntelPanel` | **Intel** tab: scouting reports and the chronicle (your visible log) |
| `game/Scoreboard` | **Score** tab and desktop sidebar: ranking, fort, raid-ready and connection icons |
| `game/ResolutionOverlay` | Reveals each raid card by card during Resolution (attack vs defense, breakdowns, loot, damage, points). Dismissable |
| `game/EventBanner` | Active event and the announced next event |
| `game/Results` | Winner, standings with "Why N points?", statistics, rematch (host) / leave |
| `Toasts` | Action confirmations and errors |

Eliminated players (and observers) see only **Chat, Intel, Score** tabs and a "spectating" banner.

## Responsive design
- **Desktop (≥ 1024 px):** the map and selection panel on the left, a 420 px tabbed side panel on the right, scoreboard under the map.
- **Phones:** one column: timer, resources, map (scales with the screen), selection panel, then the tabbed panel with a horizontally scrollable tab bar. Touch targets are buttons, the map uses tap-to-select.
- The viewport is locked to device width without zoom, and the layout uses `dvh` units so the browser toolbar doesn't clip it.

## Look and feel
Theme tokens are in `tailwind.config.ts` (parchment, bark, moss, ember, royal, gold) and shared classes (`panel`, `btn-*`, `chip`, `input`) are in `styles/globals.css`. The map, castles, locations and icons are inline SVG and emoji, so nothing depends on remote images. Animations (pop, slide, pulse) are short and never block input.

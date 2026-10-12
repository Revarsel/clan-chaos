# Usability Audit — Clan Chaos v1.2

**Status:** audit and plan only. No gameplay code was changed while producing it.
**Audited revision:** `main` @ `915aebf`.

## 0. Implementation status

The gameplay HUD and action-flow work addressed these items (see `docs/frontend.md` and `docs/features.md`):

| Item | Status |
|---|---|
| P0-2 Phases explained (purpose, deadline, what can be submitted) | Done: `PhaseBanner`, `ObjectiveStrip` |
| P0-3 Raid preview vs known defense + confirmation | Done: guided `RaidPanel` |
| P0-4 Parties visible and manageable; delivery notices | Done: `PartiesStrip`, party panel, idle badge on the map, feed notifications |
| P1-5 Disabled actions explain why | Done: `lib/availability.ts` reasons on actions, cards, trades, scouting, raid submission |
| P1-6 Personal raid summary; results re-openable | Done: overlay summary, Feed "Raid results" |
| P1-7 Scoring visible in-game | Done: Players panel, points popover, points in the feed |
| P1-8 Silent resource changes (upkeep etc.) | Done: structured feed entries incl. upkeep (log-only engine change), HUD recent-change badges |
| P1-9 Cards readable, explained, drawn card named | Done: `CardView`, `CardDetails`, feed entry "You bought a card: …" |
| P1-10 Mobile: pinned timer, scroll reset, bigger map labels/targets, no hover-only help | Done |
| P1-11 Stale raid selections; lost drafts | Done: draft lifted to `GameScreen` and sanitised; panels stay mounted |
| P2-12 Map legend; P2-13 ambush explanation; P2-15 trade affordability/expiry; P2-16 ability discoverability; P2-17 exposed-fort warning | Done |
| P3-19 Accessibility | Partly: map sites, castles and parties are labelled, keyboard-focusable buttons; popovers and sheets support Escape |
| R1 Defense-card limit bug | Fixed in the engine, with tests |
| P0-1 Rules/onboarding for link joiners; P2-14 event highlights on the map; P2-18 "while you were away" | Not done (onboarding work was paused) |

## 1. Method

- **Code inspection** of the actual implementation:
  - every client component in `apps/web` (`RoomClient`, `Lobby`, `app/page.tsx`, all of `components/game/*`, `hooks/useGame.tsx`);
  - the engine paths the UI depends on (`packages/game-engine/src/commands.ts`, `raids.ts`, `round.ts`, `gathering.ts`, `view.ts`);
  - the server room and socket code.

  Line references below are to that revision.
- **Field-usage check.** I grepped `apps/web` for every `PlayerView` field to find data the server sends that the UI never shows.
- **Measured playthrough.** A scripted "new player" (Playwright, headless Chromium) on an **iPhone 13 viewport (390×664 CSS px)** joined by a shared room link, started a 2-player match, sent a party, bought a card, committed a raid without cards and watched the Resolution. Element sizes were read with `getBoundingClientRect()`. Screenshots are in `docs/images/usability/`.
- **Engine probe.** A throw-away Vitest probe exercised the defense-card limits (R1 below). It is not committed.

Severity scale:
- **P0**: a new player cannot learn the core loop without outside help.
- **P1**: causes frequent confusion, lost resources, or mobile breakage.
- **P2**: friction or missing explanation.
- **P3**: polish or accessibility.

---

## 2. Highest-priority fixes (summary)

| # | Fix | Why |
|---|---|---|
| P0-1 | Add a rules/help drawer reachable from the join form, the lobby and the game, plus a short first-match coach | Players who join by link never see any rules (measured) |
| P0-2 | Make each phase say what is allowed now, what comes next, and what *you* still need to do | The timer only shows a label and seconds; the labels imply restrictions the engine doesn't have |
| P0-3 | Add a raid preview against *publicly known* defense, plus a confirmation step | A new player committed an attack-2 raid against a fort-5 target and lost 2 gold with no warning |
| P0-4 | Always-visible "Your parties" panel; idle parties drawn on the map; delivery notifications | Idle parties are invisible on the map and the party list only appears after tapping a site |
| P1-5 | Show why a button is disabled, inline | Disabled buttons give no reason; hints are only in `title` tooltips, which don't exist on touch screens |
| P1-6 | Personal raid summary and a re-openable "Last round" results panel | Results disappear after 15 s and can't be reviewed |
| P1-10 | Mobile: sticky timer and resource header, reset scroll on game start, bigger map hit targets and labels | Header scrolls to −390 px; map labels are 6 px tall; castles are 24×44 px |
| R1 | Engine bug: Last-Minute Reinforcements bypasses the "2 defense cards per round, no duplicates" limit | Confirmed with a probe: 4 defense cards committed in one round, 2 of them duplicates |

---

## 3. Mechanics a new player must understand, and where the UI explains them today

| Mechanic | Where the engine implements it | Where a player can learn it today | Gap |
|---|---|---|---|
| Round = Build 30 s → Scheme 30 s → Resolution 15 s, 8 rounds | `round.ts` `advancePhase` | Home "How to play" (`app/page.tsx:106`) only; phase label in `PhaseTimer.tsx:22` | No in-game explanation; link-joiners never see the home page |
| Almost every action is allowed in **both** Build and Scheme; only raids are Scheme-only; nothing is allowed in Resolution | `commands.ts` `requirePhase("build","scheme")`, `commitRaid` = `scheme`, `:60` blocks Resolution | Nowhere | Labels "Build & Gather" / "Scheme & Commit" suggest exclusive phases |
| Gathering trip: travel → work 8–15 s → return; carries ≤ 6; yield reserved from site stock on arrival | `gathering.ts` | Location panel shows "Yield N" and "⏱ Ns" (`SelectionPanel.tsx:46-53`) | Travel time, capacity, reservation, modifiers and recall rules unexplained |
| Safe vs contested sites; ambushes | `raids.ts` `resolveLocationRaid` | "Safe"/"Contested" chip; some site descriptions | No explanation of what an ambush does or how its defense is computed |
| Storage cap 100; overflow spoils | `helpers.ts addResource`, `gathering.ts deliver` | HUD `title` tooltip (`ResourceHud.tsx:14`) | Tooltip unavailable on touch |
| Upkeep 1 food / round (else 1 gold) | `round.ts:101-112` | Home page doesn't mention it; game: nowhere | Food silently drops by 1 every round (normal upkeep is not logged) |
| Fort defense vs fort level; repair vs clan growth | `commands.ts:150-162` | Button hints in Build tab | "5/5" in the HUD isn't labelled; the difference between repair and growth is subtle |
| Barricade +2 (max +4), used up by the next raid | `raids.ts` | Build-tab hint | OK, but no indication it was consumed |
| Card timing: instant / defense / raid card; primary vs support slot; costs paid on use | `commands.ts`, `cards.ts` | Card face label (`CardView.tsx`) | Slots unexplained; defense limit (2/round, no duplicates) not shown |
| Attack = 2 + mercenaries + cards; must be **strictly greater** than defense | `raids.ts` | Raid tab sentence (`RaidPanel.tsx:172`) | No comparison with the target; Tunnel Rats/Decoy Caravan not in the estimate |
| Theft: up to 6, priority resource first; fort −1; failed raid −2 gold | `raids.ts` | Partly in the Raid tab text | Steal priority unexplained; ambush (no penalty when the site is empty) misdescribed |
| Raids resolve sequentially in rotating seat order | `raids.ts raidResolutionOrder` | Nowhere | Players can't anticipate "my loot was already stolen" |
| Elimination: fort 0 **and** no resources after a successful raid | `raids.ts` | "EXPOSED" tag only | No danger warning |
| Scoring (raid +2, fort +3, elimination +4, events, end bonuses) | `raids.ts`, `round.ts endMatch` | Home page one-liner; per-player breakdown only on the Results screen | `self.scoreBreakdown` is sent every update but never rendered in-game |
| Events announced one round ahead and active for 2 rounds | `round.ts` | `EventBanner.tsx` | Good. Personal effects (Goblin Tax) only appear in the Chronicle |
| Clan ability | `commands.ts`, `create.ts` | Lobby text; HUD chip **hidden on phones** (`ResourceHud.tsx:28`) | Foxfire's ability only appears after committing a raid |
| Scouting reveals a snapshot | `commands.ts scout` | Toast "see Intel" | OK. That a report is a snapshot isn't stated |
| Trades are final; max 3 offers/round; offers expire at round end | `commands.ts`, `round.ts` | "N left this round" | Expiry and affordability not shown |

---

## 4. Prioritized problems

Each entry gives the **problem**, the **evidence**, the **recommended solution**, and the **files** likely to change.

### P0-1 — No rules or onboarding for players who join by link
- **Evidence**
  - The join form (`components/RoomClient.tsx:56-74`) contains only a name field.
  - The lobby (`components/Lobby.tsx`) has clan cards but no rules.
  - The game has no help entry point.
  - The only rules text is the home page (`app/page.tsx:106-124`).
  - Measured: `joinViaLinkShowsRules = false`, `lobbyHasRules = false`. Screenshot `a1-phone-join-via-link.png`.
  - Sharing the room link is the main invite path: the lobby's "Copy link" button.
- **Solution**
  - Extract the home "How to play" into a reusable `HowToPlay` component with short sections: phases, gathering, cards, raids, scoring.
  - Show it on the join form and in the lobby (collapsible), and in a game "❓ Rules" drawer.
  - Add an optional 5-step first-match coach, shown once and stored in `localStorage`: ① your parties → ② the Build tab → ③ Scheme: commit a raid → ④ Resolution reveal → ⑤ Score tab.
  - All text should come from `game-content` constants (costs, scoring), so it can't drift from the rules.
- **Files:** new `components/help/HowToPlay.tsx`, `components/help/RulesDrawer.tsx`, `components/help/Coach.tsx`; `RoomClient.tsx`, `Lobby.tsx`, `app/page.tsx`, `game/GameScreen.tsx`.

### P0-2 — Phases don't explain what to do, and their names mislead
- **Evidence**
  - `PhaseTimer.tsx:22` shows only `PHASE_LABEL[view.phase]` plus seconds and a bar. Nothing says what the phase allows or what follows.
  - The engine allows gathering, building, cards, trading and scouting in **both** Build and Scheme (`commands.ts` `requirePhase(state, "build", "scheme")`). Only `commitRaid` and `foxfireRetarget` are Scheme-only, and **everything** is rejected in Resolution (`commands.ts:60`).
  - During Resolution, buttons simply turn grey (`canAct` checks in `ActionsPanel`, `HandPanel`, `SelectionPanel`). Parties keep moving and upkeep happens at the end, but nothing says so.
  - The only Scheme cue is a small map overlay (`GameScreen.tsx:108-111`) and a pulsing dot on the Raid tab (`:155-157`).
- **Solution**
  - **Phase strip:** three segments with the current one highlighted, plus a one-line rule per phase:
    - Build: "Gather, build, buy and trade. Raids open next phase."
    - Scheme: "Everything from Build **plus** commit one secret raid and defenses."
    - Resolution: "Orders locked. Raids are revealed; upkeep of 1 🍖 at the end."
  - Also show "Next: Scheme in 12 s" and "Round 3/8 · event after this round".
  - **Next steps checklist** (collapsible on phones), computed only from the player's own view:
    - "2 parties idle"
    - "You haven't committed a raid (Scheme)"
    - "Food 0: upkeep will cost 1 gold"
    - "You can afford: Barricade, Card"
    - "1 trade offer waiting"
    - "Truce offer from X"
  - A short phase-change banner when Scheme starts.
- **Files:** `game/PhaseTimer.tsx`, new `game/NextSteps.tsx`, `lib/format.ts`, `game/GameScreen.tsx`.

### P0-3 — The raid planner lets a new player commit a raid that cannot win, with no confirmation
- **Evidence**
  - Screenshot `a5-phone-raid-planner.png`: "Estimated attack **2**" next to target "Hosty (fort 5)". One tap committed it, and the resolution showed `2 vs 5`, "Attacker lost 2 gold" (`a6-phone-resolution.png`).
  - The estimate (`RaidPanel.tsx:33-39`, text at `:172`) is `2 + mercenaries + card attack`. It ignores Tunnel Rats' fort bypass and Decoy Caravan, and never compares against the target's publicly visible fort value, which is already in `view.players[].fortDefense`.
  - There is no confirmation, although a raid is irreversible (`commands.ts` "You have already committed a raid this round").
  - Card options list only names (`RaidPanel.tsx:123-141`). There are no costs or effects, so the player must switch tabs to learn what a card does. Switching tabs unmounts the panel and loses the draft (see P1-11).
- **Solution**
  - **Known-defense line, public information only:** "Fort 5 (Tunnel Rats ignores 3 → 2)". Add "Barricade: yes (+2 or +4)" when `hasBarricade`, plus "+ any secret defense cards".
  - **Verdict chip:** "Cannot win: needs more than 5" when attack ≤ the visible minimum; "May win if no hidden defense" otherwise.
  - Card picker as mini-cards showing text and cost; disable unaffordable ones with the reason.
  - **Confirm sheet:** target, cards, total cost, mercenaries consumed, "Fails if attack ≤ defense: lose 2 🪙", "Cannot be changed".
  - For ambushes: "Defense = enemy parties gathering there at the deadline (now: 1). An empty site means no penalty."
  - Must **not** use or display hidden defense (see §6).
- **Files:** `game/RaidPanel.tsx`, new `lib/raidPreview.ts` (pure display helper reading `CARDS` params), `game/CardView.tsx`.

### P0-4 — Gathering parties are hard to find and manage
- **Evidence**
  - Idle parties are not drawn: `MapView.tsx:260` `.filter((p) => p.status !== "idle")`. Measured `idlePartiesDrawnOnMap = 0` at match start, so a new player sees no units at all.
  - The party list exists only inside the location panel (`SelectionPanel.tsx:68-98`), which renders nothing until a site is tapped (`:160` `return null`). Measured `selectionPanelVisibleAtStart = 0`.
  - The only hint is a footer line at the bottom of the Build tab (`ActionsPanel.tsx`, "Tip: tap a location…").
  - Party status shows "carrying N" while still *gathering*, because `view.ts:104` sends `load || reserved`. Recalling at that moment yields less than shown.
  - Deliveries are only logged privately (`gathering.ts:146`) and appear in the Intel tab's Chronicle, so income is never surfaced.
  - The trip time shown (`⏱ 8s`) excludes travel.
  - Party markers have no legend (⛏ 🎒 👣 💥) and are 11-unit SVG circles (~4 px radius on a phone).
- **Solution**
  - **"Your parties" strip** under the HUD, visible in every tab: one pill per party with status, destination, countdown and load ("🍖 3 on the way", "gathering: 3 expected").
  - Tapping an idle pill enters "choose a site" mode: sites highlight, tap to send. Recall is available on busy pills.
  - Draw idle parties as a badge on your own castle ("👣×2").
  - Toast on delivery from the private log line: "+3 🍖 delivered (Sunny Acres)".
  - In the location panel: "Round trip ≈ 14 s · yields 3 (after effects) · carries up to 6".
  - Label a gathering load "expected"; the server data can stay as is.
- **Files:** new `game/PartiesPanel.tsx`, `game/MapView.tsx`, `game/SelectionPanel.tsx`, `game/GameScreen.tsx`, `hooks/useGame.tsx` (toasts for new private log entries).

### P1-5 — Disabled or failing actions don't explain why
- **Evidence**
  - `ActionsPanel.tsx:46` disables on `!canAct || !afford(cost) || a.disabled` with no visible reason. The explanatory `hint` is also in `title`, which doesn't appear on touch screens.
  - Measured on a Toads player at start: "Repair fort" and "Clan growth" were greyed out. The only clue is the hint "(up to 7)"; nothing says "already at maximum".
  - Card Play/Commit buttons (`HandPanel.tsx:21`, `:65`) are enabled even when unaffordable. The failure then shows as an error toast that disappears after 4 s (`useGame.tsx:77`) at the top of the screen (`Toasts.tsx:7`), possibly far from the button the player just tapped.
  - Trade "Accept" (`TradePanel.tsx:111`) is enabled even when you can't pay.
- **Solution**
  - A small helper `whyDisabled(action, view)` that returns a reason: "Need 2 more 🪙", "Already at max (7)", "Raids open in Scheme", "Orders locked during Resolution", "Hand full (7/7)". Show it inline under each action, card and trade.
  - Keep server errors as the fallback, but also show the last error inline in the panel that sent the command, and keep error toasts up for ~6 s.
- **Files:** new `lib/availability.ts`, `ActionsPanel.tsx`, `HandPanel.tsx`, `SelectionPanel.tsx`, `TradePanel.tsx`, `hooks/useGame.tsx` (track last error per panel).

### P1-6 — Raid results are fleeting and impersonal
- **Evidence**
  - The overlay is visible only while `phase === "resolution" && resolutionRound === round` (`ResolutionOverlay.tsx:71`). Tapping the backdrop dismisses it for the round with no way back (`:87`).
  - The Intel tab shows only one-line log entries. Measured `intelShowsRaidBreakdown = 0`, e.g. "Newbie raided Hosty: failed (2 vs 5)".
  - The full `view.resolutions` stays available until the next Resolution (`raids.ts:332` replaces it only then), but nothing renders it.
  - Lines are written in the third person ("Attacker lost 2 gold", `ResolutionOverlay.tsx:57`). There is no summary of what happened to **you**: gold lost, fort damage, loot gained, points.
  - Breakdown terms ("Fort 5", "Base 2") are not explained.
- **Solution**
  - Personal summary at the top of the overlay: "Your raid on Hosty failed (2 vs 5): −2 🪙. Tip: you needed more than 5."
  - A "📜 Last round" section in the Intel tab reusing the `RaidCard` component, and a "Show results" button after dismissing.
  - Short glossary tooltips (tap) on breakdown terms.
- **Files:** `game/ResolutionOverlay.tsx` (export `RaidCard`), `game/IntelPanel.tsx`, `game/GameScreen.tsx`.

### P1-7 — Scoring is invisible during the match
- **Evidence**
  - `self.scoreBreakdown` is sent on every update but no in-game component reads it (grep: only `Results.tsx:47` renders breakdowns, from `results`).
  - The Score tab (`Scoreboard.tsx`) shows totals only.
  - The scoring rules appear only on the home page.
  - The tie-breakers (successful raids, resources, fort) aren't shown; `successfulRaids` is used only on the Results screen.
- **Solution**
  - Score tab with three parts:
    - "How points are earned", from `SCORING` and the event definitions;
    - "Your points so far", from `scoreBreakdown`;
    - "If the match ended now: +2 intact fort, +N for resources" (own data only).
  - Show raid wins per player (public).
- **Files:** new `game/ScorePanel.tsx` (wrapping `Scoreboard`), `game/GameScreen.tsx`.

### P1-8 — Resources change silently
- **Evidence**
  - Normal upkeep is not logged at all (`round.ts:107-111` logs only the gold fallback and Emergency Rations).
  - Deliveries, Goblin Tax, Protection Money and Sabotage are private log lines visible only in Intel → Chronicle.
  - A new player sees food drop each round, or gold vanish, with no explanation.
- **Solution**
  - Client-side "resource change feed": when new private log entries arrive, toast them or show a floating "+3 🍖 / −1 🍖 upkeep" next to the HUD.
  - Add one **log-only** engine line for normal upkeep ("Upkeep: paid 1 food"). This changes no mechanic.
  - HUD hint during Resolution: "Upkeep −1 🍖 at end of round" (red if food = 0).
- **Files:** `packages/game-engine/src/round.ts` (log line only), `hooks/useGame.tsx`, `game/ResourceHud.tsx`.

### P1-9 — Cards are hard to read and use correctly
- **Evidence**
  - Card names truncate on phones (`CardView.tsx:41` `truncate`): "Reinforce…", "Smoke an…", "Battering …" in `a4-phone-cards.png`.
  - The `counters` field of every card is never rendered (grep: no use in `apps/web`).
  - Buying a card toasts "Buy card done" (`ActionsPanel.tsx:47`) without naming the card drawn.
  - The primary/support/either slot is shown as a tiny label with no explanation.
  - The defense limit (2/round, no duplicates) isn't shown.
  - Last-Minute Reinforcements disappears from "Committed defenses" (it becomes HUD 🛡️ +2; `commands.ts:243-245`).
  - Instant targets default silently to the first rival or first site (`HandPanel.tsx:13-14`).
- **Solution**
  - Wrap card names; tap a card to open a detail sheet (full text, cost, when to use, counters).
  - Group the hand under "Play now (instant)", "Defend (commit secretly)" and "Attach to a raid (Scheme)".
  - Show "Defenses committed 1/2".
  - Toast the drawn card ("You drew Tunnel Rats 🐀"), detected by diffing hand uids.
  - Force an explicit target choice ("Choose a rival…") instead of a silent default.
- **Files:** `game/CardView.tsx`, `game/HandPanel.tsx`, `game/ActionsPanel.tsx`, `hooks/useGame.tsx`.

### P1-10 — Mobile layout problems (measured on 390×664)
- **Evidence**
  - **The timer scrolls away.** The header is not sticky (`GameScreen.tsx:76`). After scrolling to the action panels its top was at **−390 px**; the page is 1062 px tall.
  - **The game opens at the lobby's scroll position.** No `scrollTo` exists in the game code. The first game frame (`a2-phone-first-screen.png`) shows the bottom of the map and the tabs, but no timer or resources.
  - **Map legibility.** Location labels render **6 px** tall (`MapView.tsx:208`, `fontSize=13` in a 1000-unit viewBox). Stock badges are **8 px**.
  - **Tap targets.** Castle hit area is **24×44 px**. Party markers aren't tappable at all.
  - **Touch has no hover.** Explanations rely on `title` attributes (`ResourceHud.tsx:14,19,28`; `ActionsPanel` buttons). The clan-ability chip is `hidden sm:inline-flex` (`ResourceHud.tsx:28`), so phone users never see their ability in the HUD.
  - **Overlap.** Toasts at `top-2` overlay content while the user is scrolled (`a4-phone-cards.png`, covering the party rows).
  - **The Scheme notice** is drawn over the top-left castle on the map (`GameScreen.tsx:108-111`).
- **Solution**
  - Sticky compact header on phones: round, phase, seconds, and the 3 resources plus fort.
  - `window.scrollTo(0, 0)` when `GameScreen` mounts.
  - Bottom-anchored tab bar; or show the tab panel in a bottom sheet over the map.
  - Invisible enlarged hit circles (≥ 44 px) for castles and sites. On narrow screens, hide map labels and show the name on tap, or scale the label font up.
  - Replace `title` with tap-to-explain popovers; show the ability chip on phones.
  - Move toasts to the bottom on phones.
- **Files:** `game/GameScreen.tsx`, `game/PhaseTimer.tsx`, `game/ResourceHud.tsx`, `game/MapView.tsx`, `Toasts.tsx`, `styles/globals.css`.

### P1-11 — Raid and trade drafts are lost or invalid (UI state bug)
- **Evidence** (found by code reading, not reproduced in the browser)
  - **Stale card selection.** `RaidPanel.tsx:29` filters stronghold-only cards out of the options when the target is a location, but the `primary`/`support` state isn't cleared. The `<select value={primary}>` (`:123`) then holds a value with no matching option. The browser shows the first option ("None") while the hidden card is still submitted, and the server rejects it with "X only works against strongholds".
  - **Lost drafts.** `GameScreen.tsx:55-72` renders only the active tab, so switching to Cards or Intel to read something unmounts the Raid or Trade panel and loses its draft.
- **Solution**
  - Clear invalid selections in an effect whenever the target or hand changes.
  - Lift the raid and trade drafts into `GameScreen` state, or keep the panels mounted and hidden.
- **Files:** `game/RaidPanel.tsx`, `game/TradePanel.tsx`, `game/GameScreen.tsx`.

### P2-12 — The map has no legend
- **Evidence:** unexplained symbols:
  - stock badges "R/S/P/0" (`MapView.tsx:216`);
  - the dashed orange ring meaning *contested* (`:202`);
  - party icons ⛏ 🎒 👣 💥;
  - ⚔ "raid committed" on castles;
  - 🧱 barricade;
  - your own castle marked only by a faint halo (`:235`).
- **Solution:** a collapsible legend chip on the map, and a "YOU" flag on your own castle.
- **Files:** `game/MapView.tsx`, new `game/MapLegend.tsx`.

### P2-13 — Ambushes are described incorrectly
- **Evidence:**
  - The Raid tab always says "A failed raid costs 2🪙" (`RaidPanel.tsx:172-173`), but an ambush on an empty site has no penalty (`raids.ts resolveLocationRaid`).
  - Defense = number of enemy parties gathering there, which the planner doesn't show.
- **Solution:** a location-specific explanation plus the live gatherer count (public: party positions are public). See P0-3.
- **Files:** `game/RaidPanel.tsx`.

### P2-14 — Personal event effects are buried
- **Evidence:**
  - Goblin Tax and Fort Inspection results are private log lines.
  - The Bounty Board target is only text in the banner (`EventBanner.tsx:10`).
  - The Wandering Merchant card shows name and price only (`ActionsPanel.tsx`), with no text.
- **Solution:** toast personal event effects; mark the bounty target's castle with 🎯; show the merchant card as a mini-card.
- **Files:** `EventBanner.tsx`, `ActionsPanel.tsx`, `MapView.tsx`, `hooks/useGame.tsx`.

### P2-15 — Trades lack affordability and expiry information
- **Evidence:** "Accept" is enabled regardless (`TradePanel.tsx:111`). Offers silently expire at round end (`round.ts endRound`).
- **Solution:** "You can't afford this" or "Would exceed storage" inline; "Expires at end of round".
- **Files:** `game/TradePanel.tsx`.

### P2-16 — Clan abilities are hard to discover
- **Evidence:**
  - Rats' button is in the Build tab only.
  - Foxfire's Change of Heart appears only after committing a raid, inside the Raid tab.
  - Passive effects (Mushroom discount, Toads fort) aren't called out.
  - Clans are auto-assigned by join order (`RoomManager.ts:87`), so a player may start without choosing one.
- **Solution:** an ability card (HUD popover) stating when and where to use it, plus "Clan auto-assigned, tap to change" in the lobby.
- **Files:** `ResourceHud.tsx`, `Lobby.tsx`, `RaidPanel.tsx`.

### P2-17 — No danger warning before elimination
- **Evidence:** only "EXPOSED" in the HUD (`ResourceHud.tsx`).
- **Solution:** when the fort is 0, show "A successful raid that takes your last resources eliminates you. Repair (2 🪵) or barricade."
- **Files:** `ResourceHud.tsx`, `NextSteps.tsx`.

### P2-18 — Reconnecting gives no context
- **Evidence:** after `room:resume` the client receives the current view only.
- **Solution:** a "While you were away" card built from log entries since the last seen `seq`/timestamp (client-side).
- **Files:** `hooks/useGame.tsx`, new `game/AwaySummary.tsx`.

### P3-19 — Accessibility
- **Evidence:** the map is `role="img"` (`MapView.tsx:187`) containing clickable `<g>` elements with no keyboard focus or labels. Players are distinguished by colour only.
- **Solution:** make sites and castles `<button>`-like (`role="button"`, `tabIndex`, `aria-label`), add emblems next to colours, and offer a list alternative in the Score tab.

### P3-20 — Smaller items
- The truce offer text is good; add the expiry ("answer this round").
- The Results screen is good; link "How scoring works".
- Lobby: explain "Ready" ("the host can start when everyone is ready").

---

## 5. Mismatches between implementation and the documented or approved rules

These were found during the audit. **None were changed.** Only R1 is a clear implementation bug.

| ID | Kind | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| **R1** | **Bug** | Last-Minute Reinforcements is never added to `defenseCards`, so it bypasses both the "max 2 defense cards per round" limit and the "no duplicates" check documented in `docs/rules.md` and `docs/balance_decisions.md` | `commands.ts:231-249` (limit checks read `p.defenseCards`; `:243-245` sends this card straight to `reinforcementDefense`). Probe: committed LMR, LMR, Reinforced Gates, Decoy Vault in one round → all accepted, `reinforcementDefense = 4` | Track committed defense card IDs per round (including LMR) and apply the same checks. Add a unit test. Small engine fix, separate from the UI work |
| R2 | Interpretation | Booby Trap's extra −2 gold applies on any failed raid where the trap counted, even if the raid would have failed without it. The approved text says "If it **defeats** the attack" | `raids.ts:153`, `:250` | Decide whether "defeats" means "decisive". If so, apply the penalty only when attack > defense − 3. Not changed here |
| R3 | Interpretation | Approved table: "Repair fort: restore 2 defense, **up to 7**". The engine caps repair at the fort *level* (5 unless grown) | `commands.ts:152-154`; documented in `balance_decisions.md` | Confirm the interpretation. The UI label already says "(up to N)" |
| R4 | Design decision to confirm | Rivals can see **whether** a clan has committed a raid (⚔ on castles, Scoreboard, public log line), but not the target | `view.ts:23`, `commands.ts commitRaid` log | Allowed by the spec (targets and cards stay hidden). Keep, but explain it in the legend |
| R5 | Design decision to confirm | Barricade **presence** is public; its amount is not | `view.ts:15` | Keep. The raid preview must say "+2 or +4" |

---

## 6. Hidden information that must stay secret

Any new UI must use only data already present in the viewer's own `PlayerView`, and must not add new fields that expose other players' state. The table lists what must **not** be shown to other players before the reveal (or at all):

| Secret | Server source | Notes for the new UI |
|---|---|---|
| Other players' resources and safe reserve | `PlayerState.resources` (not in `PublicPlayerView`) | Score projections, "wealthiest" hints and trade affordability may use **own** resources only. The Bounty Board target is already public by design |
| Other players' hands (card types and uids) | `hand` | Only `handSize` is public |
| Raid orders: target, cards, priority, decoy, mercenaries | `state.raids` | Only `hasCommittedRaid`. "Next steps" must never hint "X is raiding you" |
| Committed defense cards and their count | `defenseCards` | The count is revealed only through the scouting report to the scout |
| Reinforcement and barricade **amounts** | `reinforcementDefense`, `barricadeDefense` | The raid preview may show "barricade present (+2 or +4)" and "+ unknown secret defenses" only |
| Party loads of other players | `view.ts:104` sends `null` | The parties strip must show loads only for your own parties |
| Intel reports and private log lines | `state.intel`, `log.visibleTo` | The resource-change feed must use only the entries already filtered for the viewer |
| Active private effects (Counter-Intel, Sabotage on self, Merchant Caravan…) | `self.effects` | Own only |
| Trade offers between other players | filtered in `view.ts` | — |

Already public by design: positions and statuses of all parties, site stock *levels*, fort defense, the barricade flag, hand size, scores, Bounty Contract and truce announcements, and all raid results after the reveal.

The existing privacy tests (`tests/unit/clans-events-scoring.test.ts` "player views never include…", and the socket secrecy test) must keep passing. New tests should assert that the raid-preview DOM never contains a target's defense card names before the reveal.

---

## 7. Interactions that are especially difficult on mobile

1. Seeing the timer while acting: the header scrolls off (P1-10).
2. Starting the match mid-page because the lobby's scroll position is kept (P1-10).
3. Reading the map: 6 px labels, 8 px stock badges (P1-10, P2-12).
4. Tapping castles (24×44 px) and parties (not tappable) (P1-10, P0-4).
5. Hover-only explanations (`title`) and the hidden ability chip (P1-10, P2-16).
6. Truncated card names (P1-9).
7. Switching tabs to read card text loses the raid draft (P1-11).
8. Small number inputs: trade amounts `w-14`, evacuation `w-10` (`TradePanel.tsx`, `HandPanel.tsx`). Use steppers (− / +).
9. The resolution overlay covers the whole screen. That's fine, but once dismissed it can't be reopened (P1-6).
10. Toasts overlapping content at the top (P1-10).

---

## 8. Implementation plan (no gameplay changes, except the R1 fix)

| Phase | Items | Risk |
|---|---|---|
| **A: quick wins** | Sticky phone header + scroll reset (P1-10); inline disabled reasons (P1-5); drawn-card, delivery and upkeep toasts (P1-8, P1-9); wrap card names + show counters (P1-9); ability chip on phones; RaidPanel stale-selection fix (P1-11); **R1 engine fix + test** | Low |
| **B: core understanding** | Rules drawer + join/lobby help + first-match coach (P0-1); phase strip + Next Steps (P0-2); raid preview + confirmation (P0-3); parties strip + idle parties on map (P0-4); personal results + "Last round" (P1-6); Score panel (P1-7) | Medium (UI only) |
| **C: polish** | Map legend and touch targets (P2-12, P1-10); ambush explanation (P2-13); event highlights (P2-14); trade affordability (P2-15); ability discovery (P2-16); danger warning (P2-17); away summary (P2-18); accessibility (P3-19) | Low |
| **D: verification** | Add a Playwright suite (`tests/e2e/`) implementing the acceptance tests below at 390×664 and 1366×768; keep all 112 existing tests green | — |

Constraints for the whole plan:
- no new socket events;
- no new `PlayerView` fields except, optionally, the private upkeep log line;
- engine changes limited to R1 and that log line;
- no balance, timing, card-effect or scoring changes.

---

## 9. Acceptance tests for a new player

Each test is written so it can be run manually with a first-time player, or automated with Playwright (A = automatable). Viewports: phone 390×664, desktop 1366×768.

| # | Scenario | Pass criteria | A |
|---|---|---|---|
| AT-1 | Join via a shared room link, never visiting the home page | The rules (phases, gathering, raids, scoring) are reachable from the join form and the lobby in ≤ 1 tap | ✅ |
| AT-2 | First 10 seconds of a match on a phone | Without scrolling, the player sees round, phase name, seconds left, what is allowed now, and what comes next | ✅ |
| AT-3 | "Send a party to gather food" with no instructions | Done within 20 s; the party's status and countdown are visible in a persistent parties strip; a delivery notice "+N 🍖" appears when it returns | ✅ |
| AT-4 | Round 1 ends | The player is told that upkeep cost 1 food (or 1 gold if out of food) | ✅ |
| AT-5 | Buy a card | A notice names the card drawn; on a phone the full card name and text are readable without truncation; its counters are visible on tap | ✅ |
| AT-6 | Try an action you can't do (unaffordable / at max / wrong phase) | The reason is visible next to the control before or immediately after tapping, and stays at least until the next action | ✅ |
| AT-7 | Plan a raid with attack 2 against a fort-5 target | The planner shows the target's known defense and a "cannot win" warning. Committing requires a confirmation listing cost, failure penalty and irreversibility | ✅ |
| AT-8 | Privacy during planning | Before Resolution, the attacker's DOM contains no names of the defender's committed defense cards, no reinforcement or barricade amounts, and no rival resource counts | ✅ |
| AT-9 | After Resolution | A personal summary states what happened to the player (loot, losses, points). During the next Build phase the full raid results can be reopened | ✅ |
| AT-10 | Mid-match: "why do I have 5 points?" | The Score tab lists the player's point entries and the scoring rules | ✅ |
| AT-11 | Phone ergonomics | The timer stays visible on every tab while scrolling; castle and site tap targets ≥ 44×44 px; map labels ≥ 11 px or available on tap | ✅ |
| AT-12 | Event announced and then active | The player sees what the event does and when. If it affects them (e.g. Goblin Tax), a personal notice appears | ✅ |
| AT-13 | Fort reaches 0 | A danger warning explains elimination and suggests Repair/Barricade. If eliminated, the spectator banner explains what they can still do | ✅ |
| AT-14 | Reload the page mid-match | The player returns to the same clan within 5 s and sees what happened while they were away | ✅ |
| AT-15 | Foxfire or Rats player | Can find their ability and when it can be used without opening the lobby again | manual |
| AT-16 | Plan an ambush | The planner explains ambush defense, shows the current number of enemy gatherers, and states there is no penalty when the site is empty | ✅ |
| AT-17 | Switch tabs while drafting a raid | The draft (target, cards, priority) is preserved | ✅ |
| AT-18 | Regression | All existing unit, integration and simulation tests pass. Engine outcomes are unchanged except the R1 fix, which gets its own test | ✅ |
| AT-19 | Comprehension check (manual, 3 first-time players) | After one match, each can explain: the 3 phases, how to gather, how raid success is decided, and how they scored | manual |

---

## 10. Evidence files

- `docs/images/usability/a1-phone-join-via-link.png`: the join form reached by link, with no rules.
- `docs/images/usability/a2-phone-first-screen.png`: the first game frame on a phone; timer and resources off-screen.
- `docs/images/usability/a4-phone-cards.png`: truncated card names; toasts overlapping content.
- `docs/images/usability/a5-phone-raid-planner.png`: attack 2 vs fort 5, committable with no warning.
- `docs/images/usability/a6-phone-resolution.png`: the resulting failed raid.

Measured values (390×664 viewport): map label height 6 px; stock badge 8 px; castle hit area 24×44 px; header top after scrolling to the actions −390 px; page height 1062 px; idle parties drawn 0; selection panel present at start 0; rules visible on join/lobby: no/no.

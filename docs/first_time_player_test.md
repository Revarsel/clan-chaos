# First-Time Player Usability Test

> **Status:** test plan plus automated pre-checks.
> **No human testers have taken part yet.** Everything marked "verified" below comes from code inspection, unit/integration tests and scripted browser runs (Playwright, headless Chromium). These checks prove that the information each task needs **exists and is reachable** on a phone and a desktop, and that secrets stay hidden. They **cannot** prove that a real person notices it, reads it or understands it. That needs the human sessions described here.

## 1. Goal and pass bar

Can someone who has never seen Clan Chaos join a game, understand the screen, complete the core loop and explain how to win, **without help from the developer**?

The game passes if, across at least 5 first-time testers:
- each of the 12 tasks is completed **unassisted (level 0)** by at least 4 of the 5;
- no task needs **level 3** assistance (told the answer) more than once;
- every tester can state the objective (task 1) and the raid rule "attack must be greater than defense" (task 10) at the end.

## 2. Setup (precise manual steps)

1. On the host computer: `pnpm dev` with **default timings** (30 s / 30 s / 15 s). Do not lengthen phases for testers: timing is part of the rules being tested.
2. The **moderator** opens `http://<host-LAN-IP>:3000`, creates a room as "Rival", and copies the room link.
3. The **tester** uses a separate device or browser (preferably their own phone). Send them only the room link.
4. Moderator: pick any clan and press **I'm ready**. Wait for the tester to ready up, then press **Start match**.
5. The moderator plays sensibly but simply as Rival: gathers, and raids the tester in rounds 2 and 4.
6. Record the screen (or take notes) and use the observation sheet in §8. After the match the tester answers the feedback form on the results screen (§7).

**Moderator rules**
- Read each task prompt exactly as written. Ask the tester to think aloud.
- Don't explain anything. If the tester is stuck for 30 seconds, give the next assistance level and record it:
  - **0** none;
  - **1** "Look around the screen";
  - **2** point to the area (e.g. "the top banner");
  - **3** tell them the answer.
- Tasks 1–3 happen before or at the start of round 1. Tasks 4–9 run during rounds 1–2. Task 10 is at the first Resolution, task 11 when the round ends, and task 12 at any time.

## 3. Tasks

"UI elements" names the components that should communicate the information (`apps/web/components/...`). "Automated" refers to the checks in `tests/e2e/first-time-player.e2e.mjs`, run on a 390×664 phone viewport (§5).

### Task 1: Explain the objective in your own words
- **Prompt:** "Before we start: what do you think you are trying to do in this game?"
- **Expected action:** read the "How to play" box on the join screen or in the lobby. During the match, tap **📖 Rules**.
- **UI elements:** `RulesSummary` (join form, lobby, home page, and the Rules sheet in `PhaseBanner`); the "How to win" section in `PlayersPanel`.
- **Success criteria:** mentions *the most points after 8 rounds* **or** *the last clan standing*.
- **Likely failure points:** the box is skipped because the lobby moves fast; the tester only remembers "raid people"; the Rules button in the banner isn't noticed.
- **Unassisted?** Expected yes. **Automated:** the objective text is present on the join form, in the lobby, and one tap away in-game (3 checks pass).

### Task 2: Identify the current phase and what you can do in it
- **Prompt:** "What part of the round are you in, and what are you allowed to do right now?"
- **Expected action:** read the top banner; optionally tap **What can I do?**.
- **UI elements:** `PhaseBanner` (round x/8, phase name, one-sentence purpose, countdown, next deadline, available and not-yet actions).
- **Success criteria:** names the phase; says gathering, building and cards are allowed; says raids open in Scheme & Commit (or that a raid can be submitted now, if in Scheme).
- **Likely failure points:** reading "Build & Gather" as gathering only; not opening "What can I do?".
- **Unassisted?** Expected yes. **Automated:** the banner is visible on the first frame without scrolling; the action lists are correct for the phase (they come from the server's own `COMMAND_PHASES` table).

### Task 3: Identify your gold, materials, food and fort defense
- **Prompt:** "How much gold, materials and food do you have, and how strong is your fort?"
- **Expected action:** read the four chips under the banner; tap one for details.
- **UI elements:** `ResourceHud`: four essential chips (amount /100, label, recent change, ⚠ when short) and tap-to-open explanations.
- **Success criteria:** states all four numbers correctly; for the fort, distinguishes current defense from its maximum.
- **Likely failure points:** confusing the 🪵 and 🍖 icons (the labels under them help); reading "/100" as a goal; misreading the fort "5/5".
- **Unassisted?** Expected yes. **Automated:** all four chips are fully on screen at 390 px width (fixed in this pass: the fort was previously off-screen); tapping the fort explains defense, maximum and exposure.

### Task 4: Send a gathering party to a suitable resource location
- **Prompt:** "Get some more food."
- **Expected action:** tap Sunny Acres or Goblin Fields on the map → **Send here**. Or tap an idle party under the map → choose a site → **Dispatch party**.
- **UI elements:** `MapView` (sites labelled with resource icon, 🛡 safe / ⚔ contested, stock), the "Show map" objective, `PartiesStrip`, `SelectionPanel`, the confirmation toast.
- **Success criteria:** a party's status changes to "Walking to <a food site>" within 60 s.
- **Likely failure points:** map labels are small on phones (about 10 px); tapping the Trading Post; not seeing the panel below the map; picking a contested site without understanding the ambush risk.
- **Unassisted?** Likely, but needs a human check. **Automated:** the site panel states resource, yield, safety and trip time; the dispatch is confirmed only after the server accepts it; the party status updates.

### Task 5: Explain when the collected resources become available to spend
- **Prompt:** "When can you actually use that food?"
- **Expected action:** read the dispatch message or the site/party panel.
- **UI elements:** dispatch toast ("…you can spend what it brings when it gets home"), the site panel and party panel text, the HUD "+3" change, and the feed entry "A party delivered 3 food from Sunny Acres".
- **Success criteria:** says it's usable when the party gets back home, not immediately.
- **Likely failure points:** the toast disappears after about 3 s; the tester expects instant income.
- **Unassisted?** Uncertain; needs a human. **Automated:** the sentence is present at dispatch time (fixed in this pass; it was missing before).

### Task 6: Inspect a tactical card and explain its effect and cost
- **Prompt:** "Pick one of your cards and tell me what it does and what it costs."
- **Expected action:** **Cards** tab (bottom bar on phones) → tap a card → read the details sheet.
- **UI elements:** `HandPanel` (cards grouped as Play now / Defend / Raid cards, each with its availability), `CardDetails` (effect, cost, type, when, target, when it takes effect, limits, counterplay, term definitions).
- **Success criteria:** states the effect in their own words and the correct cost.
- **Likely failure points:** not finding the Cards tab; the details sheet is long; terms such as "support slot" and "stronghold".
- **Unassisted?** Expected yes. **Automated:** the details sheet shows all fields for every card (unit test for all 22 cards plus the browser check).

### Task 7: Prepare a legal raid order
- **Prompt:** "Plan an attack on Rival."
- **Expected action:** **Raid** tab, or tap Rival's castle → **Plan raid**. Choose the target, optionally a card, a steal priority.
- **UI elements:** `RaidPanel` steps 1–7 and the status stepper (Draft → Submitted → Locked → Resolved). Illegal cards are listed with their reason.
- **Success criteria:** a draft with a valid target exists; during Build the tester can say why it can't be sent yet.
- **Likely failure points:** thinking a draft is already sent; raid cards are unaffordable after buying cards.
- **Unassisted?** Expected yes. **Automated:** "Draft (not sent)" and "Can't submit yet: Only during Scheme & Commit (opens in Ns)" are shown.

### Task 8: Explain the risk of a failed raid
- **Prompt:** "What happens if this attack fails?"
- **Expected action:** read step 7 and the verdict.
- **UI elements:** `RaidPanel` "If it fails: you lose 2 gold…", the verdict ("Cannot succeed: …" / "Beats all known defense…" / "Uncertain…"), and the Known vs Unknown lists.
- **Success criteria:** mentions losing 2 gold, and that hidden defenses can still stop the raid.
- **Likely failure points:** in round 1, almost every unassisted raid shows "Cannot succeed" (attack 2 vs fort 5). The tester may not realise mercenaries or cards are the way up.
- **Unassisted?** Expected yes for the penalty; uncertain for the hidden-defense idea. **Automated:** penalty, verdict and the "unknown" labels are present; the preview never uses hidden data (unit test).

### Task 9: Submit the order before the deadline
- **Prompt:** (during Scheme & Commit) "Send your attack."
- **Expected action:** **Review & submit raid** → read the confirmation → **Submit raid**.
- **UI elements:** the banner ("All orders lock in Ns"), the "!" badge on the Raid tab, the confirmation sheet, and the status "Submitted… Locked in Ns".
- **Success criteria:** the status shows Submitted before the timer reaches 0.
- **Likely failure points:** 30 s may feel short while reading the planner; drafting during Build is the intended answer.
- **Unassisted?** Likely; needs a human under real time pressure. **Automated:** the confirmation repeats target, cost, penalty and irreversibility; the explicit status is shown; the rival's screen shows only that a raid was submitted.

### Task 10: Interpret a raid result and its calculation
- **Prompt:** "What just happened in that raid, and why?"
- **Expected action:** read the reveal ("What happened to you", then the raid cards). Later: **Feed** → Raid results.
- **UI elements:** `ResolutionOverlay` / `RaidResultCard` (final attack vs defense, breakdown, revealed cards, plain "why", what changed) and `FeedPanel`.
- **Success criteria:** explains success or failure as attack vs defense (greater wins, a tie fails) and names what was lost or gained.
- **Likely failure points:** the reveal closes when Resolution ends (15 s); breakdown terms; several raids at once.
- **Unassisted?** Expected yes with the summary; full calculation uncertain. **Automated:** totals, breakdown, why-sentence, personal summary and the next-round countdown are present.

### Task 11: Explain upkeep and the consequences of insufficient food
- **Prompt:** "Do you have to pay anything each round? What if you run out of food?"
- **Expected action:** tap the Food chip, read 📖 Rules, or notice the feed entry "Upkeep: you paid 1 food".
- **UI elements:** the food chip (⚠ when short) and its explanation, `RulesSummary`, the banner during Resolution ("after 1 food upkeep"), feed entries, and the objective "No food for upkeep…".
- **Success criteria:** 1 food per round; without food it costs 1 gold; with neither, nothing more happens.
- **Likely failure points:** the upkeep is small and easy to miss; the gold fallback is only in the explanations.
- **Unassisted?** Uncertain; needs a human. **Automated:** the food explanation covers the gold fallback (fixed in this pass); the upkeep appears in the feed with its change and reason.

### Task 12: Explain how victory points are earned and how the match ends
- **Prompt:** "How do you get points, and when does the game end?"
- **Expected action:** **Players** tab ("How to win") or 📖 Rules; the ⭐ chip shows their own points.
- **UI elements:** `PlayersPanel` (scoring list, tie-breakers, "Your points"), `RulesSummary`, feed "score" entries, and the results screen breakdown.
- **Success criteria:** at least two ways to score; the end after 8 rounds or when one clan remains.
- **Likely failure points:** end-of-match bonuses (intact fort, +1 per 5 resources) are unexpected.
- **Unassisted?** Expected yes. **Automated:** scoring, tie-breakers and the end conditions are present.

## 4. Usability principles

| Principle | Verdict | Evidence / remaining risk |
|---|---|---|
| Important information is visible at the point of need | **Pass** (automated) | Phase, deadline, resources, costs, penalties and status sit next to the action. Deeper detail is one tap away (popovers, sheets) |
| Instructions use plain language | **Partial** | Short sentences throughout. Remaining jargon ("stronghold", "primary/support slot", "contested") is defined in card details and the legend. Needs non-developer readers |
| Costs and consequences appear before commitment | **Pass** | "Pay 3🪙 2🍖" on every action button, "Play now — pay …" on cards, the raid confirmation with cost, penalty and irreversibility |
| Errors explain how to recover | **Pass after fixes** | Cost errors now say where to get more ("…gathering at farms, the market (Actions) or a trade"); locked-phase errors say when you can act again. Rare server race errors (e.g. "That party is busy") still only state the problem |
| Hidden information remains hidden | **Pass** | Browser check: the rival sees "has committed a secret raid order" but not the target or card. Unit tests: views and feed never contain other players' cards, resources or targets; the preview ignores hidden defenses |
| Tutorial steps teach actual mechanics | **Pass** (automated) | The `/practice` tutorial runs the real engine against a bot. Each step completes only when the real view shows it happened (a party left, a delivery arrived, the preview beats the fort, the raid is committed, upkeep was paid). Every number in the text comes from the live view or the rule constants. `unit/practice.test.ts` plays every step against the engine. `practice-tutorial.e2e.mjs` plays it through the real UI on a phone and a desktop |
| Mobile players receive the same explanations | **Pass** (automated, emulated phone) | Same components on all screen sizes; every explanation opens on tap. Not tested on physical devices |
| No essential rule only through colour or hover | **Pass after fixes** | ⚠ added to resource warnings; the host label and the "Raids" column are now visible text; the legend covers idle parties and party colours. Remaining: on the map, a party's owner is shown only by colour (owner names are listed when you tap the site); SVG tooltips only duplicate visible text or the legend |

## 5. Automated validation performed

| What | Result |
|---|---|
| `pnpm lint`, `pnpm typecheck` | Clean |
| `pnpm test` (Vitest: unit, Socket.IO integration, PostgreSQL, simulations) | **133 / 133 passed**, including new feedback tests (rejected before the match ends, empty or oversized answers rejected, stored and updated in PostgreSQL) |
| `tests/e2e/first-time-player.e2e.mjs`: proxy walkthrough of tasks 1–12 + principles, tester on an iPhone 13 viewport (390×664), rival on desktop 1440×900 | **Baseline: 17 / 24** (failures: objective not reachable before or during play ×3, fort off-screen on phone, no "when can I spend it", no recovery hint, no-food rule missing). **After fixes: 24 / 24**, no browser console errors |
| `tests/e2e/practice-tutorial.e2e.mjs`: first-visit intro, then the whole guided tutorial through the real controls, on an iPhone 13 viewport and on 1440×900 | **44 / 44**, three runs in a row. It also checks that the tutorial panel never covers the control it asks for (Playwright refuses to click covered elements; this found two placement bugs, now fixed) and that there are no page errors |
| `tests/e2e/post-match-feedback.e2e.mjs`: short full match, then the feedback form on the phone | Pass: 4 questions shown, Send disabled until an answer exists, thank-you shown; the row was verified in the `PlaytestFeedback` table |

The e2e scripts need Playwright, which is not a project dependency. To run them: `pnpm add -D playwright && npx playwright install chromium`, start the game as described at the top of each script, then run `node tests/e2e/<script>.mjs`.

## 6. Problems fixed in this pass (all verified by the checks above)
1. The objective and rules weren't visible to link joiners: a one-minute plain-language **How to play** (`RulesSummary`) now appears on the join form, the lobby and the home page, and behind a **📖 Rules** button in the phase banner.
2. Fort defense was off-screen on phones: gold, materials, food and fort now always fit in one row.
3. Resource warnings were colour-only: they now carry ⚠ and the warning is in the button's accessible label.
4. Nothing said when gathered resources can be spent: added to the dispatch confirmation, the site and party panels, and the feed text.
5. Cost errors didn't explain recovery: they now name where to gather, the market and trading. The Resolution lock message says when you can act again.
6. Upkeep without food was unexplained: the food explanation and rules summary now state the 1-gold fallback.
7. Lobby: the auto-assigned clan is now explained ("tap another clan to switch"); "host" is text, not a hover tooltip.
8. Map legend: added idle parties at home and the meaning of party colours. Players panel: the "Raids" column is explained in visible text.
9. Added the post-match feedback prompt (§7).

## 7. Post-match feedback prompt

The results screen shows an optional form with four questions:
1. What was confusing?
2. Which mechanic was hardest to understand?
3. What did you think your objective was?
4. Which screen or explanation helped most?

- **Where it's stored:** answers are sent with `feedback:submit` once the match has ended, and stored in the PostgreSQL table `PlaytestFeedback` (one row per player per match; resubmitting edits it). With `PERSISTENCE=off` they are written to the server log as `[feedback] {...}`, and the player can copy their answers.
- **Read them with:**
  ```sql
  SELECT m."startedAt", f.name, f.clan, f.confusing, f.hardest, f.objective, f.helped
  FROM "PlaytestFeedback" f JOIN "Match" m ON m.id = f."matchId" ORDER BY f."createdAt" DESC;
  ```
- **How to use the answers:** look for patterns across several testers. **Never change balance (costs, card values, timings, scoring) because of a single response.** Collect at least 5 sessions, tag each answer by task (1–12), and change the explanation or UI before touching rules.

## 8. Observation sheet (copy per tester)

| Task | Completed? | Assist level (0–3) | Time | What they said / where they looked | Errors |
|---|---|---|---|---|---|
| 1 Objective | | | | | |
| 2 Phase | | | | | |
| 3 Resources & fort | | | | | |
| 4 Send party | | | | | |
| 5 When resources are usable | | | | | |
| 6 Card | | | | | |
| 7 Prepare raid | | | | | |
| 8 Failure risk | | | | | |
| 9 Submit before deadline | | | | | |
| 10 Read result | | | | | |
| 11 Upkeep | | | | | |
| 12 Points & end | | | | | |

Also record the device and browser, whether the tester has played similar games, and the four feedback answers.

## 9. Problems that need a real human playtest
- Whether testers actually **read** the How to play box, the banner sentence and the "What can I do?" list, or skip them.
- Whether **30-second phases** are enough on a first match while reading the raid planner (tasks 7–9).
- Comprehension of **"attack must be greater than defense"** and of **hidden defenses** (tasks 8 and 10).
- **Icon recognition:** 🪵 materials, 🍖 food, 🛡 safe / ⚔ contested, ⛏ 🎒 👣 party states.
- Whether the **dispatch and delivery messages** are noticed before the toast disappears (task 5).
- Whether the **reveal closing after 15 s** cuts off reading (task 10), and whether testers find the results again in Feed.
- **Information density** on phones: banner + tips + HUD + map + parties before the panels.
- **Real devices:** iOS Safari toolbars, notch and home bar, the on-screen keyboard covering inputs, touch accuracy on the map.
- **Feedback form:** do people fill it in, and are the four questions enough?

## 10. Prioritised further improvements
1. **Run 5 human sessions** with this plan before changing anything else; fix the top recurring issues first.
2. ~~Guided first match / practice mode~~ Done: `/practice` (see `features.md`). Next, watch testers use it: do they read the panel, and does a first raid that wins thanks to the preview leave the right expectations for real matches?
3. **Make first-round raids less discouraging to read:** when the verdict is "Cannot succeed", show the concrete ways up (mercenaries +2, attack cards) with their costs. Explanation only, no balance change.
4. **Let players keep the reveal open:** a "Keep results open" option, or reopen automatically in the Feed at the start of the next round.
5. **Phone map legibility:** pinch-zoom or a list view of sites; owner names or emblems on party markers so ownership isn't colour-only.
6. **Longer-lived confirmations** for messages with instructions (e.g. delivery timing), or a pinned "last action" line.
7. **"While you were away" summary** after reconnecting, and **event highlights** on the map (e.g. 🎯 on the Bounty Board target).
8. **Accessibility pass:** screen-reader run-through, contrast check of text on the green background, reduced-motion support.
9. **Plain-language review** of all help text by someone outside the project.
10. **Run the e2e scripts in CI** (add Playwright as a dev dependency once the project accepts the install cost).

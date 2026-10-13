import type { PlayerView } from "@clan-chaos/shared";
import { ACTION_VALUES, DEFAULT_CONFIG, MAP_LOCATIONS, SCORING } from "@clan-chaos/game-content";
import { draftPreview, type RaidDraft } from "../raidPlan";
import { explainRaid } from "../resolutionText";

/**
 * The guided first match, as data. Every step teaches a real mechanic of the running practice match:
 * completion is read from the actual engine view (or from what the player did in the UI), never faked.
 * Kept free of React so it can be unit-tested against a real engine-driven match.
 */

export type TutorialAction =
  | "fastForwardDelivery"
  | "skipToScheme"
  | "skipToDeadline"
  | "finishRound"
  | "openCards"
  | "openRaid"
  | "openActions"
  | "openPlayers";

/** Things the player did in the UI that are not visible in the game state. */
export type TutorialSignal = "card-details" | "fast-forwarded";

export interface TutorialCtx {
  view: PlayerView;
  signals: ReadonlySet<TutorialSignal>;
  draft: RaidDraft | null;
}

export interface TutorialStep {
  id: string;
  title: string;
  /** Which of the nine lessons this step belongs to (shown as progress). */
  lesson: string;
  body: (c: TutorialCtx) => string;
  /** What the player should do now; omitted for read-only steps. */
  task?: (c: TutorialCtx) => string;
  /** `data-tour` anchors to highlight, first one present on screen wins. */
  anchors: string[];
  done?: (c: TutorialCtx) => boolean;
  /** A helper button (fast-forward, open a panel) shown until the step is done. */
  action?: { label: string; kind: TutorialAction };
  /** Text shown once `done` is true. */
  success?: (c: TutorialCtx) => string;
}

const botOf = (v: PlayerView) => v.players.find((p) => p.id !== v.youId);
const myParties = (v: PlayerView) => v.parties.filter((p) => p.ownerId === v.youId);

/** Nearest gatherable gold site to the player's stronghold (where idle parties wait). */
export function suggestedSite(v: PlayerView): { id: string; name: string } {
  const home = myParties(v)[0]?.from ?? { x: 500, y: 350 };
  const gold = MAP_LOCATIONS.filter((l) => l.resource === "gold").sort(
    (a, b) => Math.hypot(a.position.x - home.x, a.position.y - home.y) - Math.hypot(b.position.x - home.x, b.position.y - home.y),
  )[0]!;
  return { id: gold.id, name: gold.name };
}

export function lastDelivery(v: PlayerView): string | null {
  const e = [...v.log].reverse().find((l) => l.category === "gather" && /delivered/.test(l.text) && isMine(l));
  return e?.text ?? null;
}

/** Private feed rows are only ever sent to the player they concern. */
const isMine = (l: PlayerView["log"][number]): boolean => l.kind === "private";

export function upkeepLine(v: PlayerView): string | null {
  return [...v.log].reverse().find((l) => l.category === "upkeep" && isMine(l))?.text ?? null;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    lesson: "Welcome",
    title: "Your practice match",
    anchors: [],
    body: (c) =>
      `This is a private practice match against ${botOf(c.view)?.name ?? "a bot"}. It uses the real rules, but it runs only in your browser: nothing here touches real rooms, players or results. The clock is paused while you read, and you decide when time moves.`,
  },
  {
    id: "hud",
    lesson: "1 · HUD and fort",
    title: "Your resources and fort",
    anchors: ["hud"],
    body: (c) =>
      `Gold buys cards and mercenaries. Materials build barricades and repair your fort. Food pays upkeep. Your fort has ${c.view.self?.fortDefense ?? "?"} defense: a raid on your stronghold must beat it to succeed (a tie fails). Your castle is the one marked “You” on the map.`,
  },
  {
    id: "send-party",
    lesson: "2 · Gathering parties",
    title: "Send a gathering party",
    anchors: ["send-party", "map"],
    body: () =>
      "Resources come from sites on the map: gold mines, forests, farms and the ruins. Your clan has two gathering parties waiting at home.",
    task: (c) => `Tap ${suggestedSite(c.view).name} (a gold mine) on the map, then press “Send here” next to a party.`,
    done: (c) => myParties(c.view).some((p) => p.status !== "idle"),
    success: () => "Your party is on its way. You can send the second party too.",
  },
  {
    id: "collect",
    lesson: "3 · Collecting and capacity",
    title: "Resources arrive when the party returns",
    anchors: ["parties"],
    body: () =>
      `A party walks to the site, gathers for a few seconds, then carries the load home. It can carry at most ${DEFAULT_CONFIG.partyCapacity} units per trip, and a site runs low as clans gather from it. Nothing counts until the party is home.`,
    task: () => "Fast-forward time to watch your party deliver.",
    action: { label: "⏩ Fast-forward to the delivery", kind: "fastForwardDelivery" },
    done: (c) => !!lastDelivery(c.view) || c.signals.has("fast-forwarded"),
    success: (c) => {
      const d = lastDelivery(c.view);
      return d
        ? `${d} Your resource bar updated. Idle parties can be sent again straight away; more trips mean more resources.`
        : "Your party is still out: long trips can take most of a phase. It will deliver on its own.";
    },
  },
  {
    id: "card",
    lesson: "4 · Cards",
    title: "Inspect a card",
    anchors: ["hand"],
    body: () =>
      "Cards are one-shot tricks. Attack cards strengthen a raid, defense cards secretly protect your stronghold, and instant cards act right away. Each card shows its cost and when you can use it.",
    task: () => "Open your Cards and tap Sneaky Heist to read what it does.",
    action: { label: "🃏 Open my cards", kind: "openCards" },
    done: (c) => c.signals.has("card-details"),
    success: () => "Sneaky Heist adds +3 attack to a stronghold raid and steals extra gold if it wins. You will use it in a moment.",
  },
  {
    id: "to-scheme",
    lesson: "5 · Phases and deadlines",
    title: "Next phase: Scheme & Commit",
    anchors: ["phase-banner"],
    body: () =>
      `Each round has three phases. Build & Gather is for your economy. Scheme & Commit is the only phase where you can submit a raid. Resolution reveals every raid at once. In a real match each phase has a timer (${DEFAULT_CONFIG.buildMs / 1000}s / ${DEFAULT_CONFIG.schemeMs / 1000}s / ${DEFAULT_CONFIG.resolutionMs / 1000}s) and moves on by itself.`,
    action: { label: "⏩ Skip to Scheme & Commit", kind: "skipToScheme" },
    done: (c) => c.view.phase !== "build" || c.view.round > 1,
    success: () => "It is now Scheme & Commit. The banner at the top always shows the phase and how long is left.",
  },
  {
    id: "raid-target",
    lesson: "6 · Raid target",
    title: "Choose a raid target",
    anchors: ["raid-planner", "castle-bot", "map"],
    body: () =>
      "You can raid a rival's stronghold to steal from their storage, or ambush a resource site to rob parties gathering there.",
    task: (c) => `Tap ${botOf(c.view)?.name ?? "the rival"}'s castle on the map and press “⚔️ Plan raid”, or open the Raid tab and pick them under “Choose a target”.`,
    action: { label: "⚔️ Open the raid planner", kind: "openRaid" },
    done: (c) => !!c.draft?.target || !!c.view.self?.raid,
    success: () => "Target chosen. The raid planner now compares your attack with their defense.",
  },
  {
    id: "preview",
    lesson: "7 · Attack vs defense",
    title: "Read the attack preview",
    anchors: ["raid-preview", "raid-planner"],
    body: (c) => {
      if (c.view.self?.raid) return "Your raid is already submitted.";
      const p = c.draft?.target ? draftPreview(c.view, c.draft) : null;
      if (!p) return "Choose a target first; the preview appears under it.";
      const def = p.visibleMin === p.visibleMax ? `${p.visibleMin}` : `${p.visibleMin}–${p.visibleMax}`;
      if (p.verdict === "cannot_win")
        return `Your attack is ${p.attack} and the known defense is ${def}. Attack must be greater, so this raid would fail and cost you ${DEFAULT_CONFIG.failedRaidGoldPenalty} gold.`;
      return `Your attack is ${p.attack} and the known defense is ${def}: this beats everything you can see. Secret defense cards could still add more; that is the risk of raiding.`;
    },
    task: () =>
      `Make your attack beat the fort: pick Sneaky Heist (+3) as the main card, then recruit mercenaries in Actions (+${ACTION_VALUES.mercenaryBonus} attack for 3 gold and 2 food).`,
    action: { label: "🔨 Open Actions (mercenaries)", kind: "openActions" },
    done: (c) => !!c.view.self?.raid || (!!c.draft?.target && draftPreview(c.view, c.draft)?.verdict === "beats_visible"),
    success: () => "Now your attack beats the visible defense.",
  },
  {
    id: "submit",
    lesson: "8 · Secret submission",
    title: "Submit before the deadline",
    anchors: ["raid-submit", "raid-planner"],
    body: () =>
      "Raids are secret: nobody sees your target until the reveal. Orders lock when the Scheme timer reaches zero, and a raid you have not submitted by then does not happen.",
    task: () => "In the Raid tab, press “Review & submit raid”, then “Submit raid”.",
    action: { label: "⚔️ Open the raid planner", kind: "openRaid" },
    done: (c) => !!c.view.self?.raid,
    success: (c) =>
      `Locked in. ${botOf(c.view)?.name ?? "Your rival"} may be planning something too. Defense cards like Booby Trap can still be committed until the deadline.`,
  },
  {
    id: "deadline",
    lesson: "8 · Secret submission",
    title: "The deadline",
    anchors: ["phase-banner"],
    body: () => "When the Scheme timer runs out, every raid is revealed and resolved at the same moment.",
    action: { label: "⏩ Skip to the deadline", kind: "skipToDeadline" },
    done: (c) => c.view.phase === "resolution" || c.view.round > 1,
  },
  {
    id: "resolution",
    lesson: "9 · Raid resolution",
    title: "What happened",
    anchors: ["resolution"],
    body: (c) => {
      const lines = c.view.resolutions.map((r) => {
        const e = explainRaid(c.view, r);
        return `${e.attackerName} → ${e.targetName}: ${e.outcome}. ${e.why} ${e.changes.join(" ")}`.trim();
      });
      if (!lines.length) return "No raids were launched this round.";
      return `${lines.join("\n")}\nStronghold raids that win steal up to ${DEFAULT_CONFIG.maxStealUnits} resources and damage the fort; failed ones cost the attacker gold.`;
    },
  },
  {
    id: "upkeep",
    lesson: "10 · Upkeep",
    title: "Upkeep at the end of the round",
    anchors: ["hud"],
    body: () =>
      `After the reveal, every clan pays ${ACTION_VALUES.upkeepFood} food upkeep (1 gold if it has no food). Keep some food in stock.`,
    action: { label: "⏩ Finish the round", kind: "finishRound" },
    done: (c) => c.view.round > 1 || c.view.phase === "ended",
    success: (c) => `${upkeepLine(c.view) ?? "Upkeep was paid."} Round ${c.view.round} has begun with a fresh Build & Gather phase.`,
  },
  {
    id: "scoring",
    lesson: "11 · Scoring and match end",
    title: "How to win",
    anchors: ["objectives", "players"],
    body: () =>
      `Points: raid won +${SCORING.successfulRaid}, fort destroyed +${SCORING.destroyFort}, rival eliminated +${SCORING.eliminateRival}, plus event bonuses. After ${DEFAULT_CONFIG.totalRounds} rounds you also get +${SCORING.intactFort} if your fort still stands and +1 for every ${SCORING.resourcesPerPoint} of each resource. Most points wins. A clan left with a destroyed fort and no resources is eliminated, and the last clan standing wins early.`,
    action: { label: "⭐ Open the scoreboard", kind: "openPlayers" },
  },
  {
    id: "finish",
    lesson: "Done",
    title: "You know the whole loop",
    anchors: [],
    body: (c) =>
      `Gather, prepare, scheme, reveal, repeat. You can keep playing this match against ${botOf(c.view)?.name ?? "the bot"}: the clock now runs at normal speed, and you can pause it or skip ahead at any time. Or head home and create a real room for your friends.`,
  },
];

export const TUTORIAL_LESSONS = [...new Set(TUTORIAL_STEPS.map((s) => s.lesson))];

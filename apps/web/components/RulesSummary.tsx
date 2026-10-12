import { ACTION_VALUES, COSTS, DEFAULT_CONFIG, SCORING } from "@clan-chaos/game-content";

/**
 * The whole game in short, plain sentences. Used on the home page, the join form, the lobby and
 * behind the in-game Rules button, so every player gets the same explanation on every device.
 */
export function RulesSummary({ durations }: { durations?: { build: number; scheme: number; resolution: number } }) {
  const s = (ms: number) => `${Math.round(ms / 1000)}s`;
  const d = durations ?? { build: DEFAULT_CONFIG.buildMs, scheme: DEFAULT_CONFIG.schemeMs, resolution: DEFAULT_CONFIG.resolutionMs };
  const items: [string, string, React.ReactNode][] = [
    ["🏆", "Goal", <>Score the most victory points after {DEFAULT_CONFIG.totalRounds} rounds, or be the last clan standing.</>],
    [
      "🪙",
      "Resources",
      <>
        Gold buys cards and mercenaries. Materials build barricades and repair your fort. Food pays upkeep and recruits. You can hold up to {DEFAULT_CONFIG.storageCap} of each.
      </>,
    ],
    [
      "👣",
      "Gathering",
      <>
        Send parties to sites on the map. They walk there, gather, and carry up to {DEFAULT_CONFIG.partyCapacity} back. You can spend it when the party gets home. Contested ⚔ sites pay more but can be ambushed.
      </>,
    ],
    [
      "⏱",
      "Each round",
      <>
        <b>Build &amp; Gather</b> ({s(d.build)}): collect and prepare. <b>Scheme &amp; Commit</b> ({s(d.scheme)}): you can also submit one secret raid. It must be in before the timer ends. <b>Resolution</b> ({s(d.resolution)}): raids are revealed, then every clan pays {ACTION_VALUES.upkeepFood} food upkeep (1 gold if it has no food).
      </>,
    ],
    [
      "⚔️",
      "Raids",
      <>
        Your fort&apos;s defense protects you. A raid wins only if its attack is <b>greater</b> than the defense (a tie fails). A win steals up to {DEFAULT_CONFIG.maxStealUnits} resources and damages the fort. A loss costs the attacker {DEFAULT_CONFIG.failedRaidGoldPenalty} gold.
      </>,
    ],
    [
      "🃏",
      "Cards",
      <>
        Buy one for {COSTS.buyCard.gold} gold. Instant cards work right away, defense cards are committed in secret, and raid cards are attached to your raid. Tap any card to read it.
      </>,
    ],
    [
      "⭐",
      "Points",
      <>
        Raid won +{SCORING.successfulRaid}, fort destroyed +{SCORING.destroyFort}, clan eliminated +{SCORING.eliminateRival}, plus event bonuses. At the end: fort still standing +{SCORING.intactFort}, and +1 for every {SCORING.resourcesPerPoint} of each resource left. Ties go to the most raids won.
      </>,
    ],
    ["☠", "Elimination", <>If a raid leaves you with a destroyed fort and no resources, you are out, but you can keep watching.</>],
  ];
  return (
    <ul className="space-y-1.5 text-sm text-bark-800" data-testid="rules-summary">
      {items.map(([icon, title, body]) => (
        <li key={title} className="flex gap-2">
          <span className="text-lg leading-tight" aria-hidden>
            {icon}
          </span>
          <span>
            <b>{title}:</b> {body}
          </span>
        </li>
      ))}
    </ul>
  );
}

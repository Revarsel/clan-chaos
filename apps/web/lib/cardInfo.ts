import type { CardId, Resources } from "@clan-chaos/shared";
import { CARDS, DEFAULT_CONFIG } from "@clan-chaos/game-content";

/** Plain-language description of a card, derived only from the card definitions in game-content. */
export interface CardInfo {
  id: CardId;
  name: string;
  icon: string;
  kind: string;
  kindHelp: string;
  effect: string;
  cost: Partial<Resources>;
  costLabel: string;
  timing: string;
  target: string;
  applies: string;
  limits: string[];
  counters: string;
  attackBonus: number;
}

export const CARD_TERMS: Record<string, string> = {
  Stronghold: "A clan's castle on the map. Stronghold raids attack its fort and steal from its stores.",
  Ambush: "A raid on a contested resource site. It hits enemy parties gathering there.",
  Primary: "The main card slot of a raid order.",
  Support: "The second raid slot, for a supporting or reaction card.",
  Commit: "Lock the card in secretly. Rivals only see it if a raid hits you.",
  Resolution: "The phase where all raid orders are revealed and resolved.",
};

const word = (r: Partial<Resources>) =>
  Object.entries(r)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([t, n]) => `${n} ${t}`)
    .join(" + ") || "Free";

export function describeCard(id: CardId): CardInfo {
  const c = CARDS[id];
  const limits: string[] = [];
  let kind: string;
  let kindHelp: string;
  let timing: string;
  let target: string;
  let applies: string;

  if (c.timing === "attack") {
    kind = c.slot === "support" ? "Raid support card" : c.slot === "either" ? "Raid card (primary or support)" : "Raid attack card";
    kindHelp = "Attached to your secret raid order. It only matters if you raid.";
    timing = "Attach it while submitting a raid during Scheme & Commit.";
    target = c.strongholdOnly ? "Your raid's target, which must be a stronghold" : "Your raid's target (a stronghold or an ambush site)";
    applies = "During Resolution, when your raid is revealed.";
    if (c.slot === "primary") limits.push("Primary slot only.");
    if (c.slot === "support") limits.push("Support slot only.");
    if (c.slot === "either") limits.push("Fits either raid slot.");
    if (c.strongholdOnly) limits.push("Cannot be used on an ambush of a resource site.");
    limits.push("One raid per round, with at most one primary and one support card.");
    if (id === "false_flag") limits.push("You must also pick a decoy rival who is not your real target.");
  } else if (c.timing === "defense") {
    kind = "Defense card";
    kindHelp = "Committed secretly in advance. It protects you when a raid hits your stronghold.";
    timing = "Commit it during Build & Gather or Scheme & Commit, before orders lock.";
    target = "Your own stronghold";
    applies = id === "last_minute_reinforcements" ? "During Resolution, against the next raid that hits you (even in a later round)." : "During Resolution, against raids on your stronghold this round.";
    limits.push(`At most ${DEFAULT_CONFIG.maxDefenseCardsPerRound} defense cards per round, and not the same card twice.`);
    limits.push("Defends your stronghold only, not parties at resource sites.");
  } else {
    const category = c.category === "reconnaissance" ? "Scouting" : c.category === "economy" ? "Economy" : c.category === "politics" ? "Politics" : c.category === "defense" ? "Defense" : "Instant";
    kind = `${category} card (instant)`;
    kindHelp = "Played immediately. Its effect starts as soon as the server accepts it.";
    timing = "Play it during Build & Gather or Scheme & Commit.";
    target = c.target === "player" ? "A rival clan (not yourself, not eliminated)" : c.target === "location" ? "A resource site on the map" : "Yourself";
    applies = c.params.rounds ? `Immediately, and it lasts this round and the next.` : "Immediately.";
    if (id === "emergency_evacuation") {
      applies = "Immediately. The resources come back after upkeep at the end of the round.";
      limits.push(`Move at most ${c.params.maxUnits} units. Reserved resources can't be spent until they return.`);
    }
    if (id === "unstable_truce") limits.push("The rival must accept. If they refuse, the card is still used.");
    if (id === "eagle_eye_scout") limits.push("Reports the rival's raid as it stands right now. If they haven't committed yet, that is what you learn.");
    if (id === "trail_markers" || id === "resource_rush") limits.push("Choose a gatherable site (not the Trading Post).");
  }
  if (c.cost && Object.keys(c.cost).length) limits.push("The cost is paid when the server accepts the card.");
  return {
    id,
    name: c.name,
    icon: c.icon,
    kind,
    kindHelp,
    effect: c.text,
    cost: c.cost,
    costLabel: word(c.cost),
    timing,
    target,
    applies,
    limits,
    counters: c.counters,
    attackBonus: c.params.attack ?? 0,
  };
}

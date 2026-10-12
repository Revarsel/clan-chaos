import { formatResources, totalResources, type PlayerView, type RaidResolutionView } from "@clan-chaos/shared";
import { CARDS, getLocation } from "@clan-chaos/game-content";

/** Plain-language explanation of one revealed raid. Uses only the public resolution record. */
export interface RaidExplanation {
  attackerName: string;
  targetName: string;
  outcome: string;
  why: string;
  changes: string[];
  attackCards: string[];
  defenseCards: string[];
}

export function explainRaid(view: PlayerView, r: RaidResolutionView): RaidExplanation {
  const name = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? "?";
  const targetName = r.defenderId ? name(r.defenderId) : r.target.kind === "location" ? (getLocation(r.target.locationId)?.name ?? "?") : "?";
  const isAmbushEmpty = r.target.kind === "location" && r.defenseStrength === 0 && !r.success;
  let why: string;
  if (isAmbushEmpty) why = "Nobody was gathering there when orders locked, so there was nothing to ambush. No penalty.";
  else if (r.attackStrength === 0 && r.notes.length && !r.success) why = r.notes[0]!;
  else if (r.success) why = `Attack ${r.attackStrength} is greater than defense ${r.defenseStrength}, so the raid succeeded.`;
  else why = `Attack ${r.attackStrength} is not greater than defense ${r.defenseStrength} (a tie fails), so the raid was repelled.`;
  const changes: string[] = [];
  if (r.success && totalResources(r.stolen) > 0) changes.push(`${name(r.attackerId)} stole ${formatResources(r.stolen)}.`);
  if (r.success && totalResources(r.stolen) === 0) changes.push("Nothing could be stolen.");
  if (r.fortDamage > 0) changes.push(`${targetName}'s fort lost ${r.fortDamage} defense.`);
  if (r.goldLost > 0) changes.push(`${name(r.attackerId)} lost ${r.goldLost} gold as the failure penalty.`);
  if (r.pointsAwarded > 0) changes.push(`${name(r.attackerId)} earned ${r.pointsAwarded} points.`);
  return {
    attackerName: name(r.attackerId),
    targetName,
    outcome: r.success ? "Success" : isAmbushEmpty ? "Found nobody" : "Repelled",
    why,
    changes,
    attackCards: r.attackCards.map((c) => `${CARDS[c].icon} ${CARDS[c].name}`),
    defenseCards: r.defenseCards.map((c) => `${CARDS[c].icon} ${CARDS[c].name}`),
  };
}

/** What the latest resolution meant for the viewer. */
export function personalSummary(view: PlayerView): string[] {
  if (view.resolutionRound !== view.round) return [];
  const me = view.youId;
  const name = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? "?";
  const lines: string[] = [];
  for (const r of view.resolutions) {
    if (r.attackerId === me) {
      const target = r.defenderId ? name(r.defenderId) : `the ambush at ${r.target.kind === "location" ? getLocation(r.target.locationId)?.name : "?"}`;
      if (r.success) {
        const loot = totalResources(r.stolen) ? `took ${formatResources(r.stolen)}` : "took nothing";
        lines.push(`Your raid on ${target} succeeded (${r.attackStrength} vs ${r.defenseStrength}): you ${loot}${r.pointsAwarded ? ` and earned ${r.pointsAwarded} points` : ""}.`);
      } else if (r.goldLost > 0) {
        lines.push(`Your raid on ${target} failed (${r.attackStrength} vs ${r.defenseStrength}): you lost ${r.goldLost} gold.`);
      } else {
        lines.push(`Your raid on ${target} failed (${r.attackStrength} vs ${r.defenseStrength}), with no penalty.`);
      }
    } else if (r.defenderId === me) {
      if (r.success) {
        const lost = totalResources(r.stolen) ? `stole ${formatResources(r.stolen)}` : "stole nothing";
        lines.push(`${name(r.attackerId)} raided you and ${lost}${r.fortDamage ? `; your fort lost ${r.fortDamage}` : ""}.`);
      } else {
        lines.push(`${name(r.attackerId)} raided you and was repelled (${r.attackStrength} vs ${r.defenseStrength}).`);
      }
    }
  }
  if (!lines.length) lines.push(view.resolutions.length ? "No raid involved you this round." : "Nobody raided this round.");
  return lines;
}

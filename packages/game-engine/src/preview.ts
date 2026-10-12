import type { CardId } from "@clan-chaos/shared";
import { ACTION_VALUES, CARDS, DEFAULT_CONFIG } from "@clan-chaos/game-content";

/**
 * Pure raid-strength helpers. `raidAttack` is used by the authoritative resolution in raids.ts;
 * the other helpers let the client preview a raid against **publicly visible** defense only.
 * They never read hidden state (defense cards, reinforcements, barricade amounts).
 */

export interface StrengthPart {
  label: string;
  value: number;
}

export function raidAttack(baseAttack: number, mercenaryBonus: number, cards: CardId[]): { total: number; parts: StrengthPart[] } {
  const parts: StrengthPart[] = [{ label: "Base", value: baseAttack }];
  if (mercenaryBonus > 0) parts.push({ label: "Mercenaries", value: mercenaryBonus });
  for (const c of cards) {
    const a = CARDS[c].params.attack ?? 0;
    if (a !== 0) parts.push({ label: CARDS[c].name, value: a });
  }
  return { total: parts.reduce((s, p) => s + p.value, 0), parts };
}

export const fortBypass = (cards: CardId[]): number =>
  cards.includes("tunnel_rats") ? (CARDS.tunnel_rats.params.bypassFort ?? 0) : 0;

export const softDefenseCut = (cards: CardId[]): number =>
  cards.includes("decoy_caravan") ? (CARDS.decoy_caravan.params.reduceDefense ?? 0) : 0;

export interface VisibleTarget {
  fortDefense: number;
  hasBarricade: boolean;
}

export type RaidVerdict = "cannot_win" | "depends_on_barricade" | "beats_visible";

export interface RaidPreview {
  attack: number;
  attackParts: StrengthPart[];
  /** Fort defense that will count after Tunnel Rats. */
  fortCounted: number;
  /** Visible defense range (fort + barricade 0 / +2..+4, after Decoy Caravan). Hidden defenses may add more. */
  visibleMin: number;
  visibleMax: number;
  verdict: RaidVerdict;
  notes: string[];
}

/** Preview a stronghold raid using only public information about the target. */
export function previewStrongholdRaid(mercenaryBonus: number, cards: CardId[], target: VisibleTarget): RaidPreview {
  const { total, parts } = raidAttack(DEFAULT_CONFIG.baseAttack, mercenaryBonus, cards);
  const bypass = Math.min(target.fortDefense, fortBypass(cards));
  const fortCounted = target.fortDefense - bypass;
  const step = ACTION_VALUES.barricadeDefense;
  const softMin = target.hasBarricade ? step : 0;
  const softMax = target.hasBarricade ? DEFAULT_CONFIG.maxBarricadeDefense : 0;
  const cut = softDefenseCut(cards);
  const visibleMin = fortCounted + Math.max(0, softMin - cut);
  const visibleMax = fortCounted + Math.max(0, softMax - cut);
  const notes: string[] = [];
  if (bypass > 0) notes.push(`Tunnel Rats ignores ${bypass} fort defense.`);
  if (target.hasBarricade) notes.push(`The target has a barricade (+${step} or +${DEFAULT_CONFIG.maxBarricadeDefense}; the exact amount is secret).`);
  if (cut > 0) notes.push(`Decoy Caravan removes up to ${cut} non-fort defense.`);
  notes.push("Secret defense cards or reinforcements may add more; Counter-Ambush can lower your attack.");
  const verdict: RaidVerdict = total <= visibleMin ? "cannot_win" : total > visibleMax ? "beats_visible" : "depends_on_barricade";
  return { attack: total, attackParts: parts, fortCounted, visibleMin, visibleMax, verdict, notes };
}

/** Preview an ambush: defense equals the number of enemy parties gathering there at the deadline. */
export function previewAmbush(mercenaryBonus: number, cards: CardId[], enemyGatherersNow: number): RaidPreview {
  const { total, parts } = raidAttack(DEFAULT_CONFIG.baseAttack, mercenaryBonus, cards);
  const notes = [
    "Defense = 1 per enemy party still gathering there when orders lock. Parties may leave or arrive before then.",
    "If nobody is there, the ambush finds nothing and costs no penalty.",
  ];
  const verdict: RaidVerdict = enemyGatherersNow === 0 ? "depends_on_barricade" : total > enemyGatherersNow ? "beats_visible" : "cannot_win";
  return { attack: total, attackParts: parts, fortCounted: 0, visibleMin: enemyGatherersNow, visibleMax: enemyGatherersNow, verdict, notes };
}

import { RESOURCE_TYPES, totalResources, type ResourceType, type Resources } from "@clan-chaos/shared";
import type { CommandRecord, LogEntry, MatchState, PlayerState } from "./state.js";
import { shuffle } from "./rng.js";

export class RuleError extends Error {
  constructor(
    public readonly code: "WRONG_PHASE" | "INSUFFICIENT" | "LIMIT" | "INVALID" | "ELIMINATED" | "INACTIVE" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export const fail = (code: RuleError["code"], message: string): never => {
  throw new RuleError(code, message);
};

export function canAfford(p: PlayerState, cost: Partial<Resources>): boolean {
  return RESOURCE_TYPES.every((t) => p.resources[t] >= (cost[t] ?? 0));
}

export function describeCost(cost: Partial<Resources>): string {
  return RESOURCE_TYPES.filter((t) => (cost[t] ?? 0) > 0)
    .map((t) => `${cost[t]} ${t}`)
    .join(" + ");
}

/** Deducts a cost, throwing (without side effects) if the player cannot pay. */
export function pay(p: PlayerState, cost: Partial<Resources>): void {
  if (!canAfford(p, cost)) fail("INSUFFICIENT", `Not enough resources (needs ${describeCost(cost)})`);
  for (const t of RESOURCE_TYPES) p.resources[t] -= cost[t] ?? 0;
}

/** Adds resources respecting the storage cap. Returns the amount actually stored. */
export function addResource(state: MatchState, p: PlayerState, type: ResourceType, amount: number): number {
  const room = Math.max(0, state.config.storageCap - p.resources[type]);
  const added = Math.max(0, Math.min(room, amount));
  p.resources[type] += added;
  return added;
}

export function removeResource(p: PlayerState, type: ResourceType, amount: number): number {
  const removed = Math.max(0, Math.min(p.resources[type], amount));
  p.resources[type] -= removed;
  return removed;
}

export function playerTotal(p: PlayerState, includeReserve = true): number {
  return totalResources(p.resources) + (includeReserve ? totalResources(p.safeReserve) : 0);
}

export function getPlayer(state: MatchState, id: string): PlayerState {
  const p = state.players[id];
  if (!p) return fail("NOT_FOUND", "Unknown clan");
  return p;
}

export function rivalsOf(state: MatchState, id: string): PlayerState[] {
  return state.seatOrder.map((pid) => state.players[pid] as PlayerState).filter((p) => p.id !== id && !p.eliminated);
}

export function award(state: MatchState, p: PlayerState, points: number, reason: string): void {
  if (points === 0) return;
  p.score += points;
  p.scoreBreakdown.push({ round: state.round, points, reason });
}

export function log(
  state: MatchState,
  now: number,
  text: string,
  kind: LogEntry["kind"] = "info",
  visibleTo: string[] | null = null,
): void {
  state.log.push({ at: now, round: state.round, text, kind, visibleTo });
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}

/** Draws a card from the shared deck, reshuffling the discard pile when the draw pile is empty. */
export function drawCard(state: MatchState, p: PlayerState): boolean {
  if (p.hand.length >= state.config.maxHandSize) return false;
  if (state.deck.length === 0 && state.discard.length > 0) {
    state.deck = shuffle(state, state.discard);
    state.discard = [];
  }
  const card = state.deck.pop();
  if (!card) return false;
  p.hand.push(card);
  return true;
}

export function takeFromHand(p: PlayerState, uid: string) {
  const idx = p.hand.findIndex((c) => c.uid === uid);
  if (idx < 0) return fail("NOT_FOUND", "That card is not in your hand");
  return p.hand[idx] as NonNullable<(typeof p.hand)[number]>;
}

export function removeFromHand(p: PlayerState, uid: string): void {
  p.hand = p.hand.filter((c) => c.uid !== uid);
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export const okRecord: CommandRecord = { ok: true };

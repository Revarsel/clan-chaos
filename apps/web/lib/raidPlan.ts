import {
  RESOURCE_TYPES,
  type CardInstance,
  type PlayerView,
  type RaidTarget,
  type ResourceType,
  type Resources,
} from "@clan-chaos/shared";
import { CARDS, DEFAULT_CONFIG, getLocation } from "@clan-chaos/game-content";
import { previewAmbush, previewStrongholdRaid, type RaidPreview } from "@clan-chaos/game-engine";
import { costReason, missingResources } from "./availability";

/** Local, unsent raid plan. Lives only in this browser tab until submitted. */
export interface RaidDraft {
  target: RaidTarget | null;
  primaryUid: string | null;
  supportUid: string | null;
  decoyId: string | null;
  priority: ResourceType;
}

export const emptyDraft = (): RaidDraft => ({ target: null, primaryUid: null, supportUid: null, decoyId: null, priority: "gold" });

export type RaidStage = "none" | "draft" | "submitting" | "submitted" | "locked" | "resolved";

export interface RaidStatus {
  stage: RaidStage;
  label: string;
  detail: string;
}

export function raidStatus(view: PlayerView, draft: RaidDraft, submitting: boolean): RaidStatus {
  const mine = view.resolutionRound === view.round ? view.resolutions.find((r) => r.attackerId === view.youId) : undefined;
  if ((view.phase === "resolution" || view.phase === "ended") && mine) {
    return {
      stage: "resolved",
      label: mine.success ? "Resolved: success" : "Resolved: failed",
      detail: `Locked at the deadline, then revealed: attack ${mine.attackStrength} vs defense ${mine.defenseStrength}.`,
    };
  }
  if (view.self?.raid) {
    return {
      stage: "submitted",
      label: "Submitted",
      detail: "The server accepted your order. It is final and hidden from rivals, and locks for good when the timer ends.",
    };
  }
  if (submitting) return { stage: "submitting", label: "Submitting…", detail: "Waiting for the server to accept the order." };
  if (view.phase === "resolution") return { stage: "locked", label: "Locked", detail: "Orders are locked. You did not submit a raid this round." };
  if (draft.target) {
    return {
      stage: "draft",
      label: "Draft (not sent)",
      detail: view.phase === "scheme" ? "Only on this device. Nothing happens until you submit." : "Only on this device. You can submit when Scheme & Commit begins.",
    };
  }
  return { stage: "none", label: "No raid planned", detail: "Raiding is optional. Pick a target to start a draft." };
}

export const draftCards = (view: PlayerView, d: RaidDraft): CardInstance[] =>
  [d.primaryUid, d.supportUid].flatMap((uid) => view.self?.hand.find((c) => c.uid === uid) ?? []);

export function draftCost(view: PlayerView, d: RaidDraft): Partial<Resources> {
  const cost: Partial<Resources> = {};
  for (const c of draftCards(view, d)) for (const t of RESOURCE_TYPES) cost[t] = (cost[t] ?? 0) + (CARDS[c.cardId].cost[t] ?? 0);
  return cost;
}

export interface CardOption {
  card: CardInstance;
  ok: boolean;
  reason?: string;
}

/** Raid cards for one slot, with the reason each unusable card can't go there. */
export function cardOptions(view: PlayerView, d: RaidDraft, slot: "primary" | "support"): CardOption[] {
  const self = view.self;
  if (!self) return [];
  const otherUid = slot === "primary" ? d.supportUid : d.primaryUid;
  const other = self.hand.find((c) => c.uid === otherUid);
  return self.hand
    .filter((c) => CARDS[c.cardId].timing === "attack" && c.uid !== otherUid)
    .map((card) => {
      const def = CARDS[card.cardId];
      if (slot === "primary" && def.slot === "support") return { card, ok: false, reason: "Support slot only" };
      if (slot === "support" && def.slot === "primary") return { card, ok: false, reason: "Primary slot only" };
      if (d.target?.kind === "location" && def.strongholdOnly) return { card, ok: false, reason: "Strongholds only, not ambushes" };
      const cost: Partial<Resources> = { ...def.cost };
      if (other) for (const t of RESOURCE_TYPES) cost[t] = (cost[t] ?? 0) + (CARDS[other.cardId].cost[t] ?? 0);
      const missing = missingResources(self.resources, cost);
      return missing ? { card, ok: false, reason: `Needs ${missing}` } : { card, ok: true };
    });
}

/** Drops selections that became illegal (target changed, card left the hand, decoy is now the target). */
export function sanitizeDraft(view: PlayerView, d: RaidDraft): RaidDraft {
  const self = view.self;
  if (!self) return d;
  const rivals = view.players.filter((p) => p.id !== view.youId && !p.eliminated).map((p) => p.id);
  const next = { ...d };
  if (next.target?.kind === "player" && !rivals.includes(next.target.playerId)) next.target = null;
  const valid = (uid: string | null, slot: "primary" | "support") => {
    if (!uid) return null;
    const c = self.hand.find((x) => x.uid === uid);
    if (!c) return null;
    const def = CARDS[c.cardId];
    if (def.timing !== "attack") return null;
    if (slot === "primary" && def.slot === "support") return null;
    if (slot === "support" && def.slot === "primary") return null;
    if (next.target?.kind === "location" && def.strongholdOnly) return null;
    return uid;
  };
  next.primaryUid = valid(next.primaryUid, "primary");
  next.supportUid = valid(next.supportUid, "support");
  if (next.primaryUid && next.primaryUid === next.supportUid) next.supportUid = null;
  if (next.decoyId && (!rivals.includes(next.decoyId) || (next.target?.kind === "player" && next.target.playerId === next.decoyId))) next.decoyId = null;
  return next;
}

export const enemyGatherersAt = (view: PlayerView, locationId: string): number =>
  view.parties.filter((p) => p.locationId === locationId && p.status === "gathering" && p.ownerId !== view.youId).length;

export function draftPreview(view: PlayerView, d: RaidDraft): RaidPreview | null {
  const self = view.self;
  if (!self || !d.target) return null;
  const cards = draftCards(view, d).map((c) => c.cardId);
  if (d.target.kind === "player") {
    const targetId = d.target.playerId;
    const t = view.players.find((p) => p.id === targetId);
    if (!t) return null;
    return previewStrongholdRaid(self.mercenaryBonus, cards, { fortDefense: t.fortDefense, hasBarricade: t.hasBarricade });
  }
  return previewAmbush(self.mercenaryBonus, cards, enemyGatherersAt(view, d.target.locationId));
}

export function failurePenalty(view: PlayerView, d: RaidDraft): string {
  const cards = draftCards(view, d).map((c) => c.cardId);
  if (cards.includes("hit_and_run")) return "If it fails: no gold penalty (Hit and Run), but a Booby Trap would still cost you 2 gold.";
  const base = `If it fails: you lose ${DEFAULT_CONFIG.failedRaidGoldPenalty} gold`;
  return d.target?.kind === "location"
    ? `${base} if the gatherers repel you. An empty site costs nothing.`
    : `${base} (2 more if the target set a Booby Trap).`;
}

export const targetLabel = (view: PlayerView, t: RaidTarget): string =>
  t.kind === "player" ? (view.players.find((p) => p.id === t.playerId)?.name ?? "?") : `Ambush at ${getLocation(t.locationId)?.name ?? "?"}`;

/** Why the Submit button can't be used right now, or null. */
export function submitBlocker(view: PlayerView, d: RaidDraft, now: number, phaseReason: (n: number) => string | null): string | null {
  const self = view.self;
  if (!self) return "Spectators can't raid.";
  const phase = phaseReason(now);
  if (phase) return phase;
  if (self.raid) return "You already submitted a raid this round.";
  if (!d.target) return "Choose a target first.";
  if (draftCards(view, d).some((c) => c.cardId === "false_flag") && !d.decoyId) return "False Flag needs a decoy rival.";
  return costReason(self.resources, draftCost(view, d));
}

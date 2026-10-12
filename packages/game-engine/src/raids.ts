import {
  RESOURCE_TYPES,
  formatResources,
  type CardId,
  type RaidResolutionView,
  type RaidTarget,
  type ResourceType,
  type Resources,
} from "@clan-chaos/shared";
import { CARDS, SCORING, getLocation } from "@clan-chaos/game-content";
import type { MatchState, PlayerState, RaidOrder } from "./state.js";
import { addResource, award, fail, getPlayer, log, playerTotal, removeResource, resourceDelta } from "./helpers.js";
import { interceptParty, isGatherable } from "./gathering.js";
import { raidAttack } from "./preview.js";

const param = (id: CardId, key: string): number => CARDS[id].params[key] ?? 0;

export function validateRaidTarget(state: MatchState, attacker: PlayerState, target: RaidTarget, cards: CardId[]): void {
  if (target.kind === "player") {
    const t = state.players[target.playerId];
    if (!t) return fail("NOT_FOUND", "Unknown target clan");
    if (t.id === attacker.id) fail("INVALID", "You cannot raid yourself");
    if (t.eliminated) fail("INVALID", "That clan has been eliminated");
  } else {
    const loc = getLocation(target.locationId);
    if (!isGatherable(loc)) return fail("INVALID", "That location cannot be raided");
    if (loc.safe) fail("INVALID", `${loc.name} is a safe site and cannot be raided`);
    for (const c of cards) {
      if (CARDS[c].strongholdOnly) fail("INVALID", `${CARDS[c].name} only works against strongholds`);
    }
  }
}

/** Deterministic raid order: seat order rotated by one seat every round. */
export function raidResolutionOrder(state: MatchState): string[] {
  const n = state.seatOrder.length;
  const offset = (state.round - 1) % n;
  const rotated = [...state.seatOrder.slice(offset), ...state.seatOrder.slice(0, offset)];
  return rotated.filter((id) => state.raids[id]);
}

function hasDefenseCard(p: PlayerState, id: CardId): boolean {
  return p.defenseCards.some((c) => c.cardId === id);
}

function inTruce(state: MatchState, a: string, b: string) {
  return state.truces.find(
    (t) => t.untilRound >= state.round && ((t.a === a && t.b === b) || (t.a === b && t.b === a)),
  );
}

function emptyView(order: number, raid: RaidOrder): RaidResolutionView {
  return {
    order,
    attackerId: raid.attackerId,
    target: raid.target,
    defenderId: raid.target.kind === "player" ? raid.target.playerId : null,
    attackCards: [raid.primary, raid.support].filter((c) => c !== null).map((c) => c!.cardId),
    defenseCards: [],
    attackStrength: 0,
    defenseStrength: 0,
    attackBreakdown: [],
    defenseBreakdown: [],
    success: false,
    stolen: {},
    fortDamage: 0,
    goldLost: 0,
    pointsAwarded: 0,
    notes: [],
  };
}

function attackStrength(state: MatchState, raid: RaidOrder, view: RaidResolutionView): number {
  const cards = [raid.primary, raid.support].filter((c) => c !== null).map((c) => c!.cardId);
  const { total, parts } = raidAttack(state.config.baseAttack, raid.mercenaryBonus, cards);
  for (const p of parts) view.attackBreakdown.push(p.label === "Base" ? `Base ${p.value}` : `${p.label} ${p.value > 0 ? "+" : ""}${p.value}`);
  return total;
}

const raidUses = (raid: RaidOrder, id: CardId) => raid.primary?.cardId === id || raid.support?.cardId === id;

/** Steals up to `cap` units, prioritising one resource, limited by the attacker's free storage. */
function stealResources(
  state: MatchState,
  attacker: PlayerState,
  defender: PlayerState,
  priority: ResourceType,
  cap: number,
): Partial<Resources> {
  const stolen: Partial<Resources> = {};
  let remaining = cap;
  const others = RESOURCE_TYPES.filter((t) => t !== priority).sort(
    (a, b) => defender.resources[b] - defender.resources[a],
  );
  for (const t of [priority, ...others]) {
    if (remaining <= 0) break;
    const room = state.config.storageCap - attacker.resources[t];
    const take = Math.min(remaining, defender.resources[t], Math.max(0, room));
    if (take <= 0) continue;
    removeResource(defender, t, take);
    addResource(state, attacker, t, take);
    stolen[t] = (stolen[t] ?? 0) + take;
    remaining -= take;
  }
  return stolen;
}

function resolveStrongholdRaid(state: MatchState, raid: RaidOrder, attacker: PlayerState, view: RaidResolutionView, now: number): void {
  const defender = getPlayer(state, (raid.target as { playerId: string }).playerId);
  if (defender.eliminated) {
    view.notes.push(`${defender.name} had already fallen; the raid found nothing.`);
    return;
  }
  const truce = inTruce(state, attacker.id, defender.id);
  if (truce && !truce.brokenBy.includes(attacker.id)) {
    truce.brokenBy.push(attacker.id);
    view.notes.push(`${attacker.name} broke their truce with ${defender.name}!`);
  }

  let atk = attackStrength(state, raid, view);

  // Defense components.
  let fort = defender.fortDefense;
  if (raidUses(raid, "tunnel_rats")) {
    const bypass = Math.min(fort, param("tunnel_rats", "bypassFort"));
    fort -= bypass;
    if (bypass > 0) view.attackBreakdown.push(`Tunnel Rats bypass ${bypass} fort`);
  }
  view.defenseBreakdown.push(`Fort ${fort}${defender.fortDefense === 0 ? " (exposed)" : ""}`);

  let soft = 0; // barricades, reinforcements and card defense: can be distracted by Decoy Caravan
  if (defender.barricadeDefense > 0) {
    soft += defender.barricadeDefense;
    view.defenseBreakdown.push(`Barricade +${defender.barricadeDefense}`);
  }
  let usedReinforcement = false;
  if (defender.reinforcementDefense > 0) {
    soft += defender.reinforcementDefense;
    usedReinforcement = true;
    view.defenseBreakdown.push(`Reinforcements +${defender.reinforcementDefense}`);
  }
  const trap = defender.defenseCards.find((c) => c.cardId === "booby_trap" && !defender.usedDefenseUids.includes(c.uid));
  if (trap) {
    soft += param("booby_trap", "defense");
    defender.usedDefenseUids.push(trap.uid);
    view.defenseCards.push("booby_trap");
    view.defenseBreakdown.push(`Booby Trap +${param("booby_trap", "defense")}`);
  }
  if (hasDefenseCard(defender, "reinforced_gates")) {
    soft += param("reinforced_gates", "defense");
    view.defenseCards.push("reinforced_gates");
    view.defenseBreakdown.push(`Reinforced Gates +${param("reinforced_gates", "defense")}`);
  }
  if (raidUses(raid, "decoy_caravan") && soft > 0) {
    const cut = Math.min(soft, param("decoy_caravan", "reduceDefense"));
    soft -= cut;
    view.defenseBreakdown.push(`Decoy Caravan distracts -${cut}`);
  }
  const counterAmbush = hasDefenseCard(defender, "counter_ambush");
  if (counterAmbush) {
    const cut = atk >= param("counter_ambush", "threshold") ? param("counter_ambush", "bigReduction") : param("counter_ambush", "smallReduction");
    atk = Math.max(0, atk - cut);
    view.defenseCards.push("counter_ambush");
    view.attackBreakdown.push(`Counter-Ambush -${cut}`);
  }
  const hasVault = hasDefenseCard(defender, "decoy_vault");
  if (hasVault) view.defenseCards.push("decoy_vault");

  const def = fort + soft;
  view.attackStrength = atk;
  view.defenseStrength = def;
  view.success = atk > def;

  // Barricades are used up by any raid on the stronghold; reinforcements by the next raid.
  defender.barricadeDefense = 0;
  if (usedReinforcement) defender.reinforcementDefense = 0;

  if (view.success) {
    attacker.successfulRaids += 1;
    state.stats.raidsSucceeded += 1;
    let cap = raidUses(raid, "hit_and_run") ? param("hit_and_run", "stealCap") : state.config.maxStealUnits;
    if (counterAmbush) {
      cap = Math.floor(cap / 2);
      view.notes.push("Counter-Ambush halved the plunder.");
    }
    if (hasVault) {
      cap = Math.max(0, cap - param("decoy_vault", "protect"));
      view.notes.push("Decoy Vault protected part of the stores.");
    }
    const stolen = stealResources(state, attacker, defender, raid.priority, cap);
    if (raidUses(raid, "sneaky_heist")) {
      const want = Math.min(param("sneaky_heist", "bonusGold"), defender.resources.gold, state.config.storageCap - attacker.resources.gold);
      if (want > 0) {
        removeResource(defender, "gold", want);
        addResource(state, attacker, "gold", want);
        stolen.gold = (stolen.gold ?? 0) + want;
        view.notes.push(`Sneaky Heist grabbed ${want} extra gold.`);
      }
    }
    view.stolen = stolen;

    let damage = 1 + (raidUses(raid, "battering_ram") ? param("battering_ram", "extraFortDamage") : 0);
    if (counterAmbush) damage = 0;
    const before = defender.fortDefense;
    defender.fortDefense = Math.max(0, defender.fortDefense - damage);
    view.fortDamage = before - defender.fortDefense;

    let pts = SCORING.successfulRaid;
    award(state, attacker, SCORING.successfulRaid, `Successful raid on ${defender.name}`);
    if (before > 0 && defender.fortDefense === 0) {
      award(state, attacker, SCORING.destroyFort, `Destroyed ${defender.name}'s fort`);
      pts += SCORING.destroyFort;
      view.notes.push(`${defender.name}'s fort has been destroyed!`);
    }
    const bounty = attacker.effects.bounty;
    if (bounty && bounty.targetId === defender.id && bounty.untilRound >= state.round) {
      award(state, attacker, param("bounty_contract", "points"), `Bounty Contract on ${defender.name}`);
      pts += param("bounty_contract", "points");
      attacker.effects.bounty = null;
      view.notes.push("Bounty Contract collected!");
    }
    const ev = state.activeEvent;
    if (ev?.id === "bounty_board" && ev.wealthiestIds.includes(defender.id) && !ev.claimed.bounty) {
      ev.claimed.bounty = true;
      award(state, attacker, 3, `Bounty Board: raided ${defender.name}`);
      pts += 3;
      view.notes.push("Bounty Board reward claimed!");
    }
    if (defender.fortDefense === 0 && playerTotal(defender) === 0) {
      defender.eliminated = true;
      award(state, attacker, SCORING.eliminateRival, `Eliminated ${defender.name}`);
      pts += SCORING.eliminateRival;
      view.notes.push(`${defender.name} has been eliminated!`);
      log(state, now, `${defender.name} has been eliminated by ${attacker.name}!`, "raid");
    }
    view.pointsAwarded = pts;
  } else {
    let penalty = raidUses(raid, "hit_and_run") ? 0 : state.config.failedRaidGoldPenalty;
    if (raidUses(raid, "hit_and_run")) view.notes.push("Hit and Run: no failure penalty.");
    if (trap) {
      penalty += param("booby_trap", "attackerGoldLoss");
      view.notes.push("The Booby Trap sprung on the attackers!");
    }
    view.goldLost = removeResource(attacker, "gold", penalty);
  }
}

function resolveLocationRaid(state: MatchState, raid: RaidOrder, attacker: PlayerState, view: RaidResolutionView, now: number): void {
  const locationId = (raid.target as { locationId: string }).locationId;
  const loc = getLocation(locationId);
  const victims = Object.values(state.parties).filter(
    (p) => p.locationId === locationId && p.status === "gathering" && p.ownerId !== attacker.id,
  );
  const atk = attackStrength(state, raid, view);
  view.attackStrength = atk;
  view.defenseStrength = victims.length;
  view.defenseBreakdown.push(`${victims.length} enemy part${victims.length === 1 ? "y" : "ies"} on site`);
  if (victims.length === 0) {
    view.notes.push(`The ambush at ${loc?.name} found nobody. No penalty.`);
    return;
  }
  view.success = atk > victims.length;
  if (!view.success) {
    const penalty = raidUses(raid, "hit_and_run") ? 0 : state.config.failedRaidGoldPenalty;
    view.goldLost = removeResource(attacker, "gold", penalty);
    view.notes.push("The gatherers fought off the ambush.");
    return;
  }
  let cap = raidUses(raid, "hit_and_run") ? param("hit_and_run", "stealCap") : state.config.maxStealUnits;
  const stolen: Partial<Resources> = {};
  for (const party of victims) {
    const owner = getPlayer(state, party.ownerId);
    const truce = inTruce(state, attacker.id, owner.id);
    if (truce && !truce.brokenBy.includes(attacker.id)) truce.brokenBy.push(attacker.id);
    const got = interceptParty(state, party, now, cap);
    if (got.type && got.amount > 0) {
      const stored = addResource(state, attacker, got.type, got.amount);
      stolen[got.type] = (stolen[got.type] ?? 0) + stored;
      cap -= got.amount;
    }
    log(state, now, `Your party at ${loc?.name} was ambushed by ${attacker.name} and lost what it was carrying.`, "private", [owner.id], {
      category: "raid",
      actors: [attacker.id, owner.id],
      why: "Parties gathering at contested sites can be ambushed.",
    });
  }
  view.stolen = stolen;
  const any = Object.values(stolen).some((v) => (v ?? 0) > 0);
  if (any) {
    attacker.successfulRaids += 1;
    state.stats.raidsSucceeded += 1;
    award(state, attacker, SCORING.successfulRaid, `Successful ambush at ${loc?.name}`);
    view.pointsAwarded = SCORING.successfulRaid;
  } else {
    view.notes.push("The gatherers were scattered, but carried nothing yet.");
  }
}

/** Locks and resolves every committed raid in deterministic order. Runs exactly once per round. */
export function resolveRaids(state: MatchState, now: number): void {
  const order = raidResolutionOrder(state);
  const views: RaidResolutionView[] = [];
  order.forEach((attackerId, i) => {
    const raid = state.raids[attackerId] as RaidOrder;
    const attacker = getPlayer(state, attackerId);
    const view = emptyView(i + 1, raid);
    const defender = raid.target.kind === "player" ? state.players[raid.target.playerId] : undefined;
    const attackerBefore = { ...attacker.resources };
    const defenderBefore = defender ? { ...defender.resources } : null;
    if (attacker.eliminated) {
      view.notes.push(`${attacker.name} was eliminated before their raid could land.`);
    } else if (raid.target.kind === "player") {
      resolveStrongholdRaid(state, raid, attacker, view, now);
    } else {
      resolveLocationRaid(state, raid, attacker, view, now);
    }
    for (const c of [raid.primary, raid.support]) if (c) state.discard.push(c);
    views.push(view);
    const targetName =
      raid.target.kind === "player" ? getPlayer(state, raid.target.playerId).name : getLocation(raid.target.locationId)?.name;
    const why = view.success
      ? `Attack ${view.attackStrength} was greater than defense ${view.defenseStrength}.`
      : view.defenseBreakdown.length === 0 || view.attackStrength === 0
        ? (view.notes[0] ?? "The raid did not land.")
        : `Attack ${view.attackStrength} did not exceed defense ${view.defenseStrength}.`;
    const actors = [attacker.id, ...(defender ? [defender.id] : [])];
    log(
      state,
      now,
      `${attacker.name} raided ${targetName}: ${view.success ? "SUCCESS" : "failed"} (${view.attackStrength} vs ${view.defenseStrength})` +
        (view.success ? `, took ${formatResources(view.stolen)}` : "") +
        (view.fortDamage > 0 ? `, fort −${view.fortDamage}` : ""),
      "raid",
      null,
      { category: "raid", actors, why },
    );
    // Private "what changed for you" entries.
    log(state, now, `Your raid on ${targetName} ${view.success ? "succeeded" : "failed"}.`, "private", [attacker.id], {
      category: "raid",
      actors,
      delta: resourceDelta(attackerBefore, attacker.resources),
      why,
    });
    if (defender && defenderBefore) {
      const lost = view.fortDamage > 0 ? ` Your fort lost ${view.fortDamage} (now ${defender.fortDefense}).` : "";
      log(state, now, `${attacker.name} raided you and ${view.success ? "broke through" : "was repelled"}.${lost}`, "private", [defender.id], {
        category: "raid",
        actors,
        delta: resourceDelta(defenderBefore, defender.resources),
        why,
      });
    }
  });
  state.resolutions = views;
  state.resolutionRound = state.round;
  state.raids = {};
}

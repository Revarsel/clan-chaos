import { RESOURCE_TYPES, type Point, type ResourceType } from "@clan-chaos/shared";
import { CARDS, MAP_LOCATIONS, getLocation, type MapLocation } from "@clan-chaos/game-content";
import type { MatchState, Party, PlayerState } from "./state.js";
import { addResource, distance, fail, getPlayer, log, resourceDelta } from "./helpers.js";
import { randomInt } from "./rng.js";

const INTERCEPT_PAUSE_MS = 2_000;

export function travelMs(state: MatchState, from: Point, to: Point): number {
  return travelDurationMs(from, to, state.config.partySpeed);
}

/** One-way travel time for a party. Also used by the client to estimate trip length (display only). */
export function travelDurationMs(from: Point, to: Point, speed: number): number {
  return Math.max(500, Math.round((distance(from, to) / speed) * 1000));
}

export function partyPosition(party: Party, now: number): Point {
  if (party.status !== "traveling" && party.status !== "returning") return party.to;
  const span = party.arriveAt - party.departAt;
  const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (now - party.departAt) / span));
  return { x: party.from.x + (party.to.x - party.from.x) * t, y: party.from.y + (party.to.y - party.from.y) * t };
}

export function isGatherable(loc: MapLocation | undefined): loc is MapLocation {
  return !!loc && loc.resource !== null && loc.kind !== "trading_post";
}

/** Party carrying capacity, including Resource Rush bonus at the rushed location. */
export function partyCapacity(state: MatchState, p: PlayerState, locationId: string): number {
  const rush = p.effects.rush;
  const bonus = rush && rush.locationId === locationId && rush.untilRound >= state.round ? CARDS.resource_rush.params.capacityBonus ?? 0 : 0;
  return state.config.partyCapacity + bonus;
}

/** Yield for one trip, before stock limits. Never below 1. */
export function tripYield(state: MatchState, p: PlayerState, loc: MapLocation, resource: ResourceType): number {
  let y = loc.baseYield;
  const rush = p.effects.rush;
  if (rush && rush.locationId === loc.id && rush.untilRound >= state.round) y += CARDS.resource_rush.params.yieldBonus ?? 0;
  if (p.effects.trail.some((t) => t.locationId === loc.id && t.untilRound >= state.round)) {
    y += CARDS.trail_markers.params.yieldBonus ?? 0;
  }
  if (p.effects.sabotagedUntil >= state.round) y -= CARDS.sabotage_supplies.params.yieldPenalty ?? 0;
  if (resource === "food" && state.activeEvent?.id === "food_shortage") y -= 1;
  return Math.max(1, y);
}

export function startGather(state: MatchState, p: PlayerState, partyId: string, locationId: string, now: number): void {
  const party = state.parties[partyId];
  if (!party || party.ownerId !== p.id) return fail("NOT_FOUND", "That party is not yours");
  if (party.status !== "idle") fail("INVALID", "That party is busy");
  const loc = getLocation(locationId);
  if (!isGatherable(loc)) return fail("INVALID", "Nothing to gather there");
  if ((state.locations[loc.id]?.stock ?? 0) <= 0) fail("INVALID", `${loc.name} is depleted`);
  party.status = "traveling";
  party.locationId = loc.id;
  party.from = p.home;
  party.to = loc.position;
  party.departAt = now;
  party.arriveAt = now + travelMs(state, p.home, loc.position);
  party.reserved = 0;
  party.load = 0;
  party.resource = null;
}

function sendHome(state: MatchState, party: Party, from: Point, now: number): void {
  const owner = getPlayer(state, party.ownerId);
  party.status = "returning";
  party.from = from;
  party.to = owner.home;
  party.departAt = now;
  party.arriveAt = now + travelMs(state, from, owner.home);
}

/** Returns unused reserved stock to the location, never exceeding its maximum. */
function releaseStock(state: MatchState, locationId: string | null, amount: number): void {
  if (!locationId || amount <= 0) return;
  const loc = getLocation(locationId);
  const ls = state.locations[locationId];
  if (!loc || !ls) return;
  ls.stock = Math.min(loc.maxStock, ls.stock + amount);
}

/** Partial units earned so far by a working party. */
export function partialLoad(party: Party, now: number): number {
  if (party.status !== "gathering") return 0;
  const span = party.workEndsAt - party.workStartAt;
  const frac = span <= 0 ? 1 : Math.min(1, Math.max(0, (now - party.workStartAt) / span));
  return Math.floor(party.reserved * frac);
}

export function recallParty(state: MatchState, p: PlayerState, partyId: string, now: number): void {
  const party = state.parties[partyId];
  if (!party || party.ownerId !== p.id) return fail("NOT_FOUND", "That party is not yours");
  if (party.status === "traveling") {
    const pos = partyPosition(party, now);
    party.load = 0;
    sendHome(state, party, pos, now);
    return;
  }
  if (party.status === "gathering") {
    const earned = partialLoad(party, now);
    releaseStock(state, party.locationId, party.reserved - earned);
    party.load = earned;
    party.reserved = 0;
    sendHome(state, party, party.to, now);
    return;
  }
  fail("INVALID", "That party cannot be recalled right now");
}

/** Interception by a location raid: the raider takes up to `cap` units; the rest is lost back to the site. */
export function interceptParty(state: MatchState, party: Party, now: number, cap: number): { type: ResourceType | null; amount: number } {
  const earned = partialLoad(party, now);
  const stolen = Math.min(cap, earned);
  releaseStock(state, party.locationId, party.reserved - stolen);
  party.reserved = 0;
  party.load = 0;
  party.status = "intercepted";
  party.departAt = now;
  party.arriveAt = now + INTERCEPT_PAUSE_MS;
  return { type: party.resource, amount: stolen };
}

function arriveAtLocation(state: MatchState, party: Party, at: number): void {
  const owner = getPlayer(state, party.ownerId);
  const loc = getLocation(party.locationId ?? "");
  const ls = loc ? state.locations[loc.id] : undefined;
  if (!loc || !ls || !isGatherable(loc) || ls.stock <= 0) {
    log(state, at, `Your party found ${loc?.name ?? "the site"} empty and is heading home.`, "private", [owner.id], {
      category: "gather",
      why: "Site stock regenerates slowly over time.",
    });
    sendHome(state, party, party.to, at);
    return;
  }
  const resource: ResourceType =
    loc.resource === "mixed" ? (RESOURCE_TYPES[randomInt(state, RESOURCE_TYPES.length)] as ResourceType) : loc.resource!;
  const wanted = Math.min(tripYield(state, owner, loc, resource), partyCapacity(state, owner, loc.id));
  const reserved = Math.min(wanted, ls.stock);
  ls.stock -= reserved;
  party.reserved = reserved;
  party.resource = resource;
  party.status = "gathering";
  party.workStartAt = at;
  party.workEndsAt = at + loc.gatherMs;
}

function deliver(state: MatchState, party: Party, at: number): void {
  const owner = getPlayer(state, party.ownerId);
  if (party.load > 0 && party.resource) {
    const before = { ...owner.resources };
    const stored = addResource(state, owner, party.resource, party.load);
    const from = getLocation(party.locationId ?? "")?.name;
    let msg = `A party delivered ${stored} ${party.resource}${from ? ` from ${from}` : ""}.`;
    let why: string | undefined;
    if (stored < party.load) {
      msg += ` ${party.load - stored} spoiled (storage full).`;
      why = `Each resource is capped at ${state.config.storageCap}.`;
    }
    if (party.resource === "gold" && stored > 0 && state.activeEvent?.id === "gold_rush" && !state.activeEvent.claimed[owner.id]) {
      state.activeEvent.claimed[owner.id] = true;
      const bonus = addResource(state, owner, "gold", 2);
      msg += ` Gold Rush bonus: +${bonus} gold!`;
    }
    log(state, at, msg, "private", [owner.id], {
      category: "gather",
      delta: resourceDelta(before, owner.resources),
      why,
    });
  }
  party.status = "idle";
  party.locationId = null;
  party.load = 0;
  party.reserved = 0;
  party.resource = null;
  party.from = owner.home;
  party.to = owner.home;
}

/** Advances every party to `now`. Each transition is processed at its own timestamp. */
export function tickParties(state: MatchState, now: number): boolean {
  let changed = false;
  for (const party of Object.values(state.parties)) {
    for (let guard = 0; guard < 6; guard++) {
      if (party.status === "traveling" && now >= party.arriveAt) {
        arriveAtLocation(state, party, party.arriveAt);
      } else if (party.status === "gathering" && now >= party.workEndsAt) {
        party.load = party.reserved;
        party.reserved = 0;
        sendHome(state, party, party.to, party.workEndsAt);
      } else if (party.status === "intercepted" && now >= party.arriveAt) {
        sendHome(state, party, party.to, party.arriveAt);
      } else if (party.status === "returning" && now >= party.arriveAt) {
        deliver(state, party, party.arriveAt);
      } else break;
      changed = true;
    }
  }
  return changed;
}

export function tickRegen(state: MatchState, now: number): boolean {
  let changed = false;
  while (now - state.lastRegenAt >= state.config.stockRegenIntervalMs) {
    state.lastRegenAt += state.config.stockRegenIntervalMs;
    for (const loc of MAP_LOCATIONS) {
      const ls = state.locations[loc.id];
      if (ls && ls.stock < loc.maxStock) {
        ls.stock = Math.min(loc.maxStock, ls.stock + loc.regenPerTick);
        changed = true;
      }
    }
  }
  return changed;
}

export function stockLevel(stock: number, max: number): "rich" | "steady" | "poor" | "empty" {
  if (stock <= 0) return "empty";
  if (stock >= max * 0.66) return "rich";
  if (stock >= max * 0.33) return "steady";
  return "poor";
}

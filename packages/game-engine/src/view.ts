import type { PlayerView, PublicPlayerView, RaidResolutionView, SelfView } from "@clan-chaos/shared";
import { EVENTS, MAP_LOCATIONS } from "@clan-chaos/game-content";
import type { MatchState, PlayerState } from "./state.js";
import { stockLevel } from "./gathering.js";
import { cardBuyCost } from "./commands.js";

function publicPlayer(state: MatchState, p: PlayerState): PublicPlayerView {
  return {
    id: p.id,
    name: p.name,
    clan: p.clan,
    seat: p.seat,
    color: p.color,
    fortDefense: p.fortDefense,
    hasBarricade: p.barricadeDefense > 0,
    handSize: p.hand.length,
    partyCount: Object.values(state.parties).filter((x) => x.ownerId === p.id).length,
    score: p.score,
    successfulRaids: p.successfulRaids,
    connected: p.connected,
    inactive: p.inactive,
    eliminated: p.eliminated,
    hasCommittedRaid: !!state.raids[p.id],
    abilityUsed: p.abilityUsed,
  };
}

function selfView(state: MatchState, p: PlayerState): SelfView {
  const raid = state.raids[p.id];
  const effects: string[] = [];
  const r = state.round;
  if (p.effects.counterIntelUntil >= r) effects.push(`Counter-Intel active (until round ${p.effects.counterIntelUntil})`);
  if (p.effects.merchantUntil >= r) effects.push(`Merchant Caravan: 2:1 market (until round ${p.effects.merchantUntil})`);
  if (p.effects.rush && p.effects.rush.untilRound >= r) effects.push(`Resource Rush at ${MAP_LOCATIONS.find((l) => l.id === p.effects.rush!.locationId)?.name}`);
  for (const t of p.effects.trail.filter((x) => x.untilRound >= r)) {
    effects.push(`Trail Markers at ${MAP_LOCATIONS.find((l) => l.id === t.locationId)?.name}`);
  }
  if (p.effects.sabotagedUntil >= r) effects.push(`Sabotaged: gathering -2 (until round ${p.effects.sabotagedUntil})`);
  if (p.effects.skipUpkeep) effects.push("Emergency Rations: next upkeep is free");
  if (p.effects.bounty && p.effects.bounty.untilRound >= r) effects.push(`Bounty on ${state.players[p.effects.bounty.targetId]?.name}`);
  return {
    id: p.id,
    resources: { ...p.resources },
    safeReserve: { ...p.safeReserve },
    storageCap: state.config.storageCap,
    fortDefense: p.fortDefense,
    fortMax: p.fortLevel,
    barricadeDefense: p.barricadeDefense,
    mercenaryBonus: p.mercenaryBonus,
    reinforcementDefense: p.reinforcementDefense,
    hand: p.hand.map((c) => ({ ...c })),
    maxHandSize: state.config.maxHandSize,
    raid: raid
      ? {
          target: raid.target,
          primaryCard: raid.primary?.cardId ?? null,
          supportCard: raid.support?.cardId ?? null,
          priority: raid.priority,
          mercenaryBonus: raid.mercenaryBonus,
        }
      : null,
    defenseCards: p.defenseCards.map((c) => ({ ...c })),
    cardsBoughtThisRound: p.cardsBoughtThisRound,
    tradesOfferedThisRound: p.tradesOfferedThisRound,
    abilityUsed: p.abilityUsed,
    scoreBreakdown: [...p.scoreBreakdown],
    effects,
    nextCardCost: cardBuyCost(state, p),
    scoutedThisRound: [...p.scoutedThisRound],
  };
}

/**
 * Builds the authorised view for one player. Secret state (other hands, resources, raid targets,
 * committed defenses, party loads) is never copied into another player's view.
 */
export function buildPlayerView(state: MatchState, viewerId: string, serverNow: number): PlayerView {
  const viewer = state.players[viewerId];
  const r = state.round;
  const trailIds = new Set(viewer?.effects.trail.filter((t) => t.untilRound >= r).map((t) => t.locationId) ?? []);
  const resolutions: RaidResolutionView[] = state.resolutions.map((v) => ({ ...v }));
  return {
    matchId: state.id,
    seq: state.seq,
    serverNow,
    youId: viewerId,
    round: state.round,
    totalRounds: state.config.totalRounds,
    phase: state.phase,
    phaseEndsAt: state.phaseEndsAt,
    phaseDurations: { build: state.config.buildMs, scheme: state.config.schemeMs, resolution: state.config.resolutionMs },
    players: state.seatOrder.map((id) => publicPlayer(state, state.players[id] as PlayerState)),
    self: viewer ? selfView(state, viewer) : null,
    parties: Object.values(state.parties).map((x) => ({
      id: x.id,
      ownerId: x.ownerId,
      status: x.status,
      locationId: x.locationId,
      from: x.from,
      to: x.to,
      departAt: x.departAt,
      arriveAt: x.status === "gathering" ? x.workEndsAt : x.arriveAt,
      workEndsAt: x.workEndsAt,
      load: x.ownerId === viewerId ? x.load || x.reserved : null,
    })),
    locations: MAP_LOCATIONS.filter((l) => l.resource !== null).map((l) => {
      const stock = state.locations[l.id]?.stock ?? 0;
      return { id: l.id, stockLevel: stockLevel(stock, l.maxStock), exactStock: trailIds.has(l.id) ? stock : null };
    }),
    activeEvent: state.activeEvent
      ? {
          id: state.activeEvent.id,
          name: EVENTS[state.activeEvent.id].name,
          description:
            EVENTS[state.activeEvent.id].description +
            (state.activeEvent.id === "bounty_board"
              ? ` Target: ${state.activeEvent.wealthiestIds.map((id) => state.players[id]?.name).join(" & ")}${state.activeEvent.claimed.bounty ? " (claimed)" : ""}.`
              : ""),
          untilRound: state.activeEvent.untilRound,
        }
      : null,
    upcomingEventNotice: state.pendingEvent
      ? `${EVENTS[state.pendingEvent].name}: ${EVENTS[state.pendingEvent].description}`
      : null,
    merchantCard: state.activeEvent?.id === "wandering_merchant" ? (state.merchantCard?.cardId ?? null) : null,
    trades: state.trades
      .filter((t) => t.fromId === viewerId || t.toId === viewerId)
      .map(({ round: _round, ...t }) => ({ ...t })),
    truceOffer: (() => {
      const o = state.truceOffers.find((x) => x.toId === viewerId);
      return o ? { fromId: o.fromId } : null;
    })(),
    truces: state.truces.map((t) => ({ a: t.a, b: t.b, untilRound: t.untilRound })),
    resolutions,
    resolutionRound: state.resolutionRound,
    intel: [...(state.intel[viewerId] ?? [])].slice(-20),
    log: state.log
      .filter((e) => e.visibleTo === null || e.visibleTo.includes(viewerId))
      .slice(-60)
      .map((e) => ({ at: e.at, round: e.round, text: e.text, kind: e.kind })),
    results: state.results,
  };
}

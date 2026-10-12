import { RESOURCE_TYPES, totalResources, type FinalStanding } from "@clan-chaos/shared";
import { ACTION_VALUES, CARDS, EVENTS, SCORING } from "@clan-chaos/game-content";
import type { MatchState, PlayerState } from "./state.js";
import { addResource, award, log, playerTotal, removeResource } from "./helpers.js";
import { resolveRaids } from "./raids.js";
import { tickParties, tickRegen } from "./gathering.js";

const alive = (state: MatchState): PlayerState[] =>
  state.seatOrder.map((id) => state.players[id] as PlayerState).filter((p) => !p.eliminated);

const isEnded = (state: MatchState): boolean => state.phase === "ended";

/** Advances timers, parties and phases up to `now`. Returns true if anything changed. */
export function tick(state: MatchState, now: number): boolean {
  if (state.phase === "ended") return false;
  let changed = false;
  // Process time in phase-sized steps so that party events and phase changes interleave correctly.
  for (let guard = 0; guard < 64 && !isEnded(state); guard++) {
    const until = Math.min(now, state.phaseEndsAt);
    if (tickParties(state, until)) changed = true;
    if (tickRegen(state, until)) changed = true;
    if (now < state.phaseEndsAt) break;
    advancePhase(state, state.phaseEndsAt);
    changed = true;
  }
  for (const p of Object.values(state.players)) {
    if (!p.connected && !p.inactive && p.disconnectedAt !== null && now - p.disconnectedAt >= state.config.inactiveAfterMs) {
      p.inactive = true;
      log(state, now, `${p.name} has gone quiet; their clan is now inactive.`);
      changed = true;
    }
  }
  return changed;
}

export function advancePhase(state: MatchState, at: number): void {
  const c = state.config;
  if (state.phase === "build") {
    state.phase = "scheme";
    state.phaseStartedAt = at;
    state.phaseEndsAt = at + c.schemeMs;
    log(state, at, `Round ${state.round}: Scheme & Commit began. Submit raids before the timer ends.`, "event", null, { category: "phase" });
  } else if (state.phase === "scheme") {
    state.phase = "resolution";
    state.phaseStartedAt = at;
    state.phaseEndsAt = at + c.resolutionMs;
    resolveRaids(state, at);
    if (c.eventRounds.includes(state.round) && state.round < c.totalRounds) announceEvent(state, at);
    if (alive(state).length <= 1) endMatch(state, at, "last_clan_standing");
  } else if (state.phase === "resolution") {
    endRound(state, at);
  }
}

function announceEvent(state: MatchState, at: number): void {
  const id = state.eventQueue.shift();
  if (!id) return;
  state.pendingEvent = id;
  log(state, at, `Coming next round: ${EVENTS[id].name}! ${EVENTS[id].description}`, "event", null, { category: "event" });
}

function activatePendingEvent(state: MatchState, at: number): void {
  const id = state.pendingEvent;
  if (!id) return;
  state.pendingEvent = null;
  const players = alive(state);
  const richest = Math.max(...players.map((p) => playerTotal(p)));
  state.activeEvent = {
    id,
    startRound: state.round,
    untilRound: state.round + state.config.eventDurationRounds - 1,
    wealthiestIds: players.filter((p) => playerTotal(p) === richest).map((p) => p.id),
    claimed: {},
  };
  state.merchantCard = null;
  log(state, at, `Event: ${EVENTS[id].name} is now active!`, "event", null, { category: "event", why: EVENTS[id].description });
  if (id === "fort_inspection") {
    for (const p of players) {
      if (p.fortDefense >= state.config.fortMax) award(state, p, EVENTS.fort_inspection.points, "Fort Inspection passed", at);
    }
  } else if (id === "goblin_tax") {
    for (const p of players) {
      if (p.resources.gold > 15) {
        removeResource(p, "gold", 2);
        log(state, at, "Goblin Tax: the goblins collected 2 gold from you.", "private", [p.id], {
          category: "event",
          delta: { gold: -2 },
          why: "Clans holding more than 15 gold pay 2 gold.",
        });
      }
    }
  } else if (id === "wandering_merchant") {
    // Take a random card from the deck for sale; it returns to the discard if unsold.
    if (state.deck.length === 0 && state.discard.length > 0) {
      state.deck = state.discard;
      state.discard = [];
    }
    state.merchantCard = state.deck.shift() ?? null;
  } else if (id === "bounty_board") {
    const names = state.activeEvent.wealthiestIds.map((pid) => state.players[pid]?.name).join(" & ");
    log(state, at, `Bounty Board: the wealthiest clan is ${names}.`, "event");
  }
}

function applyUpkeep(state: MatchState, p: PlayerState, at: number): void {
  if (p.effects.skipUpkeep) {
    p.effects.skipUpkeep = false;
    log(state, at, "Emergency Rations covered this round's upkeep.", "private", [p.id], { category: "upkeep" });
    return;
  }
  if (removeResource(p, "food", ACTION_VALUES.upkeepFood) > 0) {
    log(state, at, `Upkeep: you paid ${ACTION_VALUES.upkeepFood} food.`, "private", [p.id], {
      category: "upkeep",
      delta: { food: -ACTION_VALUES.upkeepFood },
      why: "Every clan pays 1 food at the end of each round.",
    });
  } else if (removeResource(p, "gold", ACTION_VALUES.upkeepGoldFallback) > 0) {
    log(state, at, "No food for upkeep: you paid 1 gold instead.", "private", [p.id], {
      category: "upkeep",
      delta: { gold: -ACTION_VALUES.upkeepGoldFallback },
      why: "Without food, upkeep costs 1 gold.",
    });
  } else {
    log(state, at, "No food or gold for upkeep this round (no further penalty).", "private", [p.id], { category: "upkeep" });
  }
}

function endRound(state: MatchState, at: number): void {
  for (const p of alive(state)) {
    applyUpkeep(state, p, at);
    // Return evacuated resources after upkeep.
    for (const t of RESOURCE_TYPES) {
      addResource(state, p, t, p.safeReserve[t]);
      p.safeReserve[t] = 0;
    }
    for (const c of p.defenseCards) state.discard.push(c);
    p.defenseCards = [];
    p.defenseCommitsThisRound = [];
    p.usedDefenseUids = [];
    p.cardsBoughtThisRound = 0;
    p.tradesOfferedThisRound = 0;
    p.scoutedThisRound = [];
  }
  // Truces ending this round pay out to whoever honoured them.
  for (const t of state.truces.filter((x) => x.untilRound === state.round)) {
    for (const pid of [t.a, t.b]) {
      const p = state.players[pid];
      if (p && !p.eliminated && !t.brokenBy.includes(pid)) {
        award(state, p, CARDS.unstable_truce.params.points ?? 2, "Honoured an Unstable Truce", at);
      }
    }
  }
  state.truces = state.truces.filter((t) => t.untilRound > state.round);
  state.truceOffers = [];
  for (const tr of state.trades) if (tr.status === "open") tr.status = "expired";
  state.trades = state.trades.filter((t) => t.round >= state.round);

  if (state.activeEvent && state.activeEvent.untilRound <= state.round) {
    if (state.merchantCard) state.discard.push(state.merchantCard);
    state.merchantCard = null;
    state.activeEvent = null;
  }

  if (state.round >= state.config.totalRounds) {
    endMatch(state, at, "rounds_complete");
    return;
  }
  state.round += 1;
  state.phase = "build";
  state.phaseStartedAt = at;
  state.phaseEndsAt = at + state.config.buildMs;
  activatePendingEvent(state, at);
  log(state, at, `Round ${state.round} of ${state.config.totalRounds}: Build & Gather began.`, "event", null, { category: "phase" });
}

export function endMatch(state: MatchState, at: number, reason: "rounds_complete" | "last_clan_standing"): void {
  if (state.phase === "ended") return;
  // Return evacuated resources so they count towards the final tally.
  for (const p of Object.values(state.players)) {
    for (const t of RESOURCE_TYPES) {
      addResource(state, p, t, p.safeReserve[t]);
      p.safeReserve[t] = 0;
    }
  }
  for (const p of alive(state)) {
    if (p.fortDefense > 0) award(state, p, SCORING.intactFort, "Fort still standing", at);
    for (const t of RESOURCE_TYPES) {
      const pts = Math.floor(p.resources[t] / SCORING.resourcesPerPoint);
      if (pts > 0) award(state, p, pts, `${p.resources[t]} ${t} remaining`, at);
    }
  }
  state.phase = "ended";
  state.phaseStartedAt = at;
  state.phaseEndsAt = at;
  state.results = computeResults(state, reason);
  const winners = state.results.winnerIds.map((id) => state.players[id]?.name).join(" & ");
  log(state, at, `The match is over! Victory: ${winners}.`, "event");
}

export function compareStandings(a: PlayerState, b: PlayerState): number {
  if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
  return (
    b.score - a.score ||
    b.successfulRaids - a.successfulRaids ||
    totalResources(b.resources) - totalResources(a.resources) ||
    b.fortDefense - a.fortDefense
  );
}

export function computeResults(state: MatchState, reason: "rounds_complete" | "last_clan_standing") {
  const players = Object.values(state.players);
  let sorted: PlayerState[];
  if (reason === "last_clan_standing") {
    const survivors = players.filter((p) => !p.eliminated);
    sorted = [...survivors, ...players.filter((p) => p.eliminated).sort(compareStandings)];
  } else {
    sorted = [...players].sort(compareStandings);
  }
  const standings: FinalStanding[] = [];
  sorted.forEach((p, i) => {
    const prev = standings[i - 1];
    const prevP = sorted[i - 1];
    const tied = prev && prevP && compareStandings(prevP, p) === 0;
    standings.push({
      playerId: p.id,
      name: p.name,
      clan: p.clan,
      rank: tied ? prev.rank : i + 1,
      score: p.score,
      isWinner: false,
      successfulRaids: p.successfulRaids,
      totalResources: totalResources(p.resources),
      fortDefense: p.fortDefense,
      eliminated: p.eliminated,
      breakdown: p.scoreBreakdown,
    });
  });
  for (const s of standings) s.isWinner = s.rank === 1 && !s.eliminated;
  return {
    endedReason: reason,
    winnerIds: standings.filter((s) => s.isWinner).map((s) => s.playerId),
    standings,
    stats: { ...state.stats },
  };
}

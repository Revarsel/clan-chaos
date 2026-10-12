import { CARD_IDS, EVENT_IDS, emptyResources, type CardInstance } from "@clan-chaos/shared";
import {
  DEFAULT_CONFIG,
  MAP_LOCATIONS,
  PLAYER_COLORS,
  STRONGHOLD_SLOTS,
  type MatchConfig,
} from "@clan-chaos/game-content";
import type { MatchState, NewPlayer, Party, PlayerState } from "./state.js";
import { hashSeed, shuffle } from "./rng.js";
import { drawCard, fail, log } from "./helpers.js";

export interface CreateMatchOptions {
  id: string;
  seed: string;
  players: NewPlayer[];
  now: number;
  config?: Partial<MatchConfig>;
}

export function createMatch(opts: CreateMatchOptions): MatchState {
  const config: MatchConfig = { ...DEFAULT_CONFIG, ...opts.config };
  if (opts.players.length < config.minPlayers || opts.players.length > config.maxPlayers) {
    fail("INVALID", `A match needs ${config.minPlayers}-${config.maxPlayers} players`);
  }
  const state: MatchState = {
    id: opts.id,
    config,
    rng: hashSeed(opts.seed),
    round: 1,
    phase: "build",
    phaseStartedAt: opts.now,
    phaseEndsAt: opts.now + config.buildMs,
    seq: 0,
    players: {},
    seatOrder: [],
    deck: [],
    discard: [],
    nextUid: 1,
    locations: {},
    lastRegenAt: opts.now,
    parties: {},
    raids: {},
    trades: [],
    nextTradeId: 1,
    truceOffers: [],
    truces: [],
    eventQueue: [],
    activeEvent: null,
    pendingEvent: null,
    merchantCard: null,
    resolutions: [],
    resolutionRound: 0,
    intel: {},
    log: [],
    processed: {},
    stats: { raidsLaunched: 0, raidsSucceeded: 0, tradesCompleted: 0, cardsPlayed: 0 },
    results: null,
  };

  // Deck: every card type, `deckCopies` copies each.
  const cards: CardInstance[] = [];
  for (let c = 0; c < config.deckCopies; c++) {
    for (const cardId of CARD_IDS) cards.push({ uid: `c${state.nextUid++}`, cardId });
  }
  state.deck = shuffle(state, cards);
  state.eventQueue = shuffle(state, [...EVENT_IDS]);

  for (const loc of MAP_LOCATIONS) state.locations[loc.id] = { stock: loc.maxStock };

  const seats = shuffle(
    state,
    opts.players.map((_, i) => i),
  );
  opts.players.forEach((np, i) => {
    const seat = seats[i] as number;
    const fortLevel = np.clan === "toads" ? Math.min(config.fortMax, config.startingFort + 2) : config.startingFort;
    const p: PlayerState = {
      id: np.id,
      name: np.name,
      clan: np.clan,
      seat,
      color: PLAYER_COLORS[seat % PLAYER_COLORS.length] as string,
      home: STRONGHOLD_SLOTS[seat] as { x: number; y: number },
      resources: { ...config.startingResources },
      safeReserve: emptyResources(),
      fortLevel,
      fortDefense: fortLevel,
      barricadeDefense: 0,
      mercenaryBonus: 0,
      reinforcementDefense: 0,
      hand: [],
      defenseCards: [],
      defenseCommitsThisRound: [],
      usedDefenseUids: [],
      score: 0,
      scoreBreakdown: [],
      successfulRaids: 0,
      raidsLaunched: 0,
      connected: true,
      disconnectedAt: null,
      inactive: false,
      eliminated: false,
      abilityUsed: false,
      cardsBoughtThisRound: 0,
      tradesOfferedThisRound: 0,
      scoutedThisRound: [],
      effects: {
        counterIntelUntil: 0,
        merchantUntil: 0,
        rush: null,
        trail: [],
        sabotagedUntil: 0,
        skipUpkeep: false,
        bounty: null,
      },
    };
    state.players[p.id] = p;
    state.intel[p.id] = [];
  });
  state.seatOrder = Object.values(state.players)
    .sort((a, b) => a.seat - b.seat)
    .map((p) => p.id);

  for (const pid of state.seatOrder) {
    const p = state.players[pid] as PlayerState;
    for (let i = 0; i < config.startingHand; i++) drawCard(state, p);
    for (let i = 0; i < config.startingParties; i++) addParty(state, p);
  }
  log(state, opts.now, "The match begins! Round 1: Build and Gather.", "event");
  return state;
}

export function addParty(state: MatchState, p: PlayerState): Party {
  const idx = Object.values(state.parties).filter((x) => x.ownerId === p.id).length + 1;
  const party: Party = {
    id: `${p.id}-p${idx}`,
    ownerId: p.id,
    status: "idle",
    locationId: null,
    from: p.home,
    to: p.home,
    departAt: 0,
    arriveAt: 0,
    workStartAt: 0,
    workEndsAt: 0,
    reserved: 0,
    resource: null,
    load: 0,
  };
  state.parties[party.id] = party;
  return party;
}

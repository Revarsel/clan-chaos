import type { Resources } from "@clan-chaos/shared";

/** Tunable balance values. All values are documented in docs/balance_decisions.md. */
export interface MatchConfig {
  totalRounds: number;
  buildMs: number;
  schemeMs: number;
  resolutionMs: number;
  eventRounds: number[];
  eventDurationRounds: number;
  inactiveAfterMs: number;
  minPlayers: number;
  maxPlayers: number;
  startingResources: Resources;
  startingFort: number;
  fortMax: number;
  storageCap: number;
  startingHand: number;
  maxHandSize: number;
  startingParties: number;
  maxParties: number;
  partyCapacity: number;
  partySpeed: number; // map units per second
  deckCopies: number;
  baseAttack: number;
  maxStealUnits: number;
  failedRaidGoldPenalty: number;
  maxTradeOffersPerRound: number;
  maxDefenseCardsPerRound: number;
  maxMercenaryBonus: number;
  maxBarricadeDefense: number;
  marketRate: number;
  marketRateWithCaravan: number;
  stockRegenIntervalMs: number;
}

export const DEFAULT_CONFIG: MatchConfig = {
  totalRounds: 8,
  buildMs: 30_000,
  schemeMs: 30_000,
  resolutionMs: 15_000,
  eventRounds: [3, 5, 7],
  eventDurationRounds: 2,
  inactiveAfterMs: 60_000,
  minPlayers: 2,
  maxPlayers: 8,
  startingResources: { gold: 10, materials: 6, food: 6 },
  startingFort: 5,
  fortMax: 7,
  storageCap: 100,
  startingHand: 3,
  maxHandSize: 7,
  startingParties: 2,
  maxParties: 4,
  partyCapacity: 6,
  partySpeed: 220,
  deckCopies: 2,
  baseAttack: 2,
  maxStealUnits: 6,
  failedRaidGoldPenalty: 2,
  maxTradeOffersPerRound: 3,
  maxDefenseCardsPerRound: 2,
  maxMercenaryBonus: 6,
  maxBarricadeDefense: 4,
  marketRate: 3,
  marketRateWithCaravan: 2,
  stockRegenIntervalMs: 10_000,
};

/** Economy action costs (approved rules). */
export const COSTS = {
  buyCard: { gold: 4 },
  buyCardMushroomDiscount: { gold: 2 },
  merchantCard: { gold: 2 },
  recruitMercenaries: { gold: 3, food: 2 },
  barricade: { materials: 3 },
  repairFort: { materials: 2 },
  scout: { gold: 2 },
  clanGrowth: { food: 5 },
  trainParty: { gold: 2, food: 3 },
} satisfies Record<string, Partial<Resources>>;

export const ACTION_VALUES = {
  mercenaryBonus: 2,
  barricadeDefense: 2,
  repairAmount: 2,
  growthAmount: 1,
  upkeepFood: 1,
  upkeepGoldFallback: 1,
};

export const SCORING = {
  successfulRaid: 2,
  destroyFort: 3,
  eliminateRival: 4,
  intactFort: 2,
  resourcesPerPoint: 5,
};

import type {
  CardId,
  CardInstance,
  ClanId,
  EventId,
  FeedCategory,
  PartyStatus,
  Phase,
  RaidTarget,
  ResourceType,
  Resources,
  ScoreEntry,
} from "./types.js";

/** Per-player projection of the match. Never contains another player's secrets. */
export interface PlayerView {
  matchId: string;
  seq: number;
  serverNow: number;
  youId: string;
  round: number;
  totalRounds: number;
  phase: Phase;
  phaseEndsAt: number;
  phaseDurations: { build: number; scheme: number; resolution: number };
  players: PublicPlayerView[];
  self: SelfView | null; // null for pure observers
  parties: PartyView[];
  locations: LocationView[];
  activeEvent: ActiveEventView | null;
  upcomingEventNotice: string | null;
  merchantCard: CardId | null;
  trades: TradeView[];
  truceOffer: TruceOfferView | null;
  truces: TruceView[];
  resolutions: RaidResolutionView[];
  resolutionRound: number;
  intel: IntelView[];
  log: LogView[];
  results: MatchResultsView | null;
}

export interface PublicPlayerView {
  id: string;
  name: string;
  clan: ClanId;
  seat: number;
  color: string;
  fortDefense: number;
  hasBarricade: boolean;
  handSize: number;
  partyCount: number;
  score: number;
  successfulRaids: number;
  connected: boolean;
  inactive: boolean;
  eliminated: boolean;
  hasCommittedRaid: boolean;
  abilityUsed: boolean;
}

export interface SelfView {
  id: string;
  resources: Resources;
  safeReserve: Resources;
  storageCap: number;
  fortDefense: number;
  fortMax: number;
  barricadeDefense: number;
  mercenaryBonus: number;
  reinforcementDefense: number;
  hand: CardInstance[];
  maxHandSize: number;
  raid: OwnRaidView | null;
  defenseCards: CardInstance[];
  /** Defense cards committed this round (including Last-Minute Reinforcements); max is maxDefenseCardsPerRound. */
  defenseCommitsThisRound: CardId[];
  maxDefenseCardsPerRound: number;
  cardsBoughtThisRound: number;
  tradesOfferedThisRound: number;
  abilityUsed: boolean;
  scoreBreakdown: ScoreEntry[];
  effects: string[];
  nextCardCost: number;
  scoutedThisRound: string[];
}

export interface OwnRaidView {
  target: RaidTarget;
  primaryCard: CardId | null;
  supportCard: CardId | null;
  priority: ResourceType;
  mercenaryBonus: number;
}

export interface PartyView {
  id: string;
  ownerId: string;
  status: PartyStatus;
  locationId: string | null;
  from: { x: number; y: number };
  to: { x: number; y: number };
  departAt: number;
  arriveAt: number;
  workEndsAt: number;
  load: number | null; // only visible to the owner
}

export interface LocationView {
  id: string;
  stockLevel: "rich" | "steady" | "poor" | "empty";
  exactStock: number | null; // revealed by Trail Markers
}

export interface ActiveEventView {
  id: EventId;
  name: string;
  description: string;
  untilRound: number;
}

export interface TradeView {
  id: string;
  fromId: string;
  toId: string;
  give: Partial<Resources>;
  want: Partial<Resources>;
  status: "open" | "accepted" | "rejected" | "cancelled" | "failed" | "expired";
  note?: string;
}

export interface TruceOfferView {
  fromId: string;
}

export interface TruceView {
  a: string;
  b: string;
  untilRound: number;
}

export interface RaidResolutionView {
  order: number;
  attackerId: string;
  target: RaidTarget;
  defenderId: string | null;
  attackCards: CardId[];
  defenseCards: CardId[];
  attackStrength: number;
  defenseStrength: number;
  attackBreakdown: string[];
  defenseBreakdown: string[];
  success: boolean;
  stolen: Partial<Resources>;
  fortDamage: number;
  goldLost: number;
  pointsAwarded: number;
  notes: string[];
}

export interface IntelView {
  round: number;
  aboutId: string;
  source: string;
  text: string;
}

export interface LogView {
  at: number;
  round: number;
  text: string;
  kind: "info" | "raid" | "event" | "trade" | "private";
  /** Feed grouping. */
  category?: FeedCategory;
  /** Player ids involved (public information only). */
  actors?: string[];
  /** Resource change for the viewer. Only present on entries visible to that player alone. */
  delta?: Partial<Resources>;
  points?: number;
  /** Why the result happened, when relevant. */
  why?: string;
}

export interface FinalStanding {
  playerId: string;
  name: string;
  clan: ClanId;
  rank: number;
  score: number;
  isWinner: boolean;
  successfulRaids: number;
  totalResources: number;
  fortDefense: number;
  eliminated: boolean;
  breakdown: ScoreEntry[];
}

export interface MatchResultsView {
  endedReason: "rounds_complete" | "last_clan_standing";
  winnerIds: string[];
  standings: FinalStanding[];
  stats: { raidsLaunched: number; raidsSucceeded: number; tradesCompleted: number; cardsPlayed: number };
}

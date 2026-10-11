import type {
  CardInstance,
  ClanId,
  EventId,
  IntelView,
  MatchResultsView,
  PartyStatus,
  Phase,
  Point,
  RaidResolutionView,
  RaidTarget,
  ResourceType,
  Resources,
  ScoreEntry,
  TradeView,
} from "@clan-chaos/shared";
import type { MatchConfig } from "@clan-chaos/game-content";

export interface PlayerEffects {
  counterIntelUntil: number;
  merchantUntil: number;
  rush: { locationId: string; untilRound: number } | null;
  trail: { locationId: string; untilRound: number }[];
  sabotagedUntil: number;
  skipUpkeep: boolean;
  bounty: { targetId: string; untilRound: number } | null;
}

export interface PlayerState {
  id: string;
  name: string;
  clan: ClanId;
  seat: number;
  color: string;
  home: Point;
  resources: Resources;
  safeReserve: Resources;
  /** Permanent fort level (max defense the fort can be repaired to). */
  fortLevel: number;
  fortDefense: number;
  barricadeDefense: number;
  mercenaryBonus: number;
  reinforcementDefense: number;
  hand: CardInstance[];
  defenseCards: CardInstance[];
  /** Booby Trap instances already triggered this round. */
  usedDefenseUids: string[];
  score: number;
  scoreBreakdown: ScoreEntry[];
  successfulRaids: number;
  raidsLaunched: number;
  connected: boolean;
  disconnectedAt: number | null;
  inactive: boolean;
  eliminated: boolean;
  abilityUsed: boolean;
  cardsBoughtThisRound: number;
  tradesOfferedThisRound: number;
  scoutedThisRound: string[];
  effects: PlayerEffects;
}

export interface Party {
  id: string;
  ownerId: string;
  status: PartyStatus;
  locationId: string | null;
  from: Point;
  to: Point;
  departAt: number;
  arriveAt: number;
  workStartAt: number;
  workEndsAt: number;
  /** Units of stock reserved from the location while working (or carried when returning). */
  reserved: number;
  resource: ResourceType | null;
  load: number;
}

export interface RaidOrder {
  attackerId: string;
  target: RaidTarget;
  primary: CardInstance | null;
  support: CardInstance | null;
  decoyPlayerId: string | null;
  priority: ResourceType;
  mercenaryBonus: number;
  committedAt: number;
}

export interface TradeOffer extends TradeView {
  round: number;
}

export interface TruceState {
  a: string;
  b: string;
  untilRound: number;
  brokenBy: string[];
}

export interface ActiveEvent {
  id: EventId;
  startRound: number;
  untilRound: number;
  wealthiestIds: string[];
  claimed: Record<string, boolean>;
}

export interface LogEntry {
  at: number;
  round: number;
  text: string;
  kind: "info" | "raid" | "event" | "trade" | "private";
  /** null = public. Otherwise only these players may see the entry. */
  visibleTo: string[] | null;
}

export interface CommandRecord {
  ok: boolean;
  code?: string;
  message?: string;
}

export interface MatchStats {
  raidsLaunched: number;
  raidsSucceeded: number;
  tradesCompleted: number;
  cardsPlayed: number;
}

export interface MatchState {
  id: string;
  config: MatchConfig;
  rng: number;
  round: number;
  phase: Phase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  seq: number;
  players: Record<string, PlayerState>;
  seatOrder: string[];
  deck: CardInstance[];
  discard: CardInstance[];
  nextUid: number;
  locations: Record<string, { stock: number }>;
  lastRegenAt: number;
  parties: Record<string, Party>;
  raids: Record<string, RaidOrder>;
  trades: TradeOffer[];
  nextTradeId: number;
  truceOffers: { fromId: string; toId: string; round: number }[];
  truces: TruceState[];
  eventQueue: EventId[];
  activeEvent: ActiveEvent | null;
  pendingEvent: EventId | null;
  merchantCard: CardInstance | null;
  resolutions: RaidResolutionView[];
  resolutionRound: number;
  intel: Record<string, IntelView[]>;
  log: LogEntry[];
  processed: Record<string, CommandRecord>;
  stats: MatchStats;
  results: MatchResultsView | null;
}

export interface NewPlayer {
  id: string;
  name: string;
  clan: ClanId;
}

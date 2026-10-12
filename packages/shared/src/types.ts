// Core domain types shared by the engine, server and web client.

export const RESOURCE_TYPES = ["gold", "materials", "food"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type Resources = Record<ResourceType, number>;

export const CLAN_IDS = ["rats", "toads", "mushrooms", "foxfire"] as const;
export type ClanId = (typeof CLAN_IDS)[number];

export const CARD_IDS = [
  "sneaky_heist",
  "booby_trap",
  "smoke_and_mirrors",
  "last_minute_reinforcements",
  "eagle_eye_scout",
  "false_flag",
  "trail_markers",
  "counter_intel",
  "tunnel_rats",
  "battering_ram",
  "decoy_caravan",
  "hit_and_run",
  "reinforced_gates",
  "counter_ambush",
  "decoy_vault",
  "emergency_evacuation",
  "merchant_caravan",
  "resource_rush",
  "sabotage_supplies",
  "emergency_rations",
  "bounty_contract",
  "unstable_truce",
] as const;
export type CardId = (typeof CARD_IDS)[number];

export const EVENT_IDS = [
  "gold_rush",
  "food_shortage",
  "wandering_merchant",
  "bounty_board",
  "fort_inspection",
  "goblin_tax",
] as const;
export type EventId = (typeof EVENT_IDS)[number];

export type Phase = "build" | "scheme" | "resolution" | "ended";

export type PartyStatus = "idle" | "traveling" | "gathering" | "returning" | "intercepted";

export type LocationKind = "gold_mine" | "forest" | "farm" | "ruins" | "trading_post";

/** How a card is used. */
export type CardTiming =
  | "attack" // attached to a raid order (primary or support slot)
  | "defense" // secretly committed as a defensive response
  | "instant"; // played immediately during build/scheme

export type CardSlot = "primary" | "support" | "either";

export type CardTarget = "none" | "player" | "location";

export type CardCategory = "classic" | "reconnaissance" | "attack" | "defense" | "economy" | "politics";

export interface CardInstance {
  uid: string;
  cardId: CardId;
}

export type RaidTarget = { kind: "player"; playerId: string } | { kind: "location"; locationId: string };

export interface Point {
  x: number;
  y: number;
}

/** Action-feed grouping for log entries. */
export type FeedCategory = "gather" | "build" | "card" | "raid" | "trade" | "upkeep" | "event" | "score" | "phase" | "system";

export interface ScoreEntry {
  round: number;
  points: number;
  reason: string;
}

import type { EventId } from "@clan-chaos/shared";

export interface EventDefinition {
  id: EventId;
  name: string;
  icon: string;
  description: string;
  /** Points available for completing the event objective, if any. */
  points: number;
}

export const EVENTS: Record<EventId, EventDefinition> = {
  gold_rush: {
    id: "gold_rush",
    name: "Gold Rush",
    icon: "✨",
    description: "Each clan's first gold delivery during the event grants +2 bonus gold.",
    points: 0,
  },
  food_shortage: {
    id: "food_shortage",
    name: "Food Shortage",
    icon: "🥀",
    description: "Food gathering trips yield 1 less food during the event.",
    points: 0,
  },
  wandering_merchant: {
    id: "wandering_merchant",
    name: "Wandering Merchant",
    icon: "🧙",
    description: "One random card is for sale for 2 gold. First come, first served.",
    points: 0,
  },
  bounty_board: {
    id: "bounty_board",
    name: "Bounty Board",
    icon: "🎯",
    description: "The first successful raid against the wealthiest clan (at announcement) earns 3 bonus points.",
    points: 3,
  },
  fort_inspection: {
    id: "fort_inspection",
    name: "Fort Inspection",
    icon: "🏰",
    description: "When the event begins, clans with a maximum (7) fort gain 2 points.",
    points: 2,
  },
  goblin_tax: {
    id: "goblin_tax",
    name: "Goblin Tax",
    icon: "👺",
    description: "When the event begins, clans holding more than 15 gold pay 2 gold.",
    points: 0,
  },
};

export const EVENT_LIST = Object.values(EVENTS);

import type { LocationKind, Point, ResourceType } from "@clan-chaos/shared";

export interface MapLocation {
  id: string;
  name: string;
  kind: LocationKind;
  position: Point;
  /** Resource yielded. "mixed" (ruins) yields a seeded-random resource each trip. */
  resource: ResourceType | "mixed" | null;
  safe: boolean;
  baseYield: number;
  gatherMs: number;
  maxStock: number;
  regenPerTick: number;
  description: string;
}

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 700;

export const MAP_LOCATIONS: MapLocation[] = [
  {
    id: "glimmer_hollow",
    name: "Glimmer Hollow",
    kind: "gold_mine",
    position: { x: 300, y: 170 },
    resource: "gold",
    safe: true,
    baseYield: 3,
    gatherMs: 8_000,
    maxStock: 40,
    regenPerTick: 2,
    description: "A sleepy, well-guarded gold seam. Safe but modest.",
  },
  {
    id: "dragons_teeth",
    name: "Dragon's Teeth Mine",
    kind: "gold_mine",
    position: { x: 640, y: 120 },
    resource: "gold",
    safe: false,
    baseYield: 5,
    gatherMs: 12_000,
    maxStock: 30,
    regenPerTick: 2,
    description: "Rich veins beneath snoring stone. Contested: parties here can be ambushed.",
  },
  {
    id: "whispering_pines",
    name: "Whispering Pines",
    kind: "forest",
    position: { x: 190, y: 430 },
    resource: "materials",
    safe: true,
    baseYield: 3,
    gatherMs: 8_000,
    maxStock: 40,
    regenPerTick: 2,
    description: "Polite trees that drop their own branches. Safe.",
  },
  {
    id: "thornwood",
    name: "Thornwood",
    kind: "forest",
    position: { x: 800, y: 330 },
    resource: "materials",
    safe: false,
    baseYield: 5,
    gatherMs: 12_000,
    maxStock: 30,
    regenPerTick: 2,
    description: "Prickly hardwood, prickly neighbours. Contested.",
  },
  {
    id: "sunny_acres",
    name: "Sunny Acres",
    kind: "farm",
    position: { x: 420, y: 560 },
    resource: "food",
    safe: true,
    baseYield: 3,
    gatherMs: 8_000,
    maxStock: 40,
    regenPerTick: 2,
    description: "Cabbages as far as the eye can see. Safe.",
  },
  {
    id: "goblin_fields",
    name: "Goblin Fields",
    kind: "farm",
    position: { x: 700, y: 540 },
    resource: "food",
    safe: false,
    baseYield: 5,
    gatherMs: 12_000,
    maxStock: 30,
    regenPerTick: 2,
    description: "Enormous pumpkins, occasionally guarded by goblins. Contested.",
  },
  {
    id: "ancient_ruins",
    name: "Ancient Ruins",
    kind: "ruins",
    position: { x: 470, y: 300 },
    resource: "mixed",
    safe: false,
    baseYield: 4,
    gatherMs: 15_000,
    maxStock: 24,
    regenPerTick: 1,
    description: "Crumbling halls hiding a mix of treasures. Slow, contested, unpredictable.",
  },
  {
    id: "trading_post",
    name: "Trading Post",
    kind: "trading_post",
    position: { x: 560, y: 420 },
    resource: null,
    safe: true,
    baseYield: 0,
    gatherMs: 0,
    maxStock: 0,
    regenPerTick: 0,
    description: "Exchange resources at the market (3:1, or 2:1 with a Merchant Caravan).",
  },
];

/** Eight stronghold slots around the map edge, assigned by seat. */
export const STRONGHOLD_SLOTS: Point[] = [
  { x: 90, y: 90 },
  { x: 910, y: 90 },
  { x: 910, y: 610 },
  { x: 90, y: 610 },
  { x: 500, y: 60 },
  { x: 950, y: 360 },
  { x: 500, y: 650 },
  { x: 50, y: 300 },
];

export const PLAYER_COLORS = ["#e4572e", "#2e86de", "#3bb273", "#f2a541", "#9b5de5", "#ef476f", "#17bebb", "#8d6e63"];

export const getLocation = (id: string): MapLocation | undefined => MAP_LOCATIONS.find((l) => l.id === id);

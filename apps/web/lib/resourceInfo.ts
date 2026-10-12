import type { ResourceType, Resources } from "@clan-chaos/shared";
import { ACTION_VALUES, CARD_LIST, COSTS, DEFAULT_CONFIG, MAP_LOCATIONS } from "@clan-chaos/game-content";

/** What each resource is for, what consumes it, and where it comes from. Derived from game-content. */
export interface ResourceUse {
  label: string;
  cost: Partial<Resources>;
}

export const RESOURCE_PURPOSE: Record<ResourceType, string> = {
  gold: "Gold pays for tactical cards, mercenaries, scouting and trades. A failed raid costs 2 gold.",
  materials: "Materials build barricades and repair your fort.",
  food: `Food recruits mercenaries and grows your fort. Every clan pays ${ACTION_VALUES.upkeepFood} food upkeep at the end of each round. With no food, upkeep takes ${ACTION_VALUES.upkeepGoldFallback} gold instead; with no gold either, nothing else happens.`,
};

export function resourceUses(type: ResourceType, nextCardCost: number): ResourceUse[] {
  const uses: ResourceUse[] = [
    { label: "Buy a card", cost: { gold: nextCardCost } },
    { label: "Recruit mercenaries (+2 attack)", cost: COSTS.recruitMercenaries },
    { label: "Barricade (+2 defense)", cost: COSTS.barricade },
    { label: "Repair fort (+2)", cost: COSTS.repairFort },
    { label: "Clan growth (+1 fort level)", cost: COSTS.clanGrowth },
    { label: "Scout a rival", cost: COSTS.scout },
    { label: "Train a party", cost: COSTS.trainParty },
  ];
  if (type === "food") uses.push({ label: "Upkeep at the end of each round", cost: { food: ACTION_VALUES.upkeepFood } });
  return uses.filter((u) => (u.cost[type] ?? 0) > 0);
}

export const cardsUsing = (type: ResourceType): string[] =>
  CARD_LIST.filter((c) => (c.cost[type] ?? 0) > 0).map((c) => `${c.name} (${c.cost[type]})`);

export function resourceSources(type: ResourceType): string[] {
  return MAP_LOCATIONS.filter((l) => l.resource === type || l.resource === "mixed").map(
    (l) => `${l.name}: ${l.resource === "mixed" ? "random resource, " : ""}${l.baseYield} per trip, ${l.safe ? "safe" : "contested"}`,
  );
}

export const STORAGE_CAP = DEFAULT_CONFIG.storageCap;

export const RESOURCE_SUBTITLE: Record<ResourceType, (r: Resources, nextCard: number) => { text: string; warn: boolean }> = {
  gold: (r, nextCard) => ({ text: `card ${nextCard} · merc ${COSTS.recruitMercenaries.gold}`, warn: r.gold < nextCard }),
  materials: (r) => ({ text: `barricade ${COSTS.barricade.materials} · repair ${COSTS.repairFort.materials}`, warn: r.materials < COSTS.repairFort.materials }),
  food: (r) => ({
    text: r.food < ACTION_VALUES.upkeepFood ? "no food for upkeep!" : `upkeep ${ACTION_VALUES.upkeepFood}/round`,
    warn: r.food < ACTION_VALUES.upkeepFood,
  }),
};

import type { ClanId } from "@clan-chaos/shared";

export interface ClanDefinition {
  id: ClanId;
  name: string;
  emblem: string;
  abilityName: string;
  abilityText: string;
  /** "active" abilities are triggered by a command; "passive" apply automatically. */
  abilityKind: "active" | "passive";
  flavor: string;
}

export const CLANS: Record<ClanId, ClanDefinition> = {
  rats: {
    id: "rats",
    name: "Rats of the Racket",
    emblem: "🐀",
    abilityName: "Protection Money",
    abilityText: "Once per match (Build or Scheme): steal 2 gold from every rival holding at least 5 gold.",
    abilityKind: "active",
    flavor: "Nice stronghold you've got. Shame if something happened to it.",
  },
  toads: {
    id: "toads",
    name: "Iron Toads",
    emblem: "🐸",
    abilityName: "Iron Hide",
    abilityText: "Start with +2 fort defense (7, the maximum).",
    abilityKind: "passive",
    flavor: "Slow, armoured and deeply unimpressed.",
  },
  mushrooms: {
    id: "mushrooms",
    name: "Mushroom Merchants",
    emblem: "🍄",
    abilityName: "Spore Discount",
    abilityText: "The first tactical card you buy each round costs 2 gold instead of 4.",
    abilityKind: "passive",
    flavor: "Everything has a price. Ours is lower.",
  },
  foxfire: {
    id: "foxfire",
    name: "Foxfire Bandits",
    emblem: "🦊",
    abilityName: "Change of Heart",
    abilityText: "Once per match: change your committed raid target before the lock, at no extra cost.",
    abilityKind: "active",
    flavor: "We were never going where you thought.",
  },
};

export const CLAN_LIST = Object.values(CLANS);

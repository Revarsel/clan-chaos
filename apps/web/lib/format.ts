import type { ResourceType } from "@clan-chaos/shared";

export const RESOURCE_ICON: Record<ResourceType, string> = { gold: "🪙", materials: "🪵", food: "🍖" };
export const RESOURCE_LABEL: Record<ResourceType, string> = { gold: "Gold", materials: "Materials", food: "Food" };

export function costText(cost: Partial<Record<ResourceType, number>>): string {
  return (Object.entries(cost) as [ResourceType, number][])
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${n}${RESOURCE_ICON[t]}`)
    .join(" ");
}

export const PHASE_LABEL = {
  build: "Build & Gather",
  scheme: "Scheme & Commit",
  resolution: "Resolution",
  ended: "Match Over",
} as const;

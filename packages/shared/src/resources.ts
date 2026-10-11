import { RESOURCE_TYPES, type Resources } from "./types.js";

export const emptyResources = (): Resources => ({ gold: 0, materials: 0, food: 0 });

export const totalResources = (r: Partial<Resources>): number =>
  RESOURCE_TYPES.reduce((sum, t) => sum + (r[t] ?? 0), 0);

export const fillResources = (r: Partial<Resources>): Resources => ({
  gold: r.gold ?? 0,
  materials: r.materials ?? 0,
  food: r.food ?? 0,
});

export const formatResources = (r: Partial<Resources>): string => {
  const parts = RESOURCE_TYPES.filter((t) => (r[t] ?? 0) > 0).map((t) => `${r[t]} ${t}`);
  return parts.length ? parts.join(", ") : "nothing";
};

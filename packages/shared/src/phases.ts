import type { GameCommandType } from "./commands.js";
import type { Phase } from "./types.js";

/**
 * Which phases accept each gameplay command. This is the single source of truth: the engine
 * enforces it in applyCommand(), and the client reads it to explain what is available now.
 * No command is accepted during Resolution or after the match has ended.
 */
export const COMMAND_PHASES: Record<GameCommandType, readonly Phase[]> = {
  gather: ["build", "scheme"],
  recall: ["build", "scheme"],
  buildBarricade: ["build", "scheme"],
  repairFort: ["build", "scheme"],
  recruitMercenaries: ["build", "scheme"],
  buyCard: ["build", "scheme"],
  buyMerchantCard: ["build", "scheme"],
  clanGrowth: ["build", "scheme"],
  trainParty: ["build", "scheme"],
  scout: ["build", "scheme"],
  playCard: ["build", "scheme"],
  commitDefense: ["build", "scheme"],
  commitRaid: ["scheme"],
  useClanAbility: ["build", "scheme"],
  foxfireRetarget: ["scheme"],
  tradeOffer: ["build", "scheme"],
  tradeRespond: ["build", "scheme"],
  tradeCancel: ["build", "scheme"],
  marketExchange: ["build", "scheme"],
  truceRespond: ["build", "scheme"],
};

export const PHASE_NAMES: Record<Phase, string> = {
  build: "Build & Gather",
  scheme: "Scheme & Commit",
  resolution: "Resolution",
  ended: "Match Over",
};

export function isCommandAllowedInPhase(type: GameCommandType, phase: Phase): boolean {
  return COMMAND_PHASES[type].includes(phase);
}

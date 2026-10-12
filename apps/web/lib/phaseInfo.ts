import { COMMAND_PHASES, PHASE_NAMES, type GameCommandType, type Phase, type PlayerView } from "@clan-chaos/shared";
import { ACTION_VALUES } from "@clan-chaos/game-content";

/** Player-facing explanation of the current phase. Reads the server's phase and deadline; never advances phases. */
export interface PhaseInfo {
  phase: Phase;
  name: string;
  sentence: string;
  /** Server timestamp of the next deadline (the end of the current phase). */
  deadlineAt: number;
  deadlineLabel: string;
  /** What can still be submitted right now. */
  submissions: string;
  availableNow: string[];
  notYet: string[];
}

export const PHASE_SENTENCE: Record<Phase, string> = {
  build: "Collect resources and prepare your clan.",
  scheme: "Prepare your strategy and submit secret orders.",
  resolution: "Raids are being resolved.",
  ended: "The match is over.",
};

/** Action groups shown to players. Availability comes from the shared COMMAND_PHASES table the server enforces. */
export const ACTION_GROUPS: { label: string; types: GameCommandType[] }[] = [
  { label: "Gather & recall parties", types: ["gather", "recall"] },
  { label: "Build, repair & recruit", types: ["buildBarricade", "repairFort", "recruitMercenaries", "clanGrowth", "trainParty"] },
  { label: "Buy & play cards", types: ["buyCard", "playCard"] },
  { label: "Commit secret defenses", types: ["commitDefense"] },
  { label: "Submit your raid", types: ["commitRaid"] },
  { label: "Scout, trade & market", types: ["scout", "tradeOffer", "marketExchange"] },
];

export function phaseInfo(view: PlayerView): PhaseInfo {
  const phase = view.phase;
  const me = view.players.find((p) => p.id === view.youId);
  const spectating = !view.self || !!me?.eliminated;
  const allowed = (t: GameCommandType) => COMMAND_PHASES[t].includes(phase);
  const availableNow = spectating ? [] : ACTION_GROUPS.filter((g) => g.types.some(allowed)).map((g) => g.label);
  const notYet = spectating ? [] : ACTION_GROUPS.filter((g) => !g.types.some(allowed)).map((g) => g.label);
  const lastRound = view.round >= view.totalRounds;

  let deadlineLabel: string;
  let submissions: string;
  switch (phase) {
    case "build":
      deadlineLabel = "Scheme & Commit begins: raid orders open";
      submissions = "You can gather, build, buy and play cards, commit defenses and trade. Raid orders open in Scheme & Commit.";
      break;
    case "scheme":
      deadlineLabel = "All orders lock";
      submissions = view.self?.raid
        ? "Your raid order is submitted and locked. You can still gather, build, play cards, defend and trade."
        : "Submit your secret raid now (optional). Gathering, building, cards, defenses and trades are still open.";
      break;
    case "resolution":
      deadlineLabel = lastRound ? "Final scores" : `Round ${view.round + 1} begins (after ${ACTION_VALUES.upkeepFood} food upkeep)`;
      submissions = "Nothing can be submitted: orders are locked while raids resolve. Parties keep moving; chat stays open.";
      break;
    default:
      deadlineLabel = "Match over";
      submissions = "The match has ended.";
  }
  if (spectating && phase !== "ended") submissions = "Your clan has been eliminated. You are spectating until the match ends.";
  return {
    phase,
    name: PHASE_NAMES[phase],
    sentence: PHASE_SENTENCE[phase],
    deadlineAt: view.phaseEndsAt,
    deadlineLabel,
    submissions,
    availableNow,
    notYet,
  };
}

export const formatSeconds = (ms: number): string => `${Math.max(0, Math.ceil(ms / 1000))}s`;

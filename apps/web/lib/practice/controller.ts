import type { MatchState } from "@clan-chaos/game-engine";
import { YOU, type PracticeMatch } from "./match";
import type { TutorialAction, TutorialSignal } from "./tutorial";

export type PracticeTab = "cards" | "raid" | "actions" | "players";

export interface ActionResult {
  tab?: PracticeTab;
  signal?: TutorialSignal;
}

const deliveries = (s: MatchState) =>
  s.log.filter((l) => l.category === "gather" && l.visibleTo?.includes(YOU) && /delivered/.test(l.text)).length;

/** Runs a tutorial helper button. Time only ever moves forward through the real engine's tick. */
export function runTutorialAction(m: PracticeMatch, kind: TutorialAction): ActionResult {
  const s = m.state;
  switch (kind) {
    case "fastForwardDelivery": {
      const before = deliveries(s);
      const round = s.round;
      // Never run past the end of Build: the next lesson explains the phase change itself.
      const limit = s.phase === "build" ? Math.max(0, s.phaseEndsAt - m.vt - 500) : 20_000;
      m.advanceUntil((x) => deliveries(x) > before || x.round !== round, limit);
      return { signal: "fast-forwarded" };
    }
    case "skipToScheme":
      if (s.phase === "build") m.skipPhase();
      return {};
    case "skipToDeadline":
      if (s.phase === "scheme") m.skipPhase();
      return {};
    case "finishRound": {
      const round = s.round;
      m.advanceUntil((x) => x.round !== round || x.phase === "ended", 120_000);
      return {};
    }
    case "openCards":
      return { tab: "cards" };
    case "openRaid":
      return { tab: "raid" };
    case "openActions":
      return { tab: "actions" };
    case "openPlayers":
      return { tab: "players" };
  }
}

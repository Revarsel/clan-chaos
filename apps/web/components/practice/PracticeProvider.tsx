"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ClanId, GameCommand, PlayerView } from "@clan-chaos/shared";
import { GameContext, type GameContextValue, type PracticeHooks, type Toast } from "@/hooks/useGame";
import type { RaidDraft } from "@/lib/raidPlan";
import { PracticeMatch, YOU } from "@/lib/practice/match";
import { runTutorialAction } from "@/lib/practice/controller";
import { TUTORIAL_STEPS, type TutorialAction, type TutorialCtx, type TutorialSignal } from "@/lib/practice/tutorial";
import { setTutorialProgress, tutorialProgress } from "@/lib/practice/progress";

interface PracticeControls {
  paused: boolean;
  /** True while the guided tutorial controls the clock. */
  tutorialActive: boolean;
  stepIndex: number;
  ctx: TutorialCtx;
  setPaused: (p: boolean) => void;
  skipPhase: () => void;
  next: () => void;
  back: () => void;
  /** Ends the tutorial early; the match keeps going as free practice. */
  skipTutorial: () => void;
  restartTutorial: () => void;
  runAction: (kind: TutorialAction) => void;
}

const PracticeControlsContext = createContext<PracticeControls | null>(null);

export function usePracticeControls(): PracticeControls {
  const ctx = useContext(PracticeControlsContext);
  if (!ctx) throw new Error("usePracticeControls must be used inside PracticeProvider");
  return ctx;
}

const MAX_FRAME_MS = 2000;

/**
 * Supplies the same game context as a live room, backed by a local PracticeMatch instead of the
 * server, so the real game screen runs unchanged. Nothing is sent over the network.
 */
export function PracticeProvider({
  name,
  clan,
  tutorial,
  children,
}: {
  name: string;
  clan: ClanId;
  tutorial: boolean;
  children: React.ReactNode;
}) {
  const newMatch = useCallback(() => new PracticeMatch({ name, clan, now: Date.now() }), [name, clan]);
  const [match, setMatch] = useState(newMatch);
  const [view, setView] = useState<PlayerView>(() => match.view());
  const [paused, setPaused] = useState(tutorial);
  const [tutorialActive, setTutorialActive] = useState(tutorial);
  const [stepIndex, setStepIndex] = useState(0);
  const [signals, setSignals] = useState<Set<TutorialSignal>>(() => new Set());
  const [draft, setDraft] = useState<RaidDraft | null>(null);
  const [tabRequest, setTabRequest] = useState<PracticeHooks["tabRequest"]>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const refresh = useCallback(() => setView(match.view()), [match]);

  const tutorialRef = useRef(tutorial);
  useEffect(() => {
    tutorialRef.current = tutorialActive;
  }, [tutorialActive]);
  const toast = useCallback((kind: Toast["kind"], text: string) => {
    // During the tutorial the panel narrates what happened; feed pop-ups would only cover it.
    if (tutorialRef.current && kind === "info") return;
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : kind === "info" ? 4500 : 3000);
  }, []);

  // The clock runs only when nothing holds it: the tutorial keeps time still and moves it with its buttons.
  const running = !paused && !tutorialActive && view.phase !== "ended";
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = setInterval(() => {
      const t = performance.now();
      match.advance(Math.min(MAX_FRAME_MS, t - last));
      last = t;
      refresh();
    }, 200);
    return () => clearInterval(id);
  }, [running, match, refresh]);

  const sendCommand = useCallback(
    async (cmd: GameCommand, success?: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      const r = match.send(cmd);
      refresh();
      if (r.ok) {
        // Shared success messages mention the server; here the order was applied locally.
        if (success) toast("ok", success.replace(" by the server", ""));
        return r;
      }
      toast("error", r.message);
      return r;
    },
    [match, refresh, toast],
  );

  const reset = useCallback(
    (withTutorial: boolean) => {
      const m = newMatch();
      setMatch(m);
      setView(m.view());
      setSignals(new Set());
      setDraft(null);
      setTabRequest(null);
      setStepIndex(0);
      setTutorialActive(withTutorial);
      setPaused(withTutorial);
      window.scrollTo(0, 0);
    },
    [newMatch],
  );

  const endTutorial = useCallback((how: "completed" | "skipped") => {
    if (how === "completed" || tutorialProgress() !== "completed") setTutorialProgress(how);
    setTutorialActive(false);
    setPaused(false);
  }, []);

  const addSignal = useCallback((s: TutorialSignal) => setSignals((prev) => (prev.has(s) ? prev : new Set(prev).add(s))), []);

  const practice: PracticeHooks = useMemo(
    () => ({
      signal: addSignal,
      reportDraft: (d) => setDraft(d),
      tabRequest,
      restart: () => reset(false),
    }),
    [tabRequest, reset, addSignal],
  );

  const getNow = useCallback(() => match.vt, [match]);

  const game: GameContextValue = {
    mode: "practice",
    getNow,
    practice,
    code: "PRACTICE",
    status: "connected",
    joined: true,
    checked: true,
    joining: false,
    joinError: null,
    kicked: null,
    lobby: null,
    view,
    chat: [],
    toasts,
    clockOffset: 0,
    playerId: YOU,
    join: async () => true,
    leave: async () => undefined,
    emitAck: async () => ({ ok: false, code: "INVALID", message: "Not available in a practice match." }),
    send: async (cmd, success) => (await sendCommand(cmd, success)).ok,
    sendCommand,
    toast,
  };

  const controls: PracticeControls = {
    paused: paused || tutorialActive,
    tutorialActive,
    stepIndex,
    ctx: { view, signals, draft },
    setPaused,
    skipPhase: () => {
      match.skipPhase();
      refresh();
    },
    next: () => {
      if (stepIndex >= TUTORIAL_STEPS.length - 1) endTutorial("completed");
      else setStepIndex(stepIndex + 1);
    },
    back: () => setStepIndex(Math.max(0, stepIndex - 1)),
    skipTutorial: () => endTutorial("skipped"),
    restartTutorial: () => reset(true),
    runAction: (kind) => {
      const r = runTutorialAction(match, kind);
      if (r.signal) addSignal(r.signal);
      if (r.tab) setTabRequest((prev) => ({ tab: r.tab!, n: (prev?.n ?? 0) + 1 }));
      refresh();
    },
  };

  return (
    <GameContext.Provider value={game}>
      <PracticeControlsContext.Provider value={controls}>{children}</PracticeControlsContext.Provider>
    </GameContext.Provider>
  );
}

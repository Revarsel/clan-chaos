"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ACTION_VALUES, COSTS, DEFAULT_CONFIG, SCORING } from "@clan-chaos/game-content";
import { onboardingProgress, setOnboardingProgress } from "@/lib/practice/progress";

const sec = (ms: number) => `${Math.round(ms / 1000)} seconds`;

/** The six-topic first-run introduction. All numbers come from the live game constants. */
export const ONBOARDING_TOPICS: { icon: string; title: string; points: string[] }[] = [
  {
    icon: "🏆",
    title: "Your goal",
    points: [
      `Lead your clan to the most victory points after ${DEFAULT_CONFIG.totalRounds} rounds.`,
      "Or be the last clan standing.",
      "Matches take about 10 minutes, with 2 to 8 players.",
    ],
  },
  {
    icon: "🪙",
    title: "Gold, materials and food",
    points: [
      "🪙 Gold buys cards and hires mercenaries.",
      "🪵 Materials build barricades and repair your fort.",
      `🍖 Food pays upkeep: ${ACTION_VALUES.upkeepFood} each round.`,
      "Leftover resources are worth points at the end.",
    ],
  },
  {
    icon: "👣",
    title: "Gathering parties and the map",
    points: [
      "Tap a gold mine, forest, farm or the ruins, then send a party there.",
      `Parties walk out, gather, and carry up to ${DEFAULT_CONFIG.partyCapacity} units home.`,
      "You can only spend what has arrived home.",
      "⚔ Contested sites pay more, but rivals can ambush parties there.",
    ],
  },
  {
    icon: "🏰",
    title: "Fort, cards and raids",
    points: [
      "Your fort's defense protects your stronghold.",
      "A raid only wins if its attack is greater than the defense. A tie fails.",
      `A win steals up to ${DEFAULT_CONFIG.maxStealUnits} resources. A loss costs the raider ${DEFAULT_CONFIG.failedRaidGoldPenalty} gold.`,
      `Cards (${COSTS.buyCard.gold} gold) add attack, secret defense or instant tricks.`,
    ],
  },
  {
    icon: "⏱",
    title: "Phases and deadlines",
    points: [
      `Build & Gather (${sec(DEFAULT_CONFIG.buildMs)}): collect and prepare.`,
      `Scheme & Commit (${sec(DEFAULT_CONFIG.schemeMs)}): submit one secret raid before the timer ends.`,
      `Resolution (${sec(DEFAULT_CONFIG.resolutionMs)}): every raid is revealed at once, then upkeep is paid.`,
      "The banner at the top always shows the phase and the time left.",
    ],
  },
  {
    icon: "⭐",
    title: "Scoring, elimination and the end",
    points: [
      `Raid won: +${SCORING.successfulRaid}. Fort destroyed: +${SCORING.destroyFort}. Rival eliminated: +${SCORING.eliminateRival}.`,
      `At the end: +${SCORING.intactFort} for a standing fort, and +1 for every ${SCORING.resourcesPerPoint} of each resource.`,
      "A destroyed fort with no resources left knocks a clan out. It can still watch.",
      `Most points after round ${DEFAULT_CONFIG.totalRounds} wins. Ties go to the most raids won.`,
    ],
  },
];

/** Opens the intro automatically for players who have neither finished nor skipped it in this browser. */
export function useAutoOnboarding(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!onboardingProgress()) setOpen(true);
  }, []);
  return [open, setOpen];
}

export function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const finish = useCallback(
    (how: "completed" | "skipped") => {
      if (how === "completed" || onboardingProgress() !== "completed") setOnboardingProgress(how);
      onClose();
    },
    [onClose],
  );
  useEffect(() => {
    if (open) setI(0);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish("skipped");
      if (e.key === "ArrowRight") setI((x) => Math.min(ONBOARDING_TOPICS.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);
  if (!open) return null;
  const topic = ONBOARDING_TOPICS[i]!;
  const last = i === ONBOARDING_TOPICS.length - 1;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-bark-900/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="panel w-full max-w-md animate-pop p-4 text-bark-900" data-testid="onboarding">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-bark-500">
          <span>
            How to play · {i + 1} of {ONBOARDING_TOPICS.length}
          </span>
          <button className="focus-ring rounded px-2 py-0.5 text-xs font-bold underline" onClick={() => finish("skipped")}>
            Skip
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-4xl" aria-hidden>
            {topic.icon}
          </span>
          <h2 id="onboarding-title" className="font-display text-2xl font-black leading-tight">
            {topic.title}
          </h2>
        </div>
        <ul className="mt-3 space-y-1.5 text-[15px] leading-snug">
          {topic.points.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-gold-600" aria-hidden>
                ◆
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {ONBOARDING_TOPICS.map((t, k) => (
            <span key={t.title} className={`h-2 w-2 rounded-full ${k === i ? "bg-bark-800" : "bg-bark-700/25"}`} />
          ))}
        </div>
        {last && (
          <p className="mt-3 rounded-lg bg-royal-500/10 px-2 py-1.5 text-sm">
            Want to try it before playing with friends?{" "}
            <Link className="font-bold text-royal-600 underline" href="/practice" onClick={() => finish("completed")}>
              🎓 Play the practice tutorial
            </Link>
            . It takes about 5 minutes against a bot.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button className="btn-plain px-4 py-2" onClick={() => setI(i - 1)} disabled={i === 0}>
            ◀ Back
          </button>
          <button className="btn-primary ml-auto px-5 py-2" onClick={() => (last ? finish("completed") : setI(i + 1))} data-testid="onboarding-next">
            {last ? "Got it!" : "Next ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

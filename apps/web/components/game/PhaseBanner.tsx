"use client";
import { useState } from "react";
import type { PlayerView } from "@clan-chaos/shared";
import { formatSeconds, phaseInfo } from "@/lib/phaseInfo";
import { RulesSummary } from "../RulesSummary";
import { Sheet } from "../ui/Sheet";

const TONE = {
  build: { bar: "bg-moss-500", band: "bg-moss-600", icon: "🔨" },
  scheme: { bar: "bg-ember-500", band: "bg-ember-600", icon: "🗡️" },
  resolution: { bar: "bg-royal-500", band: "bg-royal-600", icon: "⚔️" },
  ended: { bar: "bg-bark-600", band: "bg-bark-700", icon: "🏁" },
} as const;

/**
 * Sticky phase banner. Everything shown comes from the server's phase and phaseEndsAt;
 * the countdown is display-only and never advances the phase.
 */
export function PhaseBanner({ view, now, compact }: { view: PlayerView; now: number; compact: boolean }) {
  const info = phaseInfo(view);
  const [details, setDetails] = useState(false);
  const [rules, setRules] = useState(false);
  const remaining = Math.max(0, info.deadlineAt - now);
  const total = view.phase === "ended" ? 1 : view.phaseDurations[view.phase];
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const urgent = remaining <= 5000 && view.phase !== "ended";
  const tone = TONE[view.phase];
  return (
    <section
      aria-label="Current phase"
      data-testid="phase-banner"
      className={`sticky top-0 z-30 -mx-2 border-b-2 border-bark-900 ${tone.band} px-2 pb-2 pt-1.5 text-white shadow-pop md:-mx-3 md:px-3`}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="shrink-0 rounded-lg bg-black/20 px-2 py-0.5 text-center font-display leading-tight" aria-label={`Round ${view.round} of ${view.totalRounds}`}>
          <div className="text-[10px] font-bold uppercase opacity-80">Round</div>
          <div className="text-lg font-black">
            {view.round}
            <span className="text-xs opacity-80">/{view.totalRounds}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate font-display text-base font-black sm:text-xl" data-testid="phase-name">
              <span aria-hidden>{tone.icon} </span>
              {info.name}
            </h1>
          </div>
          <p className={`text-xs leading-snug opacity-95 sm:text-sm ${compact ? "line-clamp-1" : ""}`} data-testid="phase-sentence">
            {info.sentence}
          </p>
        </div>
        <div className="shrink-0 text-right" aria-live="off">
          <div
            className={`font-display text-2xl font-black tabular-nums sm:text-3xl ${urgent ? "animate-pulse text-gold-300" : ""}`}
            role="timer"
            aria-label={`${formatSeconds(remaining)} left`}
          >
            {view.phase === "ended" ? "—" : formatSeconds(remaining)}
          </div>
        </div>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/25" aria-hidden>
        <div className={`h-full ${tone.bar} brightness-125 transition-[width] duration-200`} style={{ width: `${pct}%` }} />
      </div>
      {view.phase !== "ended" && (
        <div className="mt-1 flex items-start gap-2 text-xs sm:text-sm">
          <p className="min-w-0 flex-1" data-testid="phase-deadline">
            <b>
              ⏳ {info.deadlineLabel} in {formatSeconds(remaining)}.
            </b>{" "}
            <span className={compact && !details ? "hidden" : ""}>{info.submissions}</span>
          </p>
          <button
            className="focus-ring shrink-0 rounded-md bg-black/20 px-2 py-0.5 text-xs font-bold"
            aria-expanded={details}
            onClick={() => setDetails((d) => !d)}
          >
            {details ? "Less" : "What can I do?"}
          </button>
          <button className="focus-ring shrink-0 rounded-md bg-black/20 px-2 py-0.5 text-xs font-bold" onClick={() => setRules(true)}>
            📖 Rules
          </button>
        </div>
      )}
      <Sheet open={rules} onClose={() => setRules(false)} title="How to play">
        <div className="text-bark-900">
          <RulesSummary durations={view.phaseDurations} />
          <p className="mt-2 text-xs text-bark-600">Tap any resource, card or ⓘ button for more detail. The Players panel shows the full scoring and tie-breakers.</p>
        </div>
      </Sheet>
      {details && (
        <div className="mt-1.5 grid gap-1 rounded-lg bg-black/20 p-2 text-xs sm:grid-cols-2 sm:text-sm">
          <div>
            <div className="font-bold">Available now</div>
            {info.availableNow.length ? (
              <ul>{info.availableNow.map((a) => <li key={a}>✔ {a}</li>)}</ul>
            ) : (
              <p>Nothing: orders are locked. Chat is still open.</p>
            )}
          </div>
          {info.notYet.length > 0 && (
            <div>
              <div className="font-bold">Not in this phase</div>
              <ul>{info.notYet.map((a) => <li key={a}>✖ {a} (Scheme & Commit only)</li>)}</ul>
            </div>
          )}
          {compact && <p className="sm:col-span-2">{info.submissions}</p>}
        </div>
      )}
    </section>
  );
}

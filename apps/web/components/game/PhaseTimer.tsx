"use client";
import type { PlayerView } from "@clan-chaos/shared";
import { PHASE_LABEL } from "@/lib/format";

export function PhaseTimer({ view, now }: { view: PlayerView; now: number }) {
  const remaining = Math.max(0, view.phaseEndsAt - now);
  const total = view.phase === "ended" ? 1 : view.phaseDurations[view.phase];
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const secs = Math.ceil(remaining / 1000);
  const color = view.phase === "build" ? "bg-moss-500" : view.phase === "scheme" ? "bg-ember-500" : "bg-royal-500";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="shrink-0 rounded-xl border-2 border-bark-800 bg-parchment-50 px-2.5 py-1 text-center font-display leading-tight shadow-pop">
        <div className="text-[10px] font-bold uppercase text-bark-600">Round</div>
        <div className="text-lg font-black">
          {view.round}
          <span className="text-xs text-bark-500">/{view.totalRounds}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between font-display">
          <span className="truncate text-sm font-black text-parchment-50 drop-shadow md:text-base">{PHASE_LABEL[view.phase]}</span>
          <span className={`text-xl font-black tabular-nums ${secs <= 5 && view.phase !== "ended" ? "animate-pulse text-ember-400" : "text-gold-300"}`}>
            {secs}s
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full border-2 border-bark-800 bg-bark-800/40">
          <div className={`h-full ${color} transition-[width] duration-200`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

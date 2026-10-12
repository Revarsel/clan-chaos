"use client";
import { useState } from "react";
import type { PlayerView } from "@clan-chaos/shared";
import { objectives, type Objective } from "@/lib/objective";

const TONE = {
  urgent: "border-ember-500 bg-ember-400/20",
  normal: "border-bark-700/40 bg-parchment-50",
  info: "border-royal-400 bg-royal-400/10",
};

/** The immediate objective plus optional suggestions, all derived from the player's own state. Never acts for them. */
export function ObjectiveStrip({
  view,
  now,
  onGo,
  compact,
}: {
  view: PlayerView;
  now: number;
  onGo: (where: NonNullable<Objective["goTo"]>) => void;
  compact?: boolean;
}) {
  const [more, setMore] = useState(false);
  const list = objectives(view, now);
  if (!list.length) return null;
  const shown = compact && !more ? list.slice(0, 1) : list;
  return (
    <section aria-label="Suggested next steps" className="flex flex-col gap-1 sm:flex-row sm:flex-wrap" data-testid="objectives">
      {shown.map((o, i) => (
        <div key={o.id} className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-1 text-sm ${TONE[o.tone]}`}>
          <span aria-hidden>{o.done ? "✅" : i === 0 ? "🎯" : "💡"}</span>
          <span className={`min-w-0 flex-1 ${o.done ? "text-bark-600" : "font-semibold"}`}>{o.text}</span>
          {o.goTo && !o.done && (
            <button className="btn-plain shrink-0 px-2 py-0.5 text-xs" onClick={() => onGo(o.goTo!)}>
              {o.goTo === "map" ? "Show map" : "Go"}
            </button>
          )}
        </div>
      ))}
      {compact && list.length > 1 && (
        <button className="focus-ring self-start text-xs font-bold text-parchment-100 underline" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? "Fewer tips" : `${list.length - 1} more tip${list.length > 2 ? "s" : ""}`}
        </button>
      )}
    </section>
  );
}

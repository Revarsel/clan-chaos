"use client";
import type { PlayerView } from "@clan-chaos/shared";

export function EventBanner({ view }: { view: PlayerView }) {
  if (!view.activeEvent && !view.upcomingEventNotice) return null;
  return (
    <div className="flex flex-col gap-1">
      {view.activeEvent && (
        <div className="animate-slideUp rounded-xl border-2 border-bark-800 bg-royal-500 px-3 py-1.5 text-sm text-white shadow-pop">
          <b>📣 {view.activeEvent.name}</b> <span className="opacity-90">— {view.activeEvent.description}</span>{" "}
          <span className="text-xs opacity-75">(until round {view.activeEvent.untilRound})</span>
        </div>
      )}
      {view.upcomingEventNotice && (
        <div className="animate-slideUp rounded-xl border-2 border-dashed border-gold-400 bg-bark-800/80 px-3 py-1.5 text-sm text-gold-300">
          <b>🔮 Next round:</b> {view.upcomingEventNotice}
        </div>
      )}
    </div>
  );
}

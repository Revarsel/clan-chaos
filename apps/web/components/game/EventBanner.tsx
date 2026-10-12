"use client";
import type { PlayerView } from "@clan-chaos/shared";
import { InfoTip } from "../ui/Popover";

const EVENT_HELP = (
  <>
    <p>Random events are announced at the end of rounds 3, 5 and 7, so you get a round to prepare.</p>
    <p>Each event then lasts 2 rounds (the last one only covers round 8). Some give points to whoever completes them first.</p>
  </>
);

export function EventBanner({ view }: { view: PlayerView }) {
  if (!view.activeEvent && !view.upcomingEventNotice) return null;
  return (
    <div className="flex flex-col gap-1">
      {view.activeEvent && (
        <div className="animate-slideUp rounded-xl border-2 border-bark-800 bg-royal-500 px-3 py-1.5 text-sm text-white shadow-pop">
          <b>📣 {view.activeEvent.name}</b> <span className="opacity-90">— {view.activeEvent.description}</span>{" "}
          <span className="text-xs opacity-75">(until round {view.activeEvent.untilRound})</span> <InfoTip title="Random events" className="align-middle">{EVENT_HELP}</InfoTip>
        </div>
      )}
      {view.upcomingEventNotice && (
        <div className="animate-slideUp rounded-xl border-2 border-dashed border-gold-400 bg-bark-800/80 px-3 py-1.5 text-sm text-gold-300">
          <b>🔮 Next round:</b> {view.upcomingEventNotice} <InfoTip title="Random events" className="align-middle">{EVENT_HELP}</InfoTip>
        </div>
      )}
    </div>
  );
}

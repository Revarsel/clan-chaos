"use client";
import { useGame } from "@/hooks/useGame";

/** Action feedback, shown just below the sticky phase banner so it never hides the timer or the open panel. */
export function Toasts() {
  const { toasts } = useGame();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[7.5rem] z-[70] flex flex-col items-center gap-2 px-2 lg:left-auto lg:right-4 lg:top-28 lg:items-end" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`max-w-xl animate-pop rounded-xl border-2 border-bark-800 px-4 py-2 font-display text-sm font-bold shadow-pop ${
            t.kind === "error" ? "bg-ember-500 text-white" : t.kind === "ok" ? "bg-moss-400 text-bark-900" : "bg-parchment-50 text-bark-900"
          }`}
        >
          {t.kind === "error" ? "⚠️ Not done: " : t.kind === "ok" ? "✔ " : ""}
          {t.text}
        </div>
      ))}
    </div>
  );
}

"use client";
import { useGame } from "@/hooks/useGame";

export function Toasts() {
  const { toasts } = useGame();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-50 flex flex-col items-center gap-2 px-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-pop rounded-xl border-2 border-bark-800 px-4 py-2 font-display text-sm font-bold shadow-pop ${
            t.kind === "error" ? "bg-ember-500 text-white" : t.kind === "ok" ? "bg-moss-400 text-bark-900" : "bg-parchment-50 text-bark-900"
          }`}
        >
          {t.kind === "error" ? "⚠️ " : t.kind === "ok" ? "✔ " : ""}
          {t.text}
        </div>
      ))}
    </div>
  );
}

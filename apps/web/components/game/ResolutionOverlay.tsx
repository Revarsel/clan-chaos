"use client";
import { useEffect, useState } from "react";
import type { PlayerView, RaidResolutionView } from "@clan-chaos/shared";
import { explainRaid, personalSummary } from "@/lib/resolutionText";

/** One revealed raid, explained: who, cards, base values, modifiers, totals, why, and what changed. */
export function RaidResultCard({ r, view }: { r: RaidResolutionView; view: PlayerView }) {
  const e = explainRaid(view, r);
  const attacker = view.players.find((p) => p.id === r.attackerId);
  const defender = r.defenderId ? view.players.find((p) => p.id === r.defenderId) : null;
  const involved = r.attackerId === view.youId || r.defenderId === view.youId;
  return (
    <article className={`animate-pop rounded-2xl border-2 border-bark-800 bg-parchment-50 p-3 shadow-card ${involved ? "ring-4 ring-gold-400" : ""}`} aria-label={`${e.attackerName} raided ${e.targetName}: ${e.outcome}`}>
      <div className="flex items-center justify-between gap-2 font-display">
        <span className="truncate font-black" style={{ color: attacker?.color }}>
          {e.attackerName}
        </span>
        <span className="text-xs text-bark-500">attacks</span>
        <span className="truncate text-right font-black" style={{ color: defender?.color ?? "#3d2514" }}>
          {r.target.kind === "location" ? "📍 " : "🏰 "}
          {e.targetName}
        </span>
      </div>
      <div className="my-2 flex items-center justify-center gap-4 font-display">
        <div className="text-center">
          <div className="text-3xl font-black text-ember-600">{r.attackStrength}</div>
          <div className="text-[10px] uppercase text-bark-500">final attack</div>
        </div>
        <div className={`rounded-full px-3 py-1 text-sm font-black text-white ${r.success ? "bg-moss-500" : "bg-bark-600"}`}>{e.outcome.toUpperCase()}</div>
        <div className="text-center">
          <div className="text-3xl font-black text-royal-600">{r.defenseStrength}</div>
          <div className="text-[10px] uppercase text-bark-500">final defense</div>
        </div>
      </div>
      <p className="mb-1 rounded-lg bg-white/70 px-2 py-1 text-sm font-semibold">{e.why}</p>
      <div className="grid grid-cols-2 gap-2 text-xs text-bark-700">
        <div>
          <div className="font-bold">Attack</div>
          {r.attackBreakdown.map((b) => <div key={b}>• {b}</div>)}
          {e.attackCards.length > 0 && <div className="mt-0.5 font-semibold">Cards: {e.attackCards.join(", ")}</div>}
        </div>
        <div>
          <div className="font-bold">Defense</div>
          {r.defenseBreakdown.map((b) => <div key={b}>• {b}</div>)}
          {e.defenseCards.length > 0 && <div className="mt-0.5 font-semibold">Revealed: {e.defenseCards.join(", ")}</div>}
        </div>
      </div>
      {(e.changes.length > 0 || r.notes.length > 0) && (
        <ul className="mt-2 border-t border-bark-700/20 pt-1 text-xs">
          {e.changes.map((c) => <li key={c}>➜ {c}</li>)}
          {r.notes.filter((n) => n !== e.why).map((n) => <li key={n} className="italic">{n}</li>)}
        </ul>
      )}
    </article>
  );
}

export function PersonalSummary({ view }: { view: PlayerView }) {
  const lines = personalSummary(view);
  if (!lines.length) return null;
  return (
    <div className="rounded-xl border-2 border-gold-500 bg-gold-300/40 p-2 text-sm" data-testid="personal-summary">
      <div className="font-display font-black">What happened to you</div>
      <ul>{lines.map((l) => <li key={l}>• {l}</li>)}</ul>
    </div>
  );
}

/** Reveals the round's raids one by one during Resolution. Dismissable; the Feed tab keeps them. */
export function ResolutionOverlay({ view, now, onOpenFeed }: { view: PlayerView; now: number; onOpenFeed: () => void }) {
  const active = view.phase === "resolution" && view.resolutionRound === view.round;
  const [shown, setShown] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(0);
      setDismissed(false);
      return;
    }
    const id = setInterval(() => setShown((n) => Math.min(view.resolutions.length, n + 1)), 1200);
    setShown(1);
    return () => clearInterval(id);
  }, [active, view.resolutions.length, view.round]);

  if (!active || dismissed) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-bark-900/60 p-3 backdrop-blur-sm sm:items-center" onClick={() => setDismissed(true)} role="dialog" aria-modal="true" aria-label="Raid results">
      <div className="max-h-[85dvh] w-full max-w-3xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-center font-display text-2xl font-black text-gold-400 sm:text-3xl" style={{ textShadow: "0 3px 0 #3d2514" }}>
          ⚔️ Round {view.round}: raids revealed
        </div>
        <p className="mb-2 text-center text-sm font-bold text-parchment-50" role="timer">
          {view.round >= view.totalRounds ? "Final scores" : `Round ${view.round + 1} starts`} in {Math.max(0, Math.ceil((view.phaseEndsAt - now) / 1000))}s
          {view.round < view.totalRounds && " · upkeep (1 food) is paid first"}
        </p>
        <div className="mb-2">
          <PersonalSummary view={view} />
        </div>
        {view.resolutions.length === 0 ? (
          <div className="panel p-6 text-center font-display text-lg">Nobody raided this round.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {view.resolutions.slice(0, shown).map((r) => (
              <RaidResultCard key={r.order} r={r} view={view} />
            ))}
          </div>
        )}
        <div className="mt-3 flex justify-center gap-2">
          {shown < view.resolutions.length && (
            <button className="btn-plain" onClick={() => setShown(view.resolutions.length)}>
              Show all now
            </button>
          )}
          <button className="btn-plain" onClick={() => setDismissed(true)}>
            Back to the map
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setDismissed(true);
              onOpenFeed();
            }}
          >
            Open in Feed
          </button>
        </div>
      </div>
    </div>
  );
}

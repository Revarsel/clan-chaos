"use client";
import { useEffect, useState } from "react";
import { formatResources, type PlayerView, type RaidResolutionView } from "@clan-chaos/shared";
import { CARDS, getLocation } from "@clan-chaos/game-content";

function RaidCard({ r, view }: { r: RaidResolutionView; view: PlayerView }) {
  const name = (id: string | null) => view.players.find((p) => p.id === id);
  const attacker = name(r.attackerId);
  const defender = r.defenderId ? name(r.defenderId) : null;
  const targetName = defender?.name ?? (r.target.kind === "location" ? getLocation(r.target.locationId)?.name : "?");
  const involved = r.attackerId === view.youId || r.defenderId === view.youId;
  return (
    <div className={`animate-pop rounded-2xl border-2 border-bark-800 bg-parchment-50 p-3 shadow-card ${involved ? "ring-4 ring-gold-400" : ""}`}>
      <div className="flex items-center justify-between gap-2 font-display">
        <span className="truncate font-black" style={{ color: attacker?.color }}>
          {attacker?.name}
        </span>
        <span className="text-lg">⚔️</span>
        <span className="truncate text-right font-black" style={{ color: defender?.color ?? "#3d2514" }}>
          {r.target.kind === "location" ? "📍 " : ""}
          {targetName}
        </span>
      </div>
      <div className="my-2 flex items-center justify-center gap-4 font-display">
        <div className="text-center">
          <div className="text-3xl font-black text-ember-600">{r.attackStrength}</div>
          <div className="text-[10px] uppercase text-bark-500">attack</div>
        </div>
        <div className={`rounded-full px-3 py-1 text-sm font-black text-white ${r.success ? "bg-moss-500" : "bg-bark-600"}`}>
          {r.success ? "SUCCESS" : "REPELLED"}
        </div>
        <div className="text-center">
          <div className="text-3xl font-black text-royal-600">{r.defenseStrength}</div>
          <div className="text-[10px] uppercase text-bark-500">defense</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-bark-700">
        <div>
          {r.attackBreakdown.map((b) => (
            <div key={b}>• {b}</div>
          ))}
          {r.attackCards.map((c) => (
            <div key={c} className="font-bold">
              {CARDS[c].icon} {CARDS[c].name}
            </div>
          ))}
        </div>
        <div className="text-right">
          {r.defenseBreakdown.map((b) => (
            <div key={b}>{b} •</div>
          ))}
        </div>
      </div>
      <div className="mt-2 border-t border-bark-700/20 pt-1 text-xs">
        {r.success && <div>💰 Stolen: {formatResources(r.stolen)}</div>}
        {r.fortDamage > 0 && <div>🏚 Fort damage: {r.fortDamage}</div>}
        {r.goldLost > 0 && <div>💸 Attacker lost {r.goldLost} gold</div>}
        {r.pointsAwarded > 0 && <div>⭐ +{r.pointsAwarded} points</div>}
        {r.notes.map((n) => (
          <div key={n} className="italic">
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Reveals raid results one by one during the Resolution phase. Never blocks interaction for long. */
export function ResolutionOverlay({ view }: { view: PlayerView }) {
  const active = view.phase === "resolution" && view.resolutionRound === view.round;
  const [shown, setShown] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(0);
      setDismissed(false);
      return;
    }
    const id = setInterval(() => setShown((n) => Math.min(view.resolutions.length, n + 1)), 1400);
    setShown(1);
    return () => clearInterval(id);
  }, [active, view.resolutions.length, view.round]);

  if (!active || dismissed) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-bark-900/60 p-3 backdrop-blur-sm sm:items-center" onClick={() => setDismissed(true)}>
      <div className="max-h-[85dvh] w-full max-w-3xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-center font-display text-3xl font-black text-gold-400" style={{ textShadow: "0 3px 0 #3d2514" }}>
          ⚔️ Round {view.round} — Raids Revealed!
        </div>
        {view.resolutions.length === 0 ? (
          <div className="panel p-6 text-center font-display text-lg">An eerie calm… nobody raided this round.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {view.resolutions.slice(0, shown).map((r) => (
              <RaidCard key={r.order} r={r} view={view} />
            ))}
          </div>
        )}
        <div className="mt-3 text-center">
          <button className="btn-plain" onClick={() => setDismissed(true)}>
            Back to the map
          </button>
        </div>
      </div>
    </div>
  );
}

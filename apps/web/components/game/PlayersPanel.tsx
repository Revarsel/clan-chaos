"use client";
import type { PlayerView } from "@clan-chaos/shared";
import { CLANS, EVENTS, SCORING } from "@clan-chaos/game-content";

/** Opponent status and standings, plus how scoring and tie-breakers work. */
export function PlayersPanel({ view, onSelect }: { view: PlayerView; onSelect: (id: string) => void }) {
  const sorted = [...view.players].sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || b.score - a.score || b.successfulRaids - a.successfulRaids);
  return (
    <div className="space-y-3" data-testid="players">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Standings</caption>
        <thead className="text-[11px] uppercase text-bark-500">
          <tr>
            <th scope="col">#</th>
            <th scope="col">Clan</th>
            <th scope="col" className="text-right">Pts</th>
            <th scope="col" className="text-right" title="Successful raids (first tie-breaker)">Raids</th>
            <th scope="col" className="text-right">Fort</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr key={p.id} className={`border-t border-bark-700/15 ${p.eliminated ? "opacity-50" : ""}`}>
              <td className="py-1 text-xs font-bold text-bark-500">{i + 1}</td>
              <td className="py-1">
                <button className="focus-ring text-left font-semibold" style={{ color: p.color }} onClick={() => onSelect(p.id)}>
                  {CLANS[p.clan].emblem} {p.name}
                  {p.id === view.youId && <span className="text-bark-500"> (you)</span>}
                </button>
              </td>
              <td className="py-1 text-right font-display font-black">{p.score}</td>
              <td className="py-1 text-right">{p.successfulRaids}</td>
              <td className="py-1 text-right">
                {p.fortDefense}
                {p.hasBarricade ? "🧱" : ""}
              </td>
              <td className="py-1 text-xs">
                {p.eliminated ? "☠ out" : !p.connected ? (p.inactive ? "💤 inactive" : "📡 offline") : view.phase === "scheme" ? (p.hasCommittedRaid ? "⚔ raid in" : "planning") : "active"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-bark-600">Visible to everyone: scores, raids won, forts, barricade (not its size), hand size, and whether a raid was submitted. Resources, cards and targets stay hidden.</p>
      <details className="rounded-xl border-2 border-bark-700/30 bg-parchment-50 p-2 text-sm" open>
        <summary className="focus-ring cursor-pointer font-display font-black">⭐ How to win</summary>
        <p className="mt-1">After round {view.totalRounds}, the clan with the most points wins, or the last clan standing wins at once.</p>
        <ul className="mt-1 list-disc pl-5 text-xs">
          <li>Successful raid: +{SCORING.successfulRaid}</li>
          <li>Destroying a rival&apos;s fort (to 0): +{SCORING.destroyFort}</li>
          <li>Eliminating a rival (fort 0 and no resources after your raid): +{SCORING.eliminateRival}</li>
          <li>Events: Bounty Board +{EVENTS.bounty_board.points}, Fort Inspection +{EVENTS.fort_inspection.points}; cards: Bounty Contract +2, honoured Truce +2</li>
          <li>At the end: fort still standing +{SCORING.intactFort}; +1 per {SCORING.resourcesPerPoint} of each resource left</li>
        </ul>
        <p className="mt-1 text-xs"><b>Ties</b> are broken by successful raids, then total resources left, then fort defense. Still tied: shared victory.</p>
      </details>
      {view.self && (
        <details className="rounded-xl border-2 border-bark-700/30 bg-parchment-50 p-2 text-sm">
          <summary className="focus-ring cursor-pointer font-display font-black">Your points ({view.self.scoreBreakdown.reduce((s, e) => s + e.points, 0)})</summary>
          {view.self.scoreBreakdown.length ? (
            <ul className="mt-1 text-xs">{view.self.scoreBreakdown.map((s, i) => <li key={i}>+{s.points} {s.reason} (round {s.round})</li>)}</ul>
          ) : (
            <p className="mt-1 text-xs">No points yet. Win a raid or keep your fort and resources until the end.</p>
          )}
        </details>
      )}
    </div>
  );
}

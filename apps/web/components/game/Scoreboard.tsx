"use client";
import type { PlayerView } from "@clan-chaos/shared";
import { CLANS } from "@clan-chaos/game-content";

export function Scoreboard({ view, onSelect }: { view: PlayerView; onSelect?: (id: string) => void }) {
  const sorted = [...view.players].sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || b.score - a.score);
  return (
    <ol className="space-y-1">
      {sorted.map((p, i) => (
        <li
          key={p.id}
          onClick={() => onSelect?.(p.id)}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border-l-4 bg-parchment-50 px-2 py-1 text-sm ${p.eliminated ? "opacity-50" : ""}`}
          style={{ borderColor: p.color }}
        >
          <span className="w-4 text-xs font-bold text-bark-500">{i + 1}</span>
          <span>{CLANS[p.clan].emblem}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">
            {p.name}
            {p.id === view.youId && " (you)"}
          </span>
          {!p.connected && !p.eliminated && <span title={p.inactive ? "Inactive" : "Disconnected"}>{p.inactive ? "💤" : "📡"}</span>}
          {p.eliminated && <span title="Eliminated">☠</span>}
          {p.hasCommittedRaid && view.phase === "scheme" && <span title="Raid committed">⚔</span>}
          <span className="text-xs">🏰{p.fortDefense}</span>
          <span className="w-8 text-right font-display font-black">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}

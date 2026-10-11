"use client";
import type { PlayerView } from "@clan-chaos/shared";
import { RESOURCE_TYPES } from "@clan-chaos/shared";
import { CLANS } from "@clan-chaos/game-content";
import { RESOURCE_ICON } from "@/lib/format";

export function ResourceHud({ view }: { view: PlayerView }) {
  const self = view.self;
  const me = view.players.find((p) => p.id === view.youId);
  if (!self || !me) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {RESOURCE_TYPES.map((t) => (
        <div key={t} className="chip border-bark-800 bg-parchment-50 px-2.5 py-1 text-sm shadow-pop" title={`${t} (max ${self.storageCap})`}>
          {RESOURCE_ICON[t]} <b className="tabular-nums">{self.resources[t]}</b>
          {self.safeReserve[t] > 0 && <span className="text-[10px] text-royal-600">+{self.safeReserve[t]}🔒</span>}
        </div>
      ))}
      <div className="chip border-bark-800 bg-parchment-50 px-2.5 py-1 text-sm shadow-pop" title="Fort defense / fort level">
        🏰 <b>{self.fortDefense}</b>
        <span className="text-xs text-bark-500">/{self.fortMax}</span>
        {self.fortDefense === 0 && <span className="text-[10px] font-bold text-ember-600">EXPOSED</span>}
      </div>
      {self.barricadeDefense > 0 && <div className="chip bg-parchment-50 py-1 text-sm">🧱 +{self.barricadeDefense}</div>}
      {self.reinforcementDefense > 0 && <div className="chip bg-parchment-50 py-1 text-sm">🛡️ +{self.reinforcementDefense}</div>}
      {self.mercenaryBonus > 0 && <div className="chip bg-parchment-50 py-1 text-sm">🗡️ +{self.mercenaryBonus}</div>}
      <div className="chip bg-gold-300 py-1 text-sm font-black">⭐ {me.score}</div>
      <div className="chip hidden bg-parchment-50 py-1 text-xs sm:inline-flex" title={CLANS[me.clan].abilityText}>
        {CLANS[me.clan].emblem} {CLANS[me.clan].abilityName}
        {CLANS[me.clan].abilityKind === "active" && (self.abilityUsed ? " (used)" : " (ready)")}
      </div>
    </div>
  );
}

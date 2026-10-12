"use client";
import type { PartyView, PlayerView } from "@clan-chaos/shared";
import { DEFAULT_CONFIG, getLocation } from "@clan-chaos/game-content";
import { formatSeconds } from "@/lib/phaseInfo";

export const PARTY_STATUS: Record<PartyView["status"], { icon: string; label: string }> = {
  idle: { icon: "🏠", label: "Idle at home" },
  traveling: { icon: "👣", label: "Walking to" },
  gathering: { icon: "⛏", label: "Gathering at" },
  returning: { icon: "🎒", label: "Returning from" },
  intercepted: { icon: "💥", label: "Ambushed at" },
};

export function partyLine(p: PartyView, now: number): string {
  const s = PARTY_STATUS[p.status];
  const where = p.locationId ? getLocation(p.locationId)?.name : null;
  const secs = p.status !== "idle" ? ` · ${formatSeconds(p.arriveAt - now)}` : "";
  return `${s.label}${where && p.status !== "idle" ? ` ${where}` : ""}${secs}`;
}

/** Always-visible list of the player's gathering parties. */
export function PartiesStrip({ view, now, selected, onSelect }: { view: PlayerView; now: number; selected: string | null; onSelect: (id: string) => void }) {
  const mine = view.parties.filter((p) => p.ownerId === view.youId);
  if (!view.self || !mine.length) return null;
  return (
    <section aria-label="Your gathering parties" data-tour="parties" className="flex flex-wrap items-center gap-1.5">
      <span className="font-display text-xs font-bold uppercase text-parchment-100">Parties ({mine.length}/{DEFAULT_CONFIG.maxParties}):</span>
      {mine.map((p, i) => {
        const s = PARTY_STATUS[p.status];
        const load = p.load ? ` · ${p.status === "gathering" ? "expects" : "carries"} ${p.load}/${DEFAULT_CONFIG.partyCapacity}` : "";
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            aria-pressed={selected === p.id}
            className={`focus-ring rounded-full border-2 px-2.5 py-1 text-xs font-semibold shadow-pop ${
              selected === p.id ? "border-royal-500 bg-royal-400/30 text-bark-900" : p.status === "idle" ? "border-moss-600 bg-moss-300 text-bark-900" : "border-bark-800 bg-parchment-50 text-bark-900"
            }`}
          >
            <span aria-hidden>{s.icon}</span> Party {i + 1}: {partyLine(p, now)}
            {load}
          </button>
        );
      })}
    </section>
  );
}

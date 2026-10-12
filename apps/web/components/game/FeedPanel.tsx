"use client";
import { useMemo, useState } from "react";
import { RESOURCE_TYPES, type PlayerView } from "@clan-chaos/shared";
import { RESOURCE_ICON } from "@/lib/format";
import { CATEGORY_META, feedItems, type FeedItem } from "@/lib/feed";
import { PersonalSummary, RaidResultCard } from "./ResolutionOverlay";

type Filter = "all" | "mine" | "raids" | "points";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "raids", label: "Raids" },
  { id: "points", label: "Points" },
];

function DeltaChips({ delta }: { delta?: FeedItem["delta"] }) {
  if (!delta) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {RESOURCE_TYPES.filter((t) => delta[t]).map((t) => (
        <span key={t} className={`rounded px-1 text-[11px] font-black ${delta[t]! > 0 ? "bg-moss-300" : "bg-ember-400 text-white"}`}>
          {delta[t]! > 0 ? "+" : ""}
          {delta[t]} {RESOURCE_ICON[t]}
        </span>
      ))}
    </span>
  );
}

/** Chronological action feed (newest first). Built only from entries the server sent to this player. */
export function FeedPanel({ view }: { view: PlayerView }) {
  const [filter, setFilter] = useState<Filter>("all");
  const items = useMemo(() => feedItems(view), [view]);
  const shown = items
    .filter((i) =>
      filter === "all"
        ? true
        : filter === "mine"
          ? i.private || i.actors.some((a) => a.id === view.youId)
          : filter === "raids"
            ? i.category === "raid"
            : i.category === "score",
    )
    .reverse();
  const rounds = [...new Set(shown.map((i) => i.round))];
  const lastResults = view.resolutionRound > 0 ? view.resolutions : [];
  const intel = [...view.intel].reverse().slice(0, 3);

  return (
    <div className="space-y-3" data-testid="feed">
      {lastResults.length > 0 || view.resolutionRound === view.round ? (
        <details open={view.phase === "resolution"} className="rounded-xl border-2 border-bark-700/30 bg-parchment-50 p-2">
          <summary className="focus-ring cursor-pointer font-display text-sm font-black">⚔️ Raid results — round {view.resolutionRound}</summary>
          <div className="mt-2 space-y-2">
            {view.resolutionRound === view.round && <PersonalSummary view={view} />}
            {lastResults.length ? lastResults.map((r) => <RaidResultCard key={r.order} r={r} view={view} />) : <p className="text-xs">Nobody raided.</p>}
          </div>
        </details>
      ) : null}
      {intel.length > 0 && (
        <details className="rounded-xl border-2 border-royal-400/40 bg-royal-400/10 p-2">
          <summary className="focus-ring cursor-pointer font-display text-sm font-black">🔭 Your intel reports (private)</summary>
          <ul className="mt-1 space-y-1 text-xs">
            {intel.map((i, k) => (
              <li key={k}>
                <b>R{i.round} · {i.source} on {view.players.find((p) => p.id === i.aboutId)?.name}:</b> {i.text}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex gap-1" role="tablist" aria-label="Feed filter">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className={`focus-ring rounded-full px-3 py-1 text-xs font-bold ${filter === f.id ? "bg-bark-800 text-white" : "bg-parchment-50 text-bark-700"}`}>
            {f.label}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="text-sm text-bark-600">Nothing here yet.</p>}
      {rounds.map((round) => (
        <section key={round} aria-label={`Round ${round}`}>
          <h3 className="sticky top-0 bg-parchment-100 py-0.5 font-display text-xs font-black uppercase text-bark-500">Round {round}</h3>
          <ol className="space-y-1">
            {shown
              .filter((i) => i.round === round)
              .map((i) => (
                <li key={i.key} className={`rounded-lg border-l-4 bg-parchment-50 px-2 py-1 text-sm ${i.category === "phase" ? "border-bark-300 text-bark-600" : "border-bark-700/40"}`}>
                  <div className="flex items-start gap-1.5">
                    <span aria-label={CATEGORY_META[i.category].label}>{i.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p>{i.text}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {i.actors.map((a) => (
                          <span key={a.id} className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: a.color }}>
                            {a.id === view.youId ? "You" : a.name}
                          </span>
                        ))}
                        <DeltaChips delta={i.delta} />
                        {i.points ? <span className="rounded bg-gold-300 px-1 text-[11px] font-black">+{i.points} pts</span> : null}
                        {i.private && <span className="text-[11px] text-bark-500" title="Only you can see this entry">🔒 only you</span>}
                      </div>
                      {i.why && i.category !== "score" && <p className="text-xs italic text-bark-600">Why: {i.why}</p>}
                    </div>
                  </div>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

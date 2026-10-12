import type { FeedCategory, LogView, PlayerView, Resources } from "@clan-chaos/shared";

/** One row of the action feed. Built only from log entries the server already filtered for this viewer. */
export interface FeedItem {
  key: string;
  round: number;
  at: number;
  category: FeedCategory;
  icon: string;
  text: string;
  actors: { id: string; name: string; color: string }[];
  delta?: Partial<Resources>;
  points?: number;
  why?: string;
  /** True when only this player can see the entry. */
  private: boolean;
}

export const CATEGORY_META: Record<FeedCategory, { icon: string; label: string }> = {
  gather: { icon: "👣", label: "Gathering" },
  build: { icon: "🔨", label: "Building" },
  card: { icon: "🃏", label: "Cards" },
  raid: { icon: "⚔️", label: "Raids" },
  trade: { icon: "🤝", label: "Trades" },
  upkeep: { icon: "🍖", label: "Upkeep" },
  event: { icon: "📣", label: "Events" },
  score: { icon: "⭐", label: "Points" },
  phase: { icon: "⏱", label: "Phases" },
  system: { icon: "📜", label: "Other" },
};

const fallbackCategory = (l: LogView): FeedCategory =>
  l.kind === "raid" ? "raid" : l.kind === "event" ? "event" : l.kind === "trade" ? "trade" : "system";

export function feedItems(view: PlayerView): FeedItem[] {
  const players = new Map(view.players.map((p) => [p.id, p]));
  const seen = new Map<string, number>();
  return view.log.map((l) => {
    const category = l.category ?? fallbackCategory(l);
    // Stable key (independent of how many older entries were trimmed from the view).
    const base = `${l.at}|${l.round}|${l.text}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return {
      key: `${base}|${n}`,
      round: l.round,
      at: l.at,
      category,
      icon: CATEGORY_META[category].icon,
      text: l.text,
      actors: (l.actors ?? []).flatMap((id) => {
        const p = players.get(id);
        return p ? [{ id, name: p.name, color: p.color }] : [];
      }),
      delta: l.delta && Object.keys(l.delta).length ? l.delta : undefined,
      points: l.points,
      why: l.why,
      private: l.kind === "private" || l.kind === "trade",
    };
  });
}

/** Feed rows that are new since `prevKeys` (used for live notifications). */
export function newFeedItems(prev: Set<string> | null, items: FeedItem[]): FeedItem[] {
  if (!prev) return [];
  return items.filter((i) => !prev.has(i.key));
}

/** Whether a new feed row deserves a live notification for this player (other than their own command echoes). */
export function isNotable(item: FeedItem, youId: string, youName: string): boolean {
  switch (item.category) {
    case "gather":
      return item.text.startsWith("A party delivered") || item.text.startsWith("Your party");
    case "upkeep":
      return true;
    case "raid":
      // Raid outcomes are shown by the resolution reveal; only party ambushes need a separate alert.
      return item.private && item.text.startsWith("Your party");
    case "event":
      return item.private || item.text.startsWith("Event:") || item.text.startsWith("Coming next round");
    case "score":
      // Raid points are part of the reveal; event and end-of-round points are announced here.
      return item.actors.some((a) => a.id === youId) && !/raid|ambush|Destroyed|Eliminated|Bounty/i.test(item.why ?? "");
    case "trade":
      return item.text.startsWith("Trade with") || (item.text.includes(" offers ") && !item.text.startsWith(`${youName} `)) || item.text.includes("rejected");
    case "phase":
      return true;
    default:
      return false;
  }
}

export function toastText(item: FeedItem): string {
  const d = item.delta
    ? " (" +
      Object.entries(item.delta)
        .map(([t, v]) => `${(v ?? 0) > 0 ? "+" : ""}${v} ${t}`)
        .join(", ") +
      ")"
    : "";
  return `${item.icon} ${item.text}${d}`;
}

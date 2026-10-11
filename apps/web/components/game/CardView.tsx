"use client";
import type { CardId } from "@clan-chaos/shared";
import { CARDS } from "@clan-chaos/game-content";
import { costText } from "@/lib/format";

const CATEGORY_STYLE: Record<string, string> = {
  classic: "from-gold-300 to-gold-500",
  reconnaissance: "from-sky-300 to-royal-400",
  attack: "from-ember-400 to-ember-600",
  defense: "from-moss-300 to-moss-500",
  economy: "from-parchment-200 to-parchment-400",
  politics: "from-royal-400 to-royal-600",
};

const TIMING_LABEL = { attack: "Raid card", defense: "Defense", instant: "Instant" } as const;

export function CardView({
  cardId,
  selected,
  compact,
  onClick,
  children,
}: {
  cardId: CardId;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const c = CARDS[cardId];
  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col overflow-hidden rounded-xl border-2 border-bark-800 bg-parchment-50 shadow-card transition ${
        onClick ? "cursor-pointer hover:-translate-y-1" : ""
      } ${selected ? "-translate-y-1 ring-4 ring-royal-500" : ""} ${compact ? "w-36" : "w-44"}`}
    >
      <div className={`flex items-center gap-2 bg-gradient-to-br px-2 py-1.5 ${CATEGORY_STYLE[c.category]}`}>
        <span className="text-2xl drop-shadow">{c.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[13px] font-black leading-tight text-bark-900">{c.name}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-bark-800/80">
            {TIMING_LABEL[c.timing]}
            {c.slot && c.timing === "attack" ? ` · ${c.slot}` : ""}
          </div>
        </div>
      </div>
      <div className="flex-1 px-2 py-1.5 text-[11px] leading-snug text-bark-800">{c.text}</div>
      <div className="flex items-center justify-between border-t border-bark-700/20 px-2 py-1 text-[11px] font-bold">
        <span>Cost {costText(c.cost)}</span>
      </div>
      {children && <div className="border-t border-bark-700/20 p-1.5">{children}</div>}
    </div>
  );
}

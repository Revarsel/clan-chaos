"use client";
import type { CardId } from "@clan-chaos/shared";
import { CARDS } from "@clan-chaos/game-content";
import { costText } from "@/lib/format";
import { CARD_TERMS, describeCard } from "@/lib/cardInfo";

const CATEGORY_STYLE: Record<string, string> = {
  classic: "from-gold-300 to-gold-500",
  reconnaissance: "from-sky-300 to-royal-400",
  attack: "from-ember-400 to-ember-600",
  defense: "from-moss-300 to-moss-500",
  economy: "from-parchment-200 to-parchment-400",
  politics: "from-royal-400 to-royal-600",
};

const TIMING_LABEL = { attack: "Raid card", defense: "Defense", instant: "Instant" } as const;

/** Compact, readable card tile. Tapping it opens the full details (onClick). */
export function CardView({
  cardId,
  status,
  onClick,
  selected,
}: {
  cardId: CardId;
  /** Availability line shown at the bottom, e.g. "Can play now" or the reason it can't be used. */
  status?: { ok: boolean; text: string };
  onClick?: () => void;
  selected?: boolean;
}) {
  const c = CARDS[cardId];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      {...(onClick ? { type: "button" as const, "aria-label": `${c.name}. ${status?.text ?? ""} Open details.` } : {})}
      className={`focus-ring relative flex w-full flex-col overflow-hidden rounded-xl border-2 border-bark-800 bg-parchment-50 text-left shadow-card transition ${
        onClick ? "hover:-translate-y-0.5" : ""
      } ${selected ? "ring-4 ring-royal-500" : ""}`}
    >
      <div className={`flex items-center gap-2 bg-gradient-to-br px-2 py-1.5 ${CATEGORY_STYLE[c.category]}`}>
        <span className="text-2xl drop-shadow" aria-hidden>
          {c.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-black leading-tight text-bark-900">{c.name}</div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-bark-800/80">
            {TIMING_LABEL[c.timing]}
            {c.timing === "attack" && c.slot ? ` · ${c.slot === "either" ? "any slot" : `${c.slot} slot`}` : ""}
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-parchment-50/90 px-1.5 py-0.5 text-xs font-black" title="Cost">
          {costText(c.cost)}
        </span>
      </div>
      <div className="flex-1 px-2 py-1.5 text-[13px] leading-snug text-bark-800">{c.text}</div>
      {status && (
        <div className={`border-t border-bark-700/20 px-2 py-1 text-xs font-semibold ${status.ok ? "text-moss-700" : "text-ember-600"}`}>
          {status.ok ? "✔ " : "✖ "}
          {status.text}
        </div>
      )}
    </Tag>
  );
}

/** Everything a player needs to know about a card, in plain language. */
export function CardDetails({ cardId }: { cardId: CardId }) {
  const i = describeCard(cardId);
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 border-b border-bark-700/10 py-1 text-sm">
      <dt className="font-bold text-bark-700">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  const terms = Object.entries(CARD_TERMS).filter(([t]) =>
    [i.effect, i.timing, i.target, i.applies, ...i.limits].some((s) => s.toLowerCase().includes(t.toLowerCase())),
  );
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-3xl" aria-hidden>
          {i.icon}
        </span>
        <div>
          <div className="font-display text-xl font-black">{i.name}</div>
          <div className="text-xs font-semibold text-royal-600">{i.kind}</div>
        </div>
      </div>
      <p className="mb-2 rounded-lg bg-parchment-50 p-2 text-sm">{i.effect}</p>
      <dl>
        {row("Cost", `${i.costLabel} (paid when the server accepts it)`)}
        {row("Type", `${i.kind}. ${i.kindHelp}`)}
        {row("When", i.timing)}
        {row("Target", i.target)}
        {row("Takes effect", i.applies)}
        {i.attackBonus !== 0 && row("Attack", `${i.attackBonus > 0 ? "+" : ""}${i.attackBonus} attack`)}
        {row("Limits", <ul className="list-disc pl-4">{i.limits.map((l) => <li key={l}>{l}</li>)}</ul>)}
        {row("Counterplay", i.counters)}
      </dl>
      {terms.length > 0 && (
        <div className="mt-2 rounded-lg bg-royal-400/10 p-2 text-xs">
          {terms.map(([t, d]) => (
            <p key={t}>
              <b>{t}:</b> {d}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

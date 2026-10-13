"use client";
import { useState } from "react";
import { RESOURCE_TYPES, type CardInstance, type PlayerView, type Resources } from "@clan-chaos/shared";
import { CARDS, MAP_LOCATIONS } from "@clan-chaos/game-content";
import { useGame } from "@/hooks/useGame";
import { RESOURCE_ICON, costText } from "@/lib/format";
import { cardAvailability } from "@/lib/availability";
import { CardDetails, CardView } from "./CardView";
import { Sheet } from "../ui/Sheet";

const GROUPS = [
  { timing: "instant", title: "Play now", help: "Instant cards take effect as soon as the server accepts them." },
  { timing: "defense", title: "Defend (commit secretly)", help: "Defense cards stay hidden until a raid hits your stronghold." },
  { timing: "attack", title: "Raid cards", help: "Attach these to a raid order in the Raid planner during Scheme & Commit." },
] as const;

function CardActions({ view, card, now, onUseInRaid, onDone }: { view: PlayerView; card: CardInstance; now: number; onUseInRaid: (c: CardInstance) => void; onDone: () => void }) {
  const { send } = useGame();
  const def = CARDS[card.cardId];
  const rivals = view.players.filter((p) => p.id !== view.youId && !p.eliminated);
  const [target, setTarget] = useState("");
  const [loc, setLoc] = useState("");
  const [evac, setEvac] = useState<Resources>({ gold: 0, materials: 0, food: 0 });
  const [busy, setBusy] = useState(false);
  const avail = cardAvailability(view, card, now);

  if (def.timing === "attack") {
    return (
      <div className="space-y-1">
        <button className="btn-danger w-full" onClick={() => onUseInRaid(card)}>
          ⚔️ Add to raid plan
        </button>
        <p className="text-xs text-bark-600">
          The cost ({costText(def.cost)}) is paid only when you submit the raid. {avail.ok ? "" : avail.reason}
        </p>
      </div>
    );
  }
  const go = async (cmd: Parameters<typeof send>[0], msg: string) => {
    setBusy(true);
    const ok = await send(cmd, msg);
    setBusy(false);
    if (ok) onDone();
  };
  if (def.timing === "defense") {
    return (
      <div className="space-y-1">
        <button
          className="btn-green w-full"
          disabled={!avail.ok || busy}
          onClick={() => go({ type: "commitDefense", cardUid: card.uid }, `${def.name} committed in secret (${costText(def.cost)} paid).`)}
        >
          {busy ? "Committing…" : `🛡 Commit secretly — pay ${costText(def.cost)}`}
        </button>
        {!avail.ok && <p className="text-xs font-semibold text-ember-600">{avail.reason}</p>}
      </div>
    );
  }
  const needsTarget = def.target === "player" && !target;
  const needsLoc = def.target === "location" && !loc;
  const evacTotal = RESOURCE_TYPES.reduce((s, t) => s + evac[t], 0);
  return (
    <div className="space-y-2">
      {def.target === "player" && (
        <label className="block text-sm font-bold">
          Target rival
          <select className="input mt-0.5 py-1.5" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose a rival…</option>
            {rivals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {def.target === "location" && (
        <label className="block text-sm font-bold">
          Target site
          <select className="input mt-0.5 py-1.5" value={loc} onChange={(e) => setLoc(e.target.value)}>
            <option value="">Choose a site…</option>
            {MAP_LOCATIONS.filter((l) => l.resource).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {card.cardId === "emergency_evacuation" && (
        <fieldset className="text-sm">
          <legend className="font-bold">Resources to protect (max {def.params.maxUnits} total, now {evacTotal})</legend>
          <div className="mt-1 flex gap-2">
            {RESOURCE_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1">
                {RESOURCE_ICON[t]}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={def.params.maxUnits}
                  className="input w-16 px-2 py-1"
                  aria-label={`${t} to evacuate`}
                  value={evac[t]}
                  onChange={(e) => setEvac({ ...evac, [t]: Math.max(0, Math.min(def.params.maxUnits ?? 8, Number(e.target.value) || 0)) })}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <button
        className="btn-primary w-full"
        disabled={!avail.ok || needsTarget || needsLoc || busy || (card.cardId === "emergency_evacuation" && evacTotal === 0)}
        onClick={() =>
          go(
            {
              type: "playCard",
              cardUid: card.uid,
              targetPlayerId: def.target === "player" ? target : undefined,
              locationId: def.target === "location" ? loc : undefined,
              evacuate: card.cardId === "emergency_evacuation" ? evac : undefined,
            },
            `${def.name} played (${costText(def.cost)} paid).`,
          )
        }
      >
        {busy ? "Playing…" : `✨ Play now — pay ${costText(def.cost)}`}
      </button>
      {!avail.ok && <p className="text-xs font-semibold text-ember-600">{avail.reason}</p>}
      {avail.ok && (needsTarget || needsLoc) && <p className="text-xs text-bark-600">Choose a {needsTarget ? "rival" : "site"} first.</p>}
    </div>
  );
}

export function HandPanel({ view, now, onUseInRaid }: { view: PlayerView; now: number; onUseInRaid: (c: CardInstance) => void }) {
  const self = view.self!;
  const [open, setOpen] = useState<CardInstance | null>(null);
  const { practice } = useGame();
  const inspect = (c: CardInstance) => {
    setOpen(c);
    practice?.signal("card-details");
  };
  const openCard = open && self.hand.find((c) => c.uid === open.uid);
  return (
    <div data-tour="hand">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
        <span className="panel-title">
          Your hand ({self.hand.length}/{self.maxHandSize})
        </span>
        <span className="text-xs text-bark-600">
          Defenses this round: {self.defenseCommitsThisRound.length}/{self.maxDefenseCardsPerRound} · Next card costs {self.nextCardCost} gold
        </span>
      </div>
      {self.hand.length === 0 && <p className="rounded-xl bg-parchment-50 p-4 text-center text-sm text-bark-600">No cards yet. Buy one in the Actions tab.</p>}
      {GROUPS.map((g) => {
        const cards = self.hand.filter((c) => CARDS[c.cardId].timing === g.timing);
        if (!cards.length) return null;
        return (
          <section key={g.timing} className="mb-3" aria-label={g.title}>
            <h3 className="font-display text-sm font-black">{g.title}</h3>
            <p className="mb-1 text-xs text-bark-600">{g.help}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {cards.map((c) => {
                const a = cardAvailability(view, c, now);
                const text = a.ok ? (g.timing === "attack" ? "Ready for a raid" : g.timing === "defense" ? "Can commit now" : "Can play now") : a.reason;
                return <CardView key={c.uid} cardId={c.cardId} status={{ ok: a.ok, text }} onClick={() => inspect(c)} />;
              })}
            </div>
          </section>
        );
      })}
      {self.defenseCards.length > 0 && (
        <div className="mt-2">
          <div className="panel-title mb-1">Committed defenses (secret)</div>
          <div className="flex flex-wrap gap-1">
            {self.defenseCards.map((c) => (
              <span key={c.uid} className="chip bg-moss-300">
                {CARDS[c.cardId].icon} {CARDS[c.cardId].name}
              </span>
            ))}
            {self.reinforcementDefense > 0 && <span className="chip bg-moss-300">🛡️ Reinforcements +{self.reinforcementDefense} (next raid)</span>}
          </div>
        </div>
      )}
      <Sheet open={!!openCard} onClose={() => setOpen(null)} title="Card details">
        {openCard && (
          <>
            <CardDetails cardId={openCard.cardId} />
            <div className="mt-3">
              <CardActions view={view} card={openCard} now={now} onUseInRaid={(c) => (setOpen(null), onUseInRaid(c))} onDone={() => setOpen(null)} />
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

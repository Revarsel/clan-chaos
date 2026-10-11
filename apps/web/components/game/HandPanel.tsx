"use client";
import { useState } from "react";
import { RESOURCE_TYPES, type CardInstance, type PlayerView, type Resources } from "@clan-chaos/shared";
import { CARDS, MAP_LOCATIONS } from "@clan-chaos/game-content";
import { useGame } from "@/hooks/useGame";
import { RESOURCE_ICON } from "@/lib/format";
import { CardView } from "./CardView";

function CardAction({ view, card }: { view: PlayerView; card: CardInstance }) {
  const { send } = useGame();
  const def = CARDS[card.cardId];
  const rivals = view.players.filter((p) => p.id !== view.youId && !p.eliminated);
  const [target, setTarget] = useState(rivals[0]?.id ?? "");
  const [loc, setLoc] = useState(MAP_LOCATIONS.find((l) => l.resource)!.id);
  const [evac, setEvac] = useState<Resources>({ gold: 0, materials: 0, food: 0 });
  const canAct = view.phase === "build" || view.phase === "scheme";

  if (def.timing === "attack") return <div className="text-center text-[11px] text-bark-600">Attach in the ⚔️ Raid tab (Scheme)</div>;
  if (def.timing === "defense") {
    return (
      <button className="btn-green w-full py-1 text-xs" disabled={!canAct} onClick={() => send({ type: "commitDefense", cardUid: card.uid }, `${def.name} committed (secret)`)}>
        🛡 Commit defense
      </button>
    );
  }
  return (
    <div className="space-y-1">
      {def.target === "player" && (
        <select className="input px-1 py-0.5 text-xs" value={target} onChange={(e) => setTarget(e.target.value)}>
          {rivals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {def.target === "location" && (
        <select className="input px-1 py-0.5 text-xs" value={loc} onChange={(e) => setLoc(e.target.value)}>
          {MAP_LOCATIONS.filter((l) => l.resource).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}
      {card.cardId === "emergency_evacuation" && (
        <div className="flex gap-1">
          {RESOURCE_TYPES.map((t) => (
            <label key={t} className="flex items-center text-[11px]">
              {RESOURCE_ICON[t]}
              <input
                type="number"
                min={0}
                max={8}
                className="input w-10 px-1 py-0 text-xs"
                value={evac[t]}
                onChange={(e) => setEvac({ ...evac, [t]: Math.max(0, Math.min(8, Number(e.target.value) || 0)) })}
              />
            </label>
          ))}
        </div>
      )}
      <button
        className="btn-primary w-full py-1 text-xs"
        disabled={!canAct || (def.target === "player" && !target)}
        onClick={() =>
          send(
            {
              type: "playCard",
              cardUid: card.uid,
              targetPlayerId: def.target === "player" ? target : undefined,
              locationId: def.target === "location" ? loc : undefined,
              evacuate: card.cardId === "emergency_evacuation" ? evac : undefined,
            },
            `${def.name} played`,
          )
        }
      >
        ✨ Play
      </button>
    </div>
  );
}

export function HandPanel({ view }: { view: PlayerView }) {
  const self = view.self!;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="panel-title">
          Your hand ({self.hand.length}/{self.maxHandSize})
        </span>
        <span className="text-xs text-bark-600">Next card: {self.nextCardCost}🪙</span>
      </div>
      {self.hand.length === 0 ? (
        <p className="rounded-xl bg-parchment-50 p-4 text-center text-sm text-bark-600">No cards. Buy some in the Build tab!</p>
      ) : (
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          {self.hand.map((c) => (
            <CardView key={c.uid} cardId={c.cardId} compact>
              <CardAction view={view} card={c} />
            </CardView>
          ))}
        </div>
      )}
      {self.defenseCards.length > 0 && (
        <div className="mt-3">
          <div className="panel-title mb-1">Committed defenses (secret)</div>
          <div className="flex flex-wrap gap-1">
            {self.defenseCards.map((c) => (
              <span key={c.uid} className="chip bg-moss-300">
                {CARDS[c.cardId].icon} {CARDS[c.cardId].name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

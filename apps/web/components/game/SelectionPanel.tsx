"use client";
import type { PlayerView } from "@clan-chaos/shared";
import { CLANS, getLocation } from "@clan-chaos/game-content";
import { useGame } from "@/hooks/useGame";
import { RESOURCE_ICON } from "@/lib/format";

const STATUS_LABEL = { idle: "Home", traveling: "Travelling", gathering: "Gathering", returning: "Returning", intercepted: "Ambushed!" };

/** Contextual panel for whatever is selected on the map. */
export function SelectionPanel({
  view,
  now,
  locationId,
  playerId,
  onPlanRaid,
  onTrade,
  onClose,
}: {
  view: PlayerView;
  now: number;
  locationId: string | null;
  playerId: string | null;
  onPlanRaid: (target: { kind: "player"; playerId: string } | { kind: "location"; locationId: string }) => void;
  onTrade: (playerId: string) => void;
  onClose: () => void;
}) {
  const { send } = useGame();
  const canAct = (view.phase === "build" || view.phase === "scheme") && !!view.self;
  const myParties = view.parties.filter((p) => p.ownerId === view.youId);

  if (locationId) {
    const loc = getLocation(locationId)!;
    const lv = view.locations.find((l) => l.id === locationId);
    const here = view.parties.filter((p) => p.locationId === locationId && p.status !== "idle");
    return (
      <div className="panel animate-pop p-3">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <div className="font-display text-lg font-black">{loc.name}</div>
            <div className="text-xs text-bark-600">{loc.description}</div>
          </div>
          <button className="text-bark-500" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {loc.resource && (
          <div className="mb-2 flex flex-wrap gap-1 text-xs">
            <span className="chip">{loc.resource === "mixed" ? "🎲 Mixed" : `${RESOURCE_ICON[loc.resource]} ${loc.resource}`}</span>
            <span className="chip">Yield {loc.baseYield}</span>
            <span className="chip">⏱ {loc.gatherMs / 1000}s</span>
            <span className={`chip ${loc.safe ? "bg-moss-300" : "bg-ember-400 text-white"}`}>{loc.safe ? "Safe" : "Contested"}</span>
            <span className="chip">Stock: {lv?.exactStock ?? lv?.stockLevel}</span>
          </div>
        )}
        {here.length > 0 && (
          <div className="mb-2 text-xs text-bark-700">
            Parties here:{" "}
            {here.map((p) => {
              const owner = view.players.find((x) => x.id === p.ownerId);
              return (
                <span key={p.id} className="mr-1 font-bold" style={{ color: owner?.color }}>
                  ● {owner?.name}
                </span>
              );
            })}
          </div>
        )}
        {loc.resource && view.self && (
          <div className="space-y-1">
            {myParties.map((p, i) => {
              const busy = p.status !== "idle";
              const secs = busy ? Math.max(0, Math.ceil((p.arriveAt - now) / 1000)) : 0;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-parchment-50 px-2 py-1 text-sm">
                  <span>
                    Party {i + 1}: <b>{STATUS_LABEL[p.status]}</b>
                    {busy && p.locationId && ` @ ${getLocation(p.locationId)?.name} (${secs}s)`}
                    {p.load ? ` · carrying ${p.load}` : ""}
                  </span>
                  {busy ? (
                    (p.status === "traveling" || p.status === "gathering") && (
                      <button className="btn-plain px-2 py-0.5 text-xs" disabled={!canAct} onClick={() => send({ type: "recall", partyId: p.id }, "Party recalled")}>
                        Recall
                      </button>
                    )
                  ) : (
                    <button
                      className="btn-green px-2 py-0.5 text-xs"
                      disabled={!canAct}
                      onClick={() => send({ type: "gather", partyId: p.id, locationId }, `Party sent to ${loc.name}`)}
                    >
                      Send here
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {loc.kind === "trading_post" && <p className="text-sm">Use the Market in the Build tab to exchange resources.</p>}
        {!loc.safe && loc.resource && (
          <button className="btn-danger mt-2 w-full" onClick={() => onPlanRaid({ kind: "location", locationId })}>
            ⚔️ Plan an ambush here
          </button>
        )}
      </div>
    );
  }

  if (playerId) {
    const p = view.players.find((x) => x.id === playerId);
    if (!p) return null;
    const clan = CLANS[p.clan];
    const isMe = p.id === view.youId;
    return (
      <div className="panel animate-pop p-3">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <div className="font-display text-lg font-black" style={{ color: p.color }}>
              {clan.emblem} {p.name} {isMe && "(you)"}
            </div>
            <div className="text-xs text-bark-600">
              {clan.name} · {clan.abilityName}
              {clan.abilityKind === "active" ? (p.abilityUsed ? " (used)" : " (unused)") : ""}
            </div>
          </div>
          <button className="text-bark-500" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="mb-2 flex flex-wrap gap-1 text-xs">
          <span className="chip">🏰 Fort {p.fortDefense}</span>
          {p.hasBarricade && <span className="chip">🧱 Barricaded</span>}
          <span className="chip">🃏 {p.handSize} cards</span>
          <span className="chip">👣 {p.partyCount} parties</span>
          <span className="chip">⭐ {p.score}</span>
          {p.eliminated && <span className="chip bg-bark-800 text-white">Eliminated</span>}
          {!p.connected && !p.eliminated && <span className="chip">{p.inactive ? "Inactive" : "Disconnected"}</span>}
        </div>
        {!isMe && !p.eliminated && view.self && (
          <div className="grid grid-cols-3 gap-1.5">
            <button
              className="btn-plain px-1 text-xs"
              disabled={!canAct || view.self.scoutedThisRound.includes(p.id)}
              onClick={() => send({ type: "scout", targetPlayerId: p.id }, "Scouts dispatched — see Intel")}
            >
              🔭 Scout (2🪙)
            </button>
            <button className="btn-plain px-1 text-xs" onClick={() => onTrade(p.id)}>
              🤝 Trade
            </button>
            <button className="btn-danger px-1 text-xs" onClick={() => onPlanRaid({ kind: "player", playerId: p.id })}>
              ⚔️ Raid
            </button>
          </div>
        )}
      </div>
    );
  }
  return null;
}

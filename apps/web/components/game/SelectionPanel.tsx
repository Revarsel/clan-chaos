"use client";
import { useState } from "react";
import type { PartyView, PlayerView, RaidTarget } from "@clan-chaos/shared";
import { CLANS, DEFAULT_CONFIG, MAP_LOCATIONS, STRONGHOLD_SLOTS, getLocation } from "@clan-chaos/game-content";
import { travelDurationMs } from "@clan-chaos/game-engine";
import { useGame } from "@/hooks/useGame";
import { RESOURCE_ICON } from "@/lib/format";
import { phaseReason, scoutAvailability } from "@/lib/availability";
import { enemyGatherersAt } from "@/lib/raidPlan";
import { formatSeconds } from "@/lib/phaseInfo";
import { PARTY_STATUS, partyLine } from "./PartiesStrip";
import { InfoTip } from "../ui/Popover";

const STOCK_TEXT = { rich: "Rich (plenty left)", steady: "Steady", poor: "Low", empty: "Empty" } as const;

function Reason({ text }: { text: string | null }) {
  return text ? <p className="text-[11px] font-semibold text-ember-600">{text}</p> : null;
}

/** Contextual panel for the selected location, party or stronghold. */
export function SelectionPanel({
  view,
  now,
  locationId,
  playerId,
  partyId,
  onPlanRaid,
  onTrade,
  onSelectParty,
  onClose,
}: {
  view: PlayerView;
  now: number;
  locationId: string | null;
  playerId: string | null;
  partyId: string | null;
  onPlanRaid: (target: RaidTarget) => void;
  onTrade: (playerId: string) => void;
  onSelectParty: (id: string) => void;
  onClose: () => void;
}) {
  const { send } = useGame();
  const [pending, setPending] = useState<string | null>(null);
  const [dest, setDest] = useState<string>("");
  const me = view.players.find((p) => p.id === view.youId);
  const home = me ? STRONGHOLD_SLOTS[me.seat]! : { x: 0, y: 0 };
  const myParties = view.parties.filter((p) => p.ownerId === view.youId);
  const gatherBlock = phaseReason(view, "gather", now);
  const recallBlock = phaseReason(view, "recall", now);

  const run = async (key: string, fn: () => Promise<boolean>) => {
    setPending(key);
    await fn();
    setPending(null);
  };
  const sendParty = (p: PartyView, locId: string) =>
    run(p.id, () => send({ type: "gather", partyId: p.id, locationId: locId }, `Party dispatched to ${getLocation(locId)?.name}. Server accepted the order.`));
  const recall = (p: PartyView) =>
    run(p.id, () => send({ type: "recall", partyId: p.id }, p.status === "gathering" ? "Party recalled with what it has gathered so far." : "Party recalled; it returns empty."));

  const tripLine = (locId: string) => {
    const loc = getLocation(locId)!;
    const walk = travelDurationMs(home, loc.position, DEFAULT_CONFIG.partySpeed);
    return `≈ ${formatSeconds(walk)} walk each way + ${formatSeconds(loc.gatherMs)} gathering`;
  };

  const panel = (title: React.ReactNode, body: React.ReactNode) => (
    <section className="panel animate-pop p-3" aria-label="Selection details" data-tour="selection">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">{title}</div>
        <button className="focus-ring rounded px-1 text-bark-500" onClick={onClose} aria-label="Close details">
          ✕
        </button>
      </div>
      {body}
    </section>
  );

  // ---- Party ----
  const party = partyId ? myParties.find((p) => p.id === partyId) : undefined;
  if (party) {
    const idx = myParties.indexOf(party) + 1;
    const loc = party.locationId ? getLocation(party.locationId) : undefined;
    const gatherable = MAP_LOCATIONS.filter((l) => l.resource);
    const choice = dest || gatherable[0]!.id;
    return panel(
      <div className="font-display text-lg font-black">
        {PARTY_STATUS[party.status].icon} Party {idx}
      </div>,
      <div className="space-y-2 text-sm">
        <p>
          <b>{partyLine(party, now)}</b>
        </p>
        <p className="text-xs text-bark-700">
          Carrying capacity: up to {DEFAULT_CONFIG.partyCapacity} units per trip.
          {party.load ? ` ${party.status === "gathering" ? "Expected load" : "Carrying"}: ${party.load}${party.status === "gathering" ? " (if it finishes)" : ""}.` : ""}
          {loc && party.status !== "idle" && ` Destination: ${loc.name} (${loc.safe ? "safe" : "contested — can be ambushed"}).`}
        </p>
        {party.status === "idle" ? (
          <div className="space-y-1">
            <label className="block text-xs font-bold" htmlFor="party-dest">
              Send to
            </label>
            <select id="party-dest" className="input py-1.5" value={choice} onChange={(e) => setDest(e.target.value)}>
              {gatherable.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.resource === "mixed" ? "🎲" : RESOURCE_ICON[l.resource as "gold"]} {l.name} — {l.baseYield}/trip, {l.safe ? "safe" : "contested"}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-bark-600">{tripLine(choice)}</p>
            <button className="btn-green w-full" disabled={!!gatherBlock || pending === party.id} onClick={() => sendParty(party, choice)}>
              {pending === party.id ? "Sending…" : "👣 Dispatch party"}
            </button>
            <Reason text={gatherBlock} />
          </div>
        ) : party.status === "traveling" || party.status === "gathering" ? (
          <div>
            <button className="btn-plain w-full" disabled={!!recallBlock || pending === party.id} onClick={() => recall(party)}>
              {pending === party.id ? "Recalling…" : "↩ Recall party"}
            </button>
            <p className="mt-1 text-[11px] text-bark-600">
              {party.status === "traveling" ? "It turns around and comes back empty." : "It keeps only the share gathered so far; the rest stays at the site."}
            </p>
            <Reason text={recallBlock} />
          </div>
        ) : (
          <p className="text-xs text-bark-600">{party.status === "returning" ? "It will deliver its load when it reaches home." : "Ambushed parties return home empty."}</p>
        )}
      </div>,
    );
  }

  // ---- Location ----
  if (locationId) {
    const loc = getLocation(locationId)!;
    const lv = view.locations.find((l) => l.id === locationId);
    const here = view.parties.filter((p) => p.locationId === locationId && p.status !== "idle");
    const enemies = enemyGatherersAt(view, locationId);
    return panel(
      <>
        <div className="font-display text-lg font-black">
          {loc.resource ? (loc.resource === "mixed" ? "🎲" : RESOURCE_ICON[loc.resource]) : "⛺"} {loc.name}
        </div>
        <div className="text-xs text-bark-600">{loc.description}</div>
      </>,
      <div className="space-y-2 text-sm">
        {loc.resource ? (
          <>
            <div className="flex flex-wrap gap-1 text-xs">
              <span className="chip">{loc.resource === "mixed" ? "🎲 Random resource each trip" : `${RESOURCE_ICON[loc.resource]} ${loc.resource}`}</span>
              <span className="chip">Yields {loc.baseYield} per trip</span>
              <span className={`chip ${loc.safe ? "bg-moss-300" : "bg-ember-400 text-white"}`}>{loc.safe ? "🛡 Safe" : "⚔ Contested"}</span>
              <span className="chip">
                Stock: {lv?.exactStock != null ? `${lv.exactStock} (Trail Markers)` : lv ? STOCK_TEXT[lv.stockLevel] : "?"}
              </span>
              <InfoTip title="Gathering">
                <p>A party walks here, gathers for {formatSeconds(loc.gatherMs)}, then walks home and delivers. It carries at most {DEFAULT_CONFIG.partyCapacity} units.</p>
                <p>{loc.safe ? "Safe sites cannot be ambushed." : "Contested sites yield more, but a rival can ambush parties gathering here and take their load."}</p>
                <p>Stock goes down as parties gather and slowly regrows. Exact numbers are only shown with Trail Markers.</p>
              </InfoTip>
            </div>
            <p className="text-xs text-bark-700">Trip from your stronghold: {tripLine(locationId)}.</p>
            {here.length > 0 && (
              <p className="text-xs">
                Parties here:{" "}
                {here.map((p) => {
                  const owner = view.players.find((x) => x.id === p.ownerId);
                  return (
                    <span key={p.id} className="mr-1 font-bold" style={{ color: owner?.color }}>
                      ● {p.ownerId === view.youId ? "you" : owner?.name} ({p.status})
                    </span>
                  );
                })}
              </p>
            )}
            {view.self && (
              <div className="space-y-1" data-tour="send-party">
                {myParties.map((p, i) => {
                  const busy = p.status !== "idle";
                  const atThisSite = p.locationId === locationId;
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-parchment-50 px-2 py-1">
                      <button className="focus-ring min-w-0 flex-1 truncate text-left text-xs" onClick={() => onSelectParty(p.id)}>
                        Party {i + 1}: <b>{partyLine(p, now)}</b>
                      </button>
                      {!busy ? (
                        <button className="btn-green shrink-0 px-2 py-0.5 text-xs" disabled={!!gatherBlock || pending === p.id} onClick={() => sendParty(p, locationId)}>
                          {pending === p.id ? "…" : "Send here"}
                        </button>
                      ) : atThisSite && (p.status === "traveling" || p.status === "gathering") ? (
                        <button className="btn-plain shrink-0 px-2 py-0.5 text-xs" disabled={!!recallBlock || pending === p.id} onClick={() => recall(p)}>
                          Recall
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                <Reason text={gatherBlock} />
              </div>
            )}
            {!loc.safe && (
              <button className="btn-danger mt-1 w-full" onClick={() => onPlanRaid({ kind: "location", locationId })}>
                ⚔️ Plan an ambush here ({enemies} enemy {enemies === 1 ? "party" : "parties"} gathering now)
              </button>
            )}
          </>
        ) : (
          <p>The Trading Post is the market. Exchange resources in the Actions tab.</p>
        )}
      </div>,
    );
  }

  // ---- Stronghold ----
  if (playerId) {
    const p = view.players.find((x) => x.id === playerId);
    if (!p) return null;
    const clan = CLANS[p.clan];
    const isMe = p.id === view.youId;
    const scout = scoutAvailability(view, p.id, now);
    return panel(
      <>
        <div className="font-display text-lg font-black" style={{ color: p.color }}>
          {clan.emblem} {p.name} {isMe && "(you)"}
        </div>
        <div className="text-xs text-bark-600">
          {clan.name} · {clan.abilityName}
          {clan.abilityKind === "active" ? (p.abilityUsed ? " (used)" : " (not used yet)") : " (always on)"}
        </div>
      </>,
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-1 text-xs">
          <span className="chip">🏰 Fort {p.fortDefense}{p.fortDefense === 0 ? " (exposed)" : ""}</span>
          <span className="chip">{p.hasBarricade ? "🧱 Barricade (size secret)" : "No barricade"}</span>
          <span className="chip">🃏 {p.handSize} cards</span>
          <span className="chip">👣 {p.partyCount} parties</span>
          <span className="chip">⭐ {p.score}</span>
          {p.eliminated && <span className="chip bg-bark-800 text-white">Eliminated</span>}
          {!p.connected && !p.eliminated && <span className="chip">{p.inactive ? "Inactive" : "Disconnected"}</span>}
        </div>
        {!isMe && <p className="text-[11px] text-bark-600">Hidden from you: their resources, cards, committed defenses and raid target. Scout them for a report.</p>}
        {!isMe && !p.eliminated && view.self && (
          <div className="grid grid-cols-3 gap-1.5">
            <button
              className="btn-plain px-1 text-xs"
              disabled={!scout.ok || pending === "scout"}
              onClick={() => run("scout", () => send({ type: "scout", targetPlayerId: p.id }, `Scouts sent to ${p.name}. Report added to your feed and the raid planner.`))}
            >
              🔭 Scout (2🪙)
            </button>
            <button className="btn-plain px-1 text-xs" onClick={() => onTrade(p.id)}>
              🤝 Trade
            </button>
            <button className="btn-danger px-1 text-xs" onClick={() => onPlanRaid({ kind: "player", playerId: p.id })}>
              ⚔️ Plan raid
            </button>
          </div>
        )}
        {!scout.ok && !isMe && !p.eliminated && <Reason text={`Scout: ${scout.reason}`} />}
      </div>,
    );
  }

  return (
    <p className="rounded-xl bg-parchment-50/90 px-3 py-2 text-xs text-bark-700" data-tour="selection">
      Tap a site on the map to gather there, a stronghold to scout or raid it, or a party above to manage it.
    </p>
  );
}

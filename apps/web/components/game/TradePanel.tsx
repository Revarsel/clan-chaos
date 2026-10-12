"use client";
import { useEffect, useState } from "react";
import { RESOURCE_TYPES, formatResources, type PlayerView, type Resources } from "@clan-chaos/shared";
import { DEFAULT_CONFIG } from "@clan-chaos/game-content";
import { useGame } from "@/hooks/useGame";
import { acceptTradeAvailability, costReason, phaseReason, tradeOfferAvailability } from "@/lib/availability";
import { InfoTip } from "../ui/Popover";
import { RESOURCE_ICON } from "@/lib/format";

const zero = (): Resources => ({ gold: 0, materials: 0, food: 0 });

function Amounts({ value, onChange }: { value: Resources; onChange: (r: Resources) => void }) {
  return (
    <div className="flex gap-1">
      {RESOURCE_TYPES.map((t) => (
        <label key={t} className="flex items-center gap-0.5 text-sm">
          {RESOURCE_ICON[t]}
          <input
            type="number"
            min={0}
            max={100}
            className="input w-14 px-1 py-0.5"
            value={value[t]}
            onChange={(e) => onChange({ ...value, [t]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
          />
        </label>
      ))}
    </div>
  );
}

export function TradePanel({ view, partner, now }: { view: PlayerView; partner: string | null; now: number }) {
  const { send } = useGame();
  const rivals = view.players.filter((p) => p.id !== view.youId && !p.eliminated);
  const [to, setTo] = useState(partner ?? rivals[0]?.id ?? "");
  const [give, setGive] = useState<Resources>(zero());
  const [want, setWant] = useState<Resources>(zero());
  useEffect(() => {
    if (partner) setTo(partner);
  }, [partner]);
  const canAct = view.phase === "build" || view.phase === "scheme";
  const offerAvail = tradeOfferAvailability(view, now);
  const respondBlock = phaseReason(view, "tradeRespond", now);
  const offerCost = costReason(view.self!.resources, give);
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";
  const self = view.self!;
  const left = DEFAULT_CONFIG.maxTradeOffersPerRound - self.tradesOfferedThisRound;
  const strip = (r: Resources) => Object.fromEntries(Object.entries(r).filter(([, n]) => n > 0));

  return (
    <div className="space-y-3 text-sm" data-testid="trade">
      <div className="flex items-start gap-2 rounded-xl bg-royal-400/10 p-2 text-xs">
        <p className="flex-1">
          Trades move resources between two clans and are <b>final once accepted</b>. Alliances and promises made in chat are informal: nothing stops a
          trade partner from raiding you later. Open offers expire at the end of the round.
        </p>
        <InfoTip title="Trading & alliances">
          <p>Send up to {DEFAULT_CONFIG.maxTradeOffersPerRound} offers per round. The server checks both sides can pay at the moment of acceptance.</p>
          <p>Only the two clans involved see an offer.</p>
        </InfoTip>
      </div>
      {view.truceOffer && (
        <div className="animate-pop rounded-xl border-2 border-royal-500 bg-royal-400/15 p-2">
          🤝 <b>{name(view.truceOffer.fromId)}</b> offers an Unstable Truce (this round and next; +2 points each if honoured).
          <div className="mt-1 flex gap-2">
            <button className="btn-green px-2 py-0.5 text-xs" disabled={!canAct} onClick={() => send({ type: "truceRespond", accept: true }, "Truce accepted")}>
              Accept
            </button>
            <button className="btn-plain px-2 py-0.5 text-xs" disabled={!canAct} onClick={() => send({ type: "truceRespond", accept: false }, "Truce refused")}>
              Refuse
            </button>
          </div>
        </div>
      )}
      {view.truces.length > 0 && (
        <div className="text-xs text-bark-700">
          Truces: {view.truces.map((t) => `${name(t.a)} ⇄ ${name(t.b)} (to round ${t.untilRound})`).join("; ")}
        </div>
      )}
      <div className="rounded-xl border-2 border-bark-700/40 bg-parchment-50 p-2.5">
        <div className="panel-title mb-1">New offer ({left} left this round)</div>
        <select className="input mb-2 py-1" aria-label="Trade partner" value={to} onChange={(e) => setTo(e.target.value)}>
          {rivals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="mb-1 text-xs font-bold">You give</div>
        <Amounts value={give} onChange={setGive} />
        <div className="mb-1 mt-2 text-xs font-bold">You want</div>
        <Amounts value={want} onChange={setWant} />
        <button
          className="btn-primary mt-2 w-full"
          disabled={!offerAvail.ok || !to || !!offerCost || (Object.keys(strip(give)).length + Object.keys(strip(want)).length === 0)}
          onClick={async () => {
            if (await send({ type: "tradeOffer", toPlayerId: to, give: strip(give), want: strip(want) }, `Offer sent to ${name(to)}. Nothing moves until they accept.`)) {
              setGive(zero());
              setWant(zero());
            }
          }}
        >
          Send offer
        </button>
        {!offerAvail.ok && <p className="mt-1 text-[11px] font-semibold text-ember-600">{offerAvail.reason}</p>}
        {offerAvail.ok && offerCost && <p className="mt-1 text-[11px] font-semibold text-ember-600">You can't offer that: {offerCost.toLowerCase()}</p>}
      </div>
      <div>
        <div className="panel-title mb-1">Offers</div>
        {view.trades.length === 0 && <p className="text-xs text-bark-600">No offers this round.</p>}
        <ul className="space-y-1.5">
          {[...view.trades].reverse().map((t) => {
            const incoming = t.toId === view.youId;
            return (
              <li key={t.id} className="rounded-lg bg-parchment-50 p-2 text-xs">
                {incoming ? (
                  <>
                    <b>{name(t.fromId)}</b> gives {formatResources(t.give)} for your {formatResources(t.want)}
                  </>
                ) : (
                  <>
                    To <b>{name(t.toId)}</b>: your {formatResources(t.give)} for {formatResources(t.want)}
                  </>
                )}
                <span className="ml-1 chip">{t.status}</span>
                {t.status === "open" && incoming && (() => {
                  const acc = acceptTradeAvailability(view, t.want, t.give, now);
                  return (
                    <>
                      <span className="ml-1 inline-flex gap-1">
                        <button className="btn-green px-2 py-0 text-xs" disabled={!acc.ok} onClick={() => send({ type: "tradeRespond", offerId: t.id, accept: true }, `Trade accepted: you received ${formatResources(t.give)} and paid ${formatResources(t.want)}.`)}>
                          Accept
                        </button>
                        <button className="btn-plain px-2 py-0 text-xs" disabled={!!respondBlock} onClick={() => send({ type: "tradeRespond", offerId: t.id, accept: false }, "Offer rejected.")}>
                          Reject
                        </button>
                      </span>
                      {!acc.ok && <p className="mt-0.5 text-[11px] font-semibold text-ember-600">{acc.reason}</p>}
                    </>
                  );
                })()}
                {t.status === "open" && !incoming && (
                  <button className="btn-plain ml-1 px-2 py-0 text-xs" disabled={!canAct} onClick={() => send({ type: "tradeCancel", offerId: t.id }, "Offer cancelled.")}>
                    Cancel
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

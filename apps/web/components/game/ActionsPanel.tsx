"use client";
import { useState } from "react";
import { RESOURCE_TYPES, type PlayerView, type ResourceType } from "@clan-chaos/shared";
import { CARDS, CLANS, COSTS, DEFAULT_CONFIG } from "@clan-chaos/game-content";
import { useGame } from "@/hooks/useGame";
import { RESOURCE_ICON, costText } from "@/lib/format";
import { costReason, economyAvailability, economyCost, marketAvailability, phaseReason, type EconomyAction } from "@/lib/availability";
import { describeCard } from "@/lib/cardInfo";
import { InfoTip } from "../ui/Popover";

const ACTIONS: { id: EconomyAction; label: string; icon: string; effect: (v: PlayerView) => string; help: string; done: string }[] = [
  {
    id: "buyCard",
    label: "Buy a card",
    icon: "🃏",
    effect: (v) => `Draw a random tactical card (hand ${v.self!.hand.length}/${v.self!.maxHandSize}).`,
    help: "Cards come from a shared deck. Check the Cards tab to read what you drew. Mushroom Merchants pay 2 for their first card each round.",
    done: "Card bought. See the Cards tab.",
  },
  {
    id: "recruitMercenaries",
    label: "Recruit mercenaries",
    icon: "🗡️",
    effect: (v) => `+2 attack on your next raid (now +${v.self!.mercenaryBonus}, max +${DEFAULT_CONFIG.maxMercenaryBonus}).`,
    help: "All recruited mercenaries join the next raid you submit and are used up by it, win or lose.",
    done: "Mercenaries recruited: +2 attack for your next raid.",
  },
  {
    id: "buildBarricade",
    label: "Build a barricade",
    icon: "🧱",
    effect: (v) => `+2 defense until a raid hits your stronghold (now +${v.self!.barricadeDefense}, max +${DEFAULT_CONFIG.maxBarricadeDefense}).`,
    help: "A barricade is used up by the next raid on your stronghold, whether that raid wins or not. Rivals see that you have one, but not its size.",
    done: "Barricade built.",
  },
  {
    id: "repairFort",
    label: "Repair fort",
    icon: "🔨",
    effect: (v) => `Restore up to 2 fort defense (now ${v.self!.fortDefense}/${v.self!.fortMax}).`,
    help: "Repairs restore defense up to your fort level. Raise the level with clan growth.",
    done: "Fort repaired.",
  },
  {
    id: "clanGrowth",
    label: "Clan growth",
    icon: "🌱",
    effect: (v) => `+1 fort level and +1 defense (level ${v.self!.fortMax}/${DEFAULT_CONFIG.fortMax}).`,
    help: "A permanent upgrade to your fort's maximum. The fort can never go above 7.",
    done: "Fort level increased.",
  },
  {
    id: "trainParty",
    label: "Train a party",
    icon: "👣",
    effect: (v) => `Another gathering party (${v.parties.filter((p) => p.ownerId === v.youId).length}/${DEFAULT_CONFIG.maxParties}).`,
    help: "More parties gather more at once. Each carries up to 6 units per trip.",
    done: "New gathering party trained.",
  },
];

export function ActionsPanel({ view, now }: { view: PlayerView; now: number }) {
  const { send } = useGame();
  const self = view.self!;
  const me = view.players.find((p) => p.id === view.youId)!;
  const [busy, setBusy] = useState<string | null>(null);
  const [give, setGive] = useState<ResourceType>("gold");
  const [get, setGet] = useState<ResourceType>("food");
  const [amount, setAmount] = useState(1);
  const caravan = self.effects.some((e) => e.startsWith("Merchant Caravan"));
  const rate = caravan ? DEFAULT_CONFIG.marketRateWithCaravan : DEFAULT_CONFIG.marketRate;
  const clan = CLANS[me.clan];
  const market = marketAvailability(view, give, get, amount, rate, now);
  const run = async (key: string, cmd: Parameters<typeof send>[0], msg: string) => {
    setBusy(key);
    await send(cmd, msg);
    setBusy(null);
  };

  return (
    <div className="space-y-3" data-tour="actions">
      <ul className="grid gap-2 sm:grid-cols-2">
        {ACTIONS.map((a) => {
          const avail = economyAvailability(view, a.id, now);
          const cost = economyCost(view, a.id);
          return (
            <li key={a.id} className={`rounded-xl border-2 p-2 ${avail.ok ? "border-bark-800 bg-parchment-50 shadow-pop" : "border-bark-700/30 bg-parchment-50/60"}`}>
              <div className="flex items-start justify-between gap-1">
                <div className="font-display text-sm font-black">
                  {a.icon} {a.label}
                </div>
                <InfoTip title={a.label}>
                  <p>{a.help}</p>
                </InfoTip>
              </div>
              <p className="text-xs text-bark-700">{a.effect(view)}</p>
              <button
                className={`${avail.ok ? "btn-primary" : "btn-plain"} mt-1 w-full py-1 text-xs`}
                disabled={!avail.ok || busy === a.id}
                aria-describedby={avail.ok ? undefined : `why-${a.id}`}
                onClick={() => run(a.id, { type: a.id }, a.done)}
              >
                {busy === a.id ? "Waiting for server…" : `Pay ${costText(cost)}`}
              </button>
              {!avail.ok && (
                <p id={`why-${a.id}`} className="mt-0.5 text-[11px] font-semibold text-ember-600">
                  {avail.reason}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {me.clan === "rats" && (
        <div className="rounded-xl border-2 border-gold-500 bg-gold-300/30 p-2">
          <div className="font-display text-sm font-black">
            {clan.emblem} {clan.abilityName} <span className="text-xs font-normal">(clan ability, once per match)</span>
          </div>
          <p className="text-xs">{clan.abilityText}</p>
          <button
            className="btn-primary mt-1 w-full py-1 text-xs"
            disabled={self.abilityUsed || !!phaseReason(view, "useClanAbility", now) || busy === "ability"}
            onClick={() => run("ability", { type: "useClanAbility" }, "Protection Money collected. See the Feed for the amount.")}
          >
            {self.abilityUsed ? "Already used" : "Use it now (free)"}
          </button>
          {!self.abilityUsed && phaseReason(view, "useClanAbility", now) && <p className="text-[11px] text-ember-600">{phaseReason(view, "useClanAbility", now)}</p>}
        </div>
      )}

      {view.merchantCard && (
        <div className="rounded-xl border-2 border-royal-500 bg-royal-400/15 p-2 text-sm">
          <div className="font-display font-black">🧙 Wandering Merchant</div>
          <p>
            Sells <b>{CARDS[view.merchantCard].name}</b> for {costText(COSTS.merchantCard)}. First come, first served.
          </p>
          <p className="text-xs text-bark-700">{describeCard(view.merchantCard).effect}</p>
          {(() => {
            const why = phaseReason(view, "buyMerchantCard", now) ?? (self.hand.length >= self.maxHandSize ? "Your hand is full." : costReason(self.resources, COSTS.merchantCard));
            return (
              <>
                <button className="btn-primary mt-1 px-3 py-0.5 text-xs" disabled={!!why || busy === "merchant"} onClick={() => run("merchant", { type: "buyMerchantCard" }, "Bought from the Wandering Merchant.")}>
                  Buy for {costText(COSTS.merchantCard)}
                </button>
                {why && <p className="text-[11px] text-ember-600">{why}</p>}
              </>
            );
          })()}
        </div>
      )}

      <div className="rounded-xl border-2 border-bark-700/40 bg-parchment-50 p-2.5">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="panel-title">⛺ Market · {rate}:1</span>
          <InfoTip title="Market">
            <p>Swap resources at the Trading Post: pay {rate} of one resource for 1 of another{caravan ? " (Merchant Caravan active)" : ". Merchant Caravan improves this to 2:1"}.</p>
          </InfoTip>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <label className="flex items-center gap-1">
            Get
            <input className="input w-16 px-2 py-1" type="number" inputMode="numeric" min={1} max={20} aria-label="Amount to receive" value={amount} onChange={(e) => setAmount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
          </label>
          <select className="input w-auto px-2 py-1" aria-label="Resource to receive" value={get} onChange={(e) => setGet(e.target.value as ResourceType)}>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RESOURCE_ICON[t]} {t}
              </option>
            ))}
          </select>
          <span>by paying {amount * rate}</span>
          <select className="input w-auto px-2 py-1" aria-label="Resource to pay" value={give} onChange={(e) => setGive(e.target.value as ResourceType)}>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RESOURCE_ICON[t]} {t}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-green mt-1.5 w-full py-1 text-xs" disabled={!market.ok || busy === "market"} onClick={() => run("market", { type: "marketExchange", give, get, amount }, `Exchanged ${amount * rate} ${give} for ${amount} ${get}.`)}>
          Exchange
        </button>
        {!market.ok && <p className="text-[11px] font-semibold text-ember-600">{market.reason}</p>}
      </div>

      {self.effects.length > 0 && (
        <div className="rounded-xl bg-royal-400/10 p-2 text-xs text-bark-800">
          <div className="font-bold">Active effects on you</div>
          {self.effects.map((e) => (
            <div key={e}>✨ {e}</div>
          ))}
        </div>
      )}
    </div>
  );
}

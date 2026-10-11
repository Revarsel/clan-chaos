"use client";
import { useState } from "react";
import { RESOURCE_TYPES, type PlayerView, type ResourceType } from "@clan-chaos/shared";
import { CARDS, CLANS, COSTS, DEFAULT_CONFIG } from "@clan-chaos/game-content";
import { useGame } from "@/hooks/useGame";
import { RESOURCE_ICON, costText } from "@/lib/format";

export function ActionsPanel({ view }: { view: PlayerView }) {
  const { send } = useGame();
  const self = view.self!;
  const me = view.players.find((p) => p.id === view.youId)!;
  const canAct = view.phase === "build" || view.phase === "scheme";
  const parties = view.parties.filter((p) => p.ownerId === view.youId);
  const r = self.resources;
  const afford = (c: Partial<Record<ResourceType, number>>) => RESOURCE_TYPES.every((t) => r[t] >= (c[t] ?? 0));
  const [give, setGive] = useState<ResourceType>("gold");
  const [get, setGet] = useState<ResourceType>("food");
  const [amount, setAmount] = useState(1);
  const caravan = self.effects.some((e) => e.startsWith("Merchant Caravan"));
  const rate = caravan ? DEFAULT_CONFIG.marketRateWithCaravan : DEFAULT_CONFIG.marketRate;
  const clan = CLANS[me.clan];

  const actions: { label: string; icon: string; cost: Partial<Record<ResourceType, number>>; hint: string; cmd: Parameters<typeof send>[0]; disabled?: boolean }[] = [
    {
      label: "Buy card",
      icon: "🃏",
      cost: { gold: self.nextCardCost },
      hint: `Draw a tactical card (${self.hand.length}/${self.maxHandSize})`,
      cmd: { type: "buyCard" },
      disabled: self.hand.length >= self.maxHandSize,
    },
    { label: "Mercenaries", icon: "🗡️", cost: COSTS.recruitMercenaries, hint: "+2 attack on your next raid", cmd: { type: "recruitMercenaries" }, disabled: self.mercenaryBonus >= 6 },
    { label: "Barricade", icon: "🧱", cost: COSTS.barricade, hint: "+2 defense until a raid hits (max +4)", cmd: { type: "buildBarricade" }, disabled: self.barricadeDefense >= 4 },
    { label: "Repair fort", icon: "🔨", cost: COSTS.repairFort, hint: `Restore 2 defense (up to ${self.fortMax})`, cmd: { type: "repairFort" }, disabled: self.fortDefense >= self.fortMax },
    { label: "Clan growth", icon: "🌱", cost: COSTS.clanGrowth, hint: "+1 permanent fort level (max 7)", cmd: { type: "clanGrowth" }, disabled: self.fortMax >= 7 },
    { label: "Train party", icon: "👣", cost: COSTS.trainParty, hint: `Another gathering party (${parties.length}/4)`, cmd: { type: "trainParty" }, disabled: parties.length >= 4 },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            className="flex flex-col items-start rounded-xl border-2 border-bark-800 bg-parchment-50 px-2.5 py-1.5 text-left shadow-pop transition hover:bg-white active:translate-y-0.5 active:shadow-none disabled:opacity-45"
            disabled={!canAct || !afford(a.cost) || a.disabled}
            onClick={() => send(a.cmd, `${a.label} done`)}
            title={a.hint}
          >
            <span className="font-display text-sm font-black">
              {a.icon} {a.label}
            </span>
            <span className="text-[11px] text-bark-600">
              {costText(a.cost)} · {a.hint}
            </span>
          </button>
        ))}
      </div>

      {clan.abilityKind === "active" && me.clan === "rats" && (
        <button
          className="btn-primary w-full"
          disabled={!canAct || self.abilityUsed}
          onClick={() => send({ type: "useClanAbility" }, "Protection money collected!")}
        >
          {clan.emblem} {clan.abilityName} {self.abilityUsed ? "(used)" : "— once per match"}
        </button>
      )}

      {view.merchantCard && (
        <div className="rounded-xl border-2 border-royal-500 bg-royal-400/15 p-2 text-sm">
          🧙 Wandering Merchant sells <b>{CARDS[view.merchantCard].name}</b> for 2🪙
          <button className="btn-primary ml-2 px-2 py-0.5 text-xs" disabled={!canAct || r.gold < 2} onClick={() => send({ type: "buyMerchantCard" }, "Bought from the merchant")}>
            Buy
          </button>
        </div>
      )}

      <div className="rounded-xl border-2 border-bark-700/40 bg-parchment-50 p-2.5">
        <div className="panel-title mb-1.5">⛺ Market · {rate}:1</div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          Pay
          <select className="input w-auto px-2 py-1" value={give} onChange={(e) => setGive(e.target.value as ResourceType)}>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RESOURCE_ICON[t]} {t}
              </option>
            ))}
          </select>
          for
          <input
            className="input w-16 px-2 py-1"
            type="number"
            min={1}
            max={20}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
          />
          <select className="input w-auto px-2 py-1" value={get} onChange={(e) => setGet(e.target.value as ResourceType)}>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RESOURCE_ICON[t]} {t}
              </option>
            ))}
          </select>
          <button
            className="btn-green px-2 py-1 text-xs"
            disabled={!canAct || give === get || r[give] < amount * rate}
            onClick={() => send({ type: "marketExchange", give, get, amount }, "Exchange complete")}
          >
            Trade ({amount * rate} {RESOURCE_ICON[give]})
          </button>
        </div>
      </div>
      {self.effects.length > 0 && (
        <div className="rounded-xl bg-royal-400/10 p-2 text-xs text-bark-800">
          {self.effects.map((e) => (
            <div key={e}>✨ {e}</div>
          ))}
        </div>
      )}
      <p className="text-xs text-bark-600">Tip: tap a location on the map to send gathering parties.</p>
    </div>
  );
}

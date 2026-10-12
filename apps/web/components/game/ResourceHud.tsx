"use client";
import { useEffect, useRef, useState } from "react";
import { RESOURCE_TYPES, type PlayerView, type ResourceType } from "@clan-chaos/shared";
import { CLANS, DEFAULT_CONFIG } from "@clan-chaos/game-content";
import { RESOURCE_ICON, RESOURCE_LABEL, costText } from "@/lib/format";
import { RESOURCE_PURPOSE, RESOURCE_SUBTITLE, cardsUsing, resourceSources, resourceUses } from "@/lib/resourceInfo";
import { costReason } from "@/lib/availability";
import { Popover } from "../ui/Popover";

type Tracked = ResourceType | "fort";

/** Recent change per value over the last few seconds, derived from successive server views. */
function useRecentDeltas(values: Record<Tracked, number>): Partial<Record<Tracked, number>> {
  const prev = useRef(values);
  const [deltas, setDeltas] = useState<Partial<Record<Tracked, { v: number; at: number }>>>({});
  const key = JSON.stringify(values);
  useEffect(() => {
    const changed: Partial<Record<Tracked, { v: number; at: number }>> = {};
    for (const k of Object.keys(values) as Tracked[]) {
      const d = values[k] - prev.current[k];
      if (d !== 0) changed[k] = { v: d, at: Date.now() };
    }
    prev.current = values;
    if (Object.keys(changed).length) setDeltas((old) => ({ ...old, ...changed }));
  }, [key]);
  useEffect(() => {
    const id = setInterval(() => {
      setDeltas((old) => {
        const now = Date.now();
        const kept = Object.fromEntries(Object.entries(old).filter(([, x]) => x && now - x.at < 5000));
        return Object.keys(kept).length === Object.keys(old).length ? old : kept;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return Object.fromEntries(Object.entries(deltas).map(([k, x]) => [k, x!.v]));
}

function Delta({ v }: { v?: number }) {
  if (!v) return null;
  return (
    <span className={`animate-pop rounded px-1 text-[11px] font-black ${v > 0 ? "bg-moss-400 text-bark-900" : "bg-ember-500 text-white"}`} aria-label={`changed by ${v}`}>
      {v > 0 ? `+${v}` : v}
    </span>
  );
}

const chip =
  "focus-ring flex min-w-[5.5rem] flex-col items-start rounded-xl border-2 border-bark-800 bg-parchment-50 px-2 py-1 text-left shadow-pop hover:bg-white";

export function ResourceHud({ view }: { view: PlayerView }) {
  const self = view.self;
  const me = view.players.find((p) => p.id === view.youId);
  const deltas = useRecentDeltas({
    gold: self?.resources.gold ?? 0,
    materials: self?.resources.materials ?? 0,
    food: self?.resources.food ?? 0,
    fort: self?.fortDefense ?? 0,
  });
  if (!self || !me) return null;
  const clan = CLANS[me.clan];

  return (
    <section aria-label="Your resources and fort" data-tour="hud" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {RESOURCE_TYPES.map((t) => {
        const sub = RESOURCE_SUBTITLE[t](self.resources, self.nextCardCost);
        return (
          <Popover
            key={t}
            label={`${RESOURCE_LABEL[t]}: ${self.resources[t]} of ${self.storageCap}. Tap for details.`}
            buttonClassName={chip}
            trigger={
              <>
                <span className="flex items-center gap-1 text-base">
                  <span aria-hidden>{RESOURCE_ICON[t]}</span>
                  <b className="tabular-nums">{self.resources[t]}</b>
                  <span className="text-[10px] text-bark-500">/{self.storageCap}</span>
                  <Delta v={deltas[t]} />
                </span>
                <span className={`whitespace-nowrap text-[10px] leading-tight ${sub.warn ? "font-bold text-ember-600" : "text-bark-600"}`}>
                  {RESOURCE_LABEL[t]} · {sub.text}
                </span>
              </>
            }
          >
            <div className="font-display font-black">
              {RESOURCE_ICON[t]} {RESOURCE_LABEL[t]}: {self.resources[t]} / {self.storageCap}
              {self.safeReserve[t] > 0 && <span className="text-royal-600"> (+{self.safeReserve[t]} evacuated, returns after upkeep)</span>}
            </div>
            <p className="mt-1">{RESOURCE_PURPOSE[t]}</p>
            <p className="mt-1 text-xs text-bark-600">Storage cap: {self.storageCap}. Anything over the cap is lost.</p>
            <div className="mt-2 font-bold">Spent on</div>
            <ul className="text-xs">
              {resourceUses(t, self.nextCardCost).map((u) => {
                const why = costReason(self.resources, u.cost);
                return (
                  <li key={u.label}>
                    {why ? "✖" : "✔"} {u.label} — {costText(u.cost)}
                    {why && <span className="text-ember-600"> ({why.replace("Needs ", "need ").replace(".", "")})</span>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-xs text-bark-600">Cards that cost {RESOURCE_LABEL[t].toLowerCase()}: {cardsUsing(t).join(", ") || "none"}.</p>
            <div className="mt-2 font-bold">Gather it at</div>
            <ul className="text-xs">{resourceSources(t).map((s) => <li key={s}>• {s}</li>)}</ul>
          </Popover>
        );
      })}

      <Popover
        label={`Fort ${self.fortDefense} of ${self.fortMax}${self.fortDefense === 0 ? ", exposed" : ""}. Tap for details.`}
        buttonClassName={`${chip} ${self.fortDefense === 0 ? "border-ember-600 bg-ember-400/20" : ""}`}
        trigger={
          <>
            <span className="flex items-center gap-1 text-base">
              <span aria-hidden>🏰</span>
              <b className="tabular-nums">{self.fortDefense}</b>
              <span className="text-[10px] text-bark-500">/{self.fortMax}</span>
              <Delta v={deltas.fort} />
            </span>
            <span className={`whitespace-nowrap text-[10px] leading-tight ${self.fortDefense === 0 ? "font-bold text-ember-600" : "text-bark-600"}`}>
              {self.fortDefense === 0 ? "Fort EXPOSED" : `Fort · max ${DEFAULT_CONFIG.fortMax}`}
            </span>
          </>
        }
      >
        <div className="font-display font-black">🏰 Fort defense {self.fortDefense} / {self.fortMax}</div>
        <p className="mt-1">Your fort&apos;s defense counts against every raid on your stronghold. A successful raid usually deals 1 fort damage.</p>
        <p className="mt-1">
          Fort level ({self.fortMax}) is how high repairs can restore it. Clan growth raises the level, up to {DEFAULT_CONFIG.fortMax}.
        </p>
        {self.fortDefense === 0 ? (
          <p className="mt-1 font-bold text-ember-600">
            Exposed: your fort adds no defense. If a successful raid leaves you with no fort and no resources, your clan is eliminated. Repair (2 materials) or build a barricade.
          </p>
        ) : (
          <p className="mt-1 text-xs text-bark-600">At 0 the fort is exposed and adds no defense.</p>
        )}
        <p className="mt-1 text-xs">An intact fort (above 0) at the end of the match is worth +2 points.</p>
      </Popover>

      {self.barricadeDefense > 0 && (
        <Popover label="Barricade. Tap for details." buttonClassName={chip} trigger={<><span className="text-base">🧱 <b>+{self.barricadeDefense}</b></span><span className="text-[10px] text-bark-600">Barricade</span></>}>
          <p>Barricades add +{self.barricadeDefense} defense against the next raid on your stronghold, and are used up by that raid whether it succeeds or not. Max +{DEFAULT_CONFIG.maxBarricadeDefense}.</p>
          <p className="mt-1 text-xs text-bark-600">Rivals can see that you have a barricade, but not how big it is.</p>
        </Popover>
      )}
      {self.reinforcementDefense > 0 && (
        <Popover label="Reinforcements. Tap for details." buttonClassName={chip} trigger={<><span className="text-base">🛡️ <b>+{self.reinforcementDefense}</b></span><span className="text-[10px] text-bark-600">Reinforced</span></>}>
          <p>Last-Minute Reinforcements: +{self.reinforcementDefense} defense against the next raid that hits you. Secret until then.</p>
        </Popover>
      )}
      <Popover
        label={`Mercenaries +${self.mercenaryBonus}. Tap for details.`}
        buttonClassName={chip}
        trigger={<><span className="text-base">🗡️ <b>+{self.mercenaryBonus}</b></span><span className="text-[10px] text-bark-600">Mercenaries</span></>}
      >
        <p>Mercenaries add attack to your next raid: +2 per recruit (3 gold + 2 food), up to +{DEFAULT_CONFIG.maxMercenaryBonus}.</p>
        <p className="mt-1">All of them join the next raid you submit and are used up by it, win or lose.</p>
      </Popover>
      <Popover
        label={`Score ${me.score} points. Tap for details.`}
        buttonClassName={`${chip} bg-gold-300`}
        trigger={<><span className="text-base">⭐ <b>{me.score}</b></span><span className="text-[10px] text-bark-700">Points</span></>}
      >
        <p className="font-bold">Your points so far</p>
        {self.scoreBreakdown.length ? (
          <ul className="text-xs">{self.scoreBreakdown.map((s, i) => <li key={i}>+{s.points} {s.reason} (R{s.round})</li>)}</ul>
        ) : (
          <p className="text-xs">No points yet.</p>
        )}
        <p className="mt-1 text-xs text-bark-600">See the Players tab for how points are earned and how ties are broken.</p>
      </Popover>
      <Popover
        label={`Clan ability: ${clan.abilityName}. Tap for details.`}
        buttonClassName={chip}
        trigger={
          <>
            <span className="text-base">
              {clan.emblem} <b className="text-xs">{clan.abilityName}</b>
            </span>
            <span className="text-[10px] text-bark-600">{clan.abilityKind === "active" ? (self.abilityUsed ? "Used" : "Ready · once") : "Always on"}</span>
          </>
        }
      >
        <p className="font-bold">{clan.name}</p>
        <p>{clan.abilityText}</p>
        <p className="mt-1 text-xs text-bark-600">
          {me.clan === "rats" && "Use it from the Actions tab during Build & Gather or Scheme & Commit."}
          {me.clan === "foxfire" && "After you submit a raid, the Raid tab offers Change of Heart until orders lock."}
          {me.clan === "mushrooms" && "Applied automatically: the Buy card button shows the discounted price."}
          {me.clan === "toads" && "Applied automatically at the start of the match."}
        </p>
      </Popover>
    </section>
  );
}

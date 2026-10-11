"use client";
import { useEffect, useState } from "react";
import { RESOURCE_TYPES, type PlayerView, type RaidTarget, type ResourceType } from "@clan-chaos/shared";
import { CARDS, MAP_LOCATIONS, getLocation } from "@clan-chaos/game-content";
import { useGame } from "@/hooks/useGame";
import { RESOURCE_ICON } from "@/lib/format";

const targetKey = (t: RaidTarget) => (t.kind === "player" ? `p:${t.playerId}` : `l:${t.locationId}`);
const parseKey = (k: string): RaidTarget | null =>
  k.startsWith("p:") ? { kind: "player", playerId: k.slice(2) } : k.startsWith("l:") ? { kind: "location", locationId: k.slice(2) } : null;

export function RaidPanel({ view, hint }: { view: PlayerView; hint: RaidTarget | null }) {
  const { send } = useGame();
  const self = view.self!;
  const rivals = view.players.filter((p) => p.id !== view.youId && !p.eliminated);
  const contested = MAP_LOCATIONS.filter((l) => l.resource && !l.safe);
  const [target, setTarget] = useState<string>(hint ? targetKey(hint) : rivals[0] ? `p:${rivals[0].id}` : "");
  const [primary, setPrimary] = useState("");
  const [support, setSupport] = useState("");
  const [decoy, setDecoy] = useState("");
  const [priority, setPriority] = useState<ResourceType>("gold");
  const [retarget, setRetarget] = useState("");

  useEffect(() => {
    if (hint) setTarget(targetKey(hint));
  }, [hint]);

  const isLocation = target.startsWith("l:");
  const attackCards = self.hand.filter((c) => CARDS[c.cardId].timing === "attack" && !(isLocation && CARDS[c.cardId].strongholdOnly));
  const primaries = attackCards.filter((c) => CARDS[c.cardId].slot !== "support" && c.uid !== support);
  const supports = attackCards.filter((c) => CARDS[c.cardId].slot !== "primary" && c.uid !== primary);
  const usesFalseFlag = [primary, support].some((uid) => self.hand.find((c) => c.uid === uid)?.cardId === "false_flag");
  const preview =
    2 +
    self.mercenaryBonus +
    [primary, support].reduce((sum, uid) => {
      const c = self.hand.find((x) => x.uid === uid);
      return sum + (c ? (CARDS[c.cardId].params.attack ?? 0) : 0);
    }, 0);
  const raid = self.raid;
  const me = view.players.find((p) => p.id === view.youId)!;

  const nameOf = (t: RaidTarget) => (t.kind === "player" ? view.players.find((p) => p.id === t.playerId)?.name : getLocation(t.locationId)?.name);

  if (raid) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border-2 border-ember-500 bg-ember-400/15 p-3">
          <div className="panel-title text-ember-600">Raid committed 🔒</div>
          <div className="mt-1 font-display text-lg font-black">Target: {nameOf(raid.target)}</div>
          <div className="text-sm">
            Cards: {[raid.primaryCard, raid.supportCard].filter(Boolean).map((c) => CARDS[c!].name).join(" + ") || "none"} · Mercenaries +
            {raid.mercenaryBonus} · Priority {RESOURCE_ICON[raid.priority]}
          </div>
          <div className="mt-1 text-xs text-bark-600">Hidden from rivals until Resolution.</div>
        </div>
        {me.clan === "foxfire" && view.phase === "scheme" && (
          <div className="rounded-xl border-2 border-royal-500 bg-royal-400/10 p-2">
            <div className="panel-title mb-1">🦊 Change of Heart {self.abilityUsed ? "(used)" : "(once per match)"}</div>
            <div className="flex gap-1">
              <select className="input px-2 py-1 text-sm" value={retarget} onChange={(e) => setRetarget(e.target.value)} disabled={self.abilityUsed}>
                <option value="">New target…</option>
                {rivals.map((p) => (
                  <option key={p.id} value={`p:${p.id}`}>
                    🏰 {p.name}
                  </option>
                ))}
                {contested.map((l) => (
                  <option key={l.id} value={`l:${l.id}`}>
                    📍 {l.name}
                  </option>
                ))}
              </select>
              <button
                className="btn-primary px-2 text-xs"
                disabled={self.abilityUsed || !retarget}
                onClick={() => {
                  const t = parseKey(retarget);
                  if (t) void send({ type: "foxfireRetarget", target: t }, "Target changed!");
                }}
              >
                Switch
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view.phase !== "scheme") {
    return (
      <div className="rounded-xl bg-parchment-50 p-3 text-sm text-bark-700">
        {view.phase === "build"
          ? "Raids are committed during the Scheme phase. Prepare now: recruit mercenaries, buy attack cards, scout rivals."
          : "Orders are locked."}
        <div className="mt-2 text-xs">Mercenaries ready: +{self.mercenaryBonus}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <label className="block">
        <span className="panel-title">Target</span>
        <select className="input mt-0.5 py-1.5" value={target} onChange={(e) => setTarget(e.target.value)}>
          {rivals.map((p) => (
            <option key={p.id} value={`p:${p.id}`}>
              🏰 {p.name} (fort {p.fortDefense}
              {p.hasBarricade ? " + barricade" : ""})
            </option>
          ))}
          {contested.map((l) => (
            <option key={l.id} value={`l:${l.id}`}>
              📍 Ambush at {l.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="panel-title">Primary card</span>
          <select className="input mt-0.5 py-1.5" value={primary} onChange={(e) => setPrimary(e.target.value)}>
            <option value="">None</option>
            {primaries.map((c) => (
              <option key={c.uid} value={c.uid}>
                {CARDS[c.cardId].icon} {CARDS[c.cardId].name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="panel-title">Support card</span>
          <select className="input mt-0.5 py-1.5" value={support} onChange={(e) => setSupport(e.target.value)}>
            <option value="">None</option>
            {supports.map((c) => (
              <option key={c.uid} value={c.uid}>
                {CARDS[c.cardId].icon} {CARDS[c.cardId].name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {usesFalseFlag && (
        <label className="block">
          <span className="panel-title">False Flag decoy</span>
          <select className="input mt-0.5 py-1.5" value={decoy} onChange={(e) => setDecoy(e.target.value)}>
            <option value="">Choose decoy…</option>
            {rivals
              .filter((p) => `p:${p.id}` !== target)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
      )}
      {!isLocation && (
        <div>
          <span className="panel-title">Steal first</span>
          <div className="mt-0.5 flex gap-1">
            {RESOURCE_TYPES.map((t) => (
              <button key={t} className={`btn flex-1 ${priority === t ? "bg-gold-400" : "bg-parchment-50"}`} onClick={() => setPriority(t)}>
                {RESOURCE_ICON[t]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-lg bg-parchment-50 p-2 text-xs">
        Estimated attack <b className="text-base">{preview}</b> (base 2 + mercenaries {self.mercenaryBonus} + cards). Must be{" "}
        <i>greater</i> than the target&apos;s defense. A failed raid costs 2🪙.
      </div>
      <button
        className="btn-danger w-full py-2.5 text-base"
        disabled={!target || (usesFalseFlag && !decoy)}
        onClick={() => {
          const t = parseKey(target);
          if (!t) return;
          void send(
            {
              type: "commitRaid",
              target: t,
              primaryCardUid: primary || undefined,
              supportCardUid: support || undefined,
              decoyPlayerId: usesFalseFlag ? decoy : undefined,
              priority,
            },
            "Raid order sealed!",
          );
        }}
      >
        ⚔️ Commit secret raid
      </button>
    </div>
  );
}

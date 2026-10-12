"use client";
import { useEffect, useState } from "react";
import { RESOURCE_TYPES, type PlayerView, type RaidTarget, type ResourceType } from "@clan-chaos/shared";
import { CARDS, COSTS, MAP_LOCATIONS } from "@clan-chaos/game-content";
import { useGame } from "@/hooks/useGame";
import { RESOURCE_ICON, RESOURCE_LABEL, costText } from "@/lib/format";
import { economyAvailability, phaseReason } from "@/lib/availability";
import { describeCard } from "@/lib/cardInfo";
import {
  cardOptions,
  draftCards,
  draftCost,
  draftPreview,
  enemyGatherersAt,
  failurePenalty,
  raidStatus,
  sanitizeDraft,
  submitBlocker,
  targetLabel,
  type RaidDraft,
  type RaidStage,
} from "@/lib/raidPlan";
import { explainRaid } from "@/lib/resolutionText";
import { formatSeconds } from "@/lib/phaseInfo";
import { InfoTip } from "../ui/Popover";
import { Sheet } from "../ui/Sheet";

const STAGES: { id: RaidStage; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "submitted", label: "Submitted" },
  { id: "locked", label: "Locked" },
  { id: "resolved", label: "Resolved" },
];

function StatusStepper({ stage, view, now }: { stage: RaidStage; view: PlayerView; now: number }) {
  const order: RaidStage[] = ["draft", "submitted", "locked", "resolved"];
  const reached = (s: RaidStage) => {
    if (stage === "resolved") return true;
    if (stage === "submitted" || stage === "submitting") return s === "draft" || (s === "submitted" && stage === "submitted");
    if (stage === "draft") return s === "draft";
    return false;
  };
  return (
    <ol className="flex items-center gap-1 text-[11px] font-bold" aria-label="Raid order status">
      {STAGES.map((s, i) => (
        <li key={s.id} className="flex items-center gap-1">
          <span
            className={`rounded-full px-2 py-0.5 ${reached(s.id) ? "bg-royal-500 text-white" : "bg-bark-800/10 text-bark-600"}`}
            aria-current={order.indexOf(s.id) === order.indexOf(stage === "submitting" ? "draft" : stage) ? "step" : undefined}
          >
            {s.label}
            {s.id === "locked" && view.phase === "scheme" && stage === "submitted" ? ` in ${formatSeconds(view.phaseEndsAt - now)}` : ""}
          </span>
          {i < STAGES.length - 1 && <span aria-hidden>→</span>}
        </li>
      ))}
    </ol>
  );
}

function Step({ n, title, children, help }: { n: number; title: string; children: React.ReactNode; help?: React.ReactNode }) {
  return (
    <section className="rounded-xl border-2 border-bark-700/25 bg-parchment-50 p-2.5" aria-label={`Step ${n}: ${title}`}>
      <h3 className="mb-1 flex items-center gap-2 font-display text-sm font-black">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-bark-800 text-[11px] text-white">{n}</span>
        {title}
        {help && <InfoTip title={title}>{help}</InfoTip>}
      </h3>
      {children}
    </section>
  );
}

export function RaidPanel({
  view,
  now,
  draft,
  setDraft,
}: {
  view: PlayerView;
  now: number;
  draft: RaidDraft;
  setDraft: (d: RaidDraft) => void;
}) {
  const { send, sendCommand } = useGame();
  const self = view.self!;
  const me = view.players.find((p) => p.id === view.youId)!;
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const [retarget, setRetarget] = useState("");
  const rivals = view.players.filter((p) => p.id !== view.youId && !p.eliminated);
  const contested = MAP_LOCATIONS.filter((l) => l.resource && !l.safe);

  // Keep the draft legal as the hand, target list and phase change.
  useEffect(() => {
    const clean = sanitizeDraft(view, draft);
    if (JSON.stringify(clean) !== JSON.stringify(draft)) setDraft(clean);
  }, [view, draft, setDraft]);

  const status = raidStatus(view, draft, submitting);
  const preview = draftPreview(view, draft);
  const cost = draftCost(view, draft);
  const cards = draftCards(view, draft);
  const blocker = submitBlocker(view, draft, now, (n) => phaseReason(view, "commitRaid", n));
  const merc = economyAvailability(view, "recruitMercenaries", now);
  const set = (patch: Partial<RaidDraft>) => {
    setRejected(null);
    setDraft(sanitizeDraft(view, { ...draft, ...patch }));
  };

  const submit = async () => {
    if (!draft.target) return;
    setConfirm(false);
    setSubmitting(true);
    setRejected(null);
    const res = await sendCommand(
      {
        type: "commitRaid",
        target: draft.target,
        primaryCardUid: draft.primaryUid ?? undefined,
        supportCardUid: draft.supportUid ?? undefined,
        decoyPlayerId: draft.decoyId ?? undefined,
        priority: draft.priority,
      },
      "Raid order accepted by the server. It is secret and final.",
    );
    setSubmitting(false);
    if (!res.ok) setRejected(`${res.message} Your draft is unchanged.`);
  };

  const header = (
    <div className="mb-2 space-y-1 rounded-xl border-2 border-bark-800 bg-parchment-50 p-2" data-testid="raid-status" aria-live="polite">
      <StatusStepper stage={status.stage} view={view} now={now} />
      <p className="text-sm">
        <b>{status.label}.</b> {status.detail}
      </p>
      {rejected && (
        <p className="text-sm font-semibold text-ember-600" role="alert">
          Rejected: {rejected}
        </p>
      )}
    </div>
  );

  // ---- Resolved this round ----
  const mine = view.resolutionRound === view.round ? view.resolutions.find((r) => r.attackerId === view.youId) : undefined;
  if (mine && (view.phase === "resolution" || view.phase === "ended")) {
    const e = explainRaid(view, mine);
    return (
      <div>
        {header}
        <div className="rounded-xl border-2 border-bark-800 bg-parchment-50 p-3 text-sm">
          <div className="font-display text-lg font-black">
            {e.outcome}: {e.attackerName} → {e.targetName}
          </div>
          <p>{e.why}</p>
          <ul className="mt-1 list-disc pl-5">{e.changes.map((c) => <li key={c}>{c}</li>)}</ul>
          <p className="mt-1 text-xs text-bark-600">Full details for every raid are in the Feed tab.</p>
        </div>
      </div>
    );
  }

  // ---- Submitted ----
  if (self.raid) {
    const r = self.raid;
    return (
      <div className="space-y-2">
        {header}
        <div className="rounded-xl border-2 border-ember-500 bg-ember-400/15 p-3 text-sm" data-testid="raid-submitted">
          <div className="panel-title text-ember-600">Your submitted order 🔒</div>
          <div className="font-display text-lg font-black">Target: {targetLabel(view, r.target)}</div>
          <div>
            Cards: {[r.primaryCard, r.supportCard].filter(Boolean).map((c) => CARDS[c!].name).join(" + ") || "none"} · Mercenaries +{r.mercenaryBonus}
            {r.target.kind === "player" && <> · Steal first: {RESOURCE_LABEL[r.priority]}</>}
          </div>
          <p className="mt-1 text-xs text-bark-700">Rivals only see that you submitted a raid, not the target or cards. It resolves when Resolution starts.</p>
        </div>
        {me.clan === "foxfire" && view.phase === "scheme" && (
          <div className="rounded-xl border-2 border-royal-500 bg-royal-400/10 p-2">
            <div className="panel-title mb-1">🦊 Change of Heart {self.abilityUsed ? "(used)" : "(free, once per match)"}</div>
            <div className="flex gap-1">
              <select className="input px-2 py-1 text-sm" aria-label="New raid target" value={retarget} onChange={(e) => setRetarget(e.target.value)} disabled={self.abilityUsed}>
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
                  const t: RaidTarget = retarget.startsWith("p:") ? { kind: "player", playerId: retarget.slice(2) } : { kind: "location", locationId: retarget.slice(2) };
                  void send({ type: "foxfireRetarget", target: t }, "Target changed. The new target is just as secret.");
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

  const target = draft.target;
  const targetPlayer = target?.kind === "player" ? view.players.find((p) => p.id === target.playerId) : undefined;
  const intel = targetPlayer ? view.intel.filter((i) => i.aboutId === targetPlayer.id && i.round === view.round) : [];
  const after = Object.fromEntries(RESOURCE_TYPES.map((t) => [t, self.resources[t] - (cost[t] ?? 0)])) as Record<ResourceType, number>;

  return (
    <div className="space-y-2 text-sm" data-tour="raid-planner">
      {header}
      {view.phase === "build" && (
        <p className="rounded-lg bg-royal-400/10 p-2 text-xs">
          You can plan now. Submitting opens when Scheme & Commit starts in {formatSeconds(view.phaseEndsAt - now)}.
        </p>
      )}

      <Step n={1} title="Choose a target" help={<><p>Raid a rival stronghold to steal resources and damage its fort, or ambush a contested site to rob parties gathering there.</p><p>One raid per round. Raiding is optional.</p></>}>
        <div className="grid gap-1 sm:grid-cols-2" role="radiogroup" aria-label="Raid target">
          {rivals.map((p) => {
            const on = target?.kind === "player" && target.playerId === p.id;
            return (
              <button key={p.id} role="radio" aria-checked={on} onClick={() => set({ target: { kind: "player", playerId: p.id } })} className={`focus-ring rounded-lg border-2 px-2 py-1 text-left text-xs ${on ? "border-royal-500 bg-royal-400/20" : "border-bark-700/30 bg-white"}`}>
                <b style={{ color: p.color }}>🏰 {p.name}</b> · fort {p.fortDefense}
                {p.hasBarricade ? " · 🧱" : ""}
              </button>
            );
          })}
          {contested.map((l) => {
            const on = target?.kind === "location" && target.locationId === l.id;
            const n = enemyGatherersAt(view, l.id);
            return (
              <button key={l.id} role="radio" aria-checked={on} onClick={() => set({ target: { kind: "location", locationId: l.id } })} className={`focus-ring rounded-lg border-2 px-2 py-1 text-left text-xs ${on ? "border-royal-500 bg-royal-400/20" : "border-bark-700/30 bg-white"}`}>
                <b>📍 Ambush {l.name}</b> · {n} enemy {n === 1 ? "party" : "parties"} now
              </button>
            );
          })}
        </div>
      </Step>

      {target && (
        <Step n={2} title="What you know about the target">
          {targetPlayer ? (
            <>
              <ul className="text-xs">
                <li>✔ Known: fort {targetPlayer.fortDefense}{targetPlayer.fortDefense === 0 ? " (exposed)" : ""}</li>
                <li>✔ Known: {targetPlayer.hasBarricade ? "has a barricade (+2 or +4, exact size secret)" : "no barricade"}</li>
                <li>✔ Known: {targetPlayer.handSize} cards in hand</li>
                <li>❓ Hidden: their resources, committed defense cards, reinforcements, and whether they raid you</li>
              </ul>
              {intel.length > 0 ? (
                <div className="mt-1 rounded bg-royal-400/10 p-1.5 text-xs">
                  <b>Your scouting this round:</b> {intel[intel.length - 1]!.text} <i>(a snapshot; it may have changed)</i>
                </div>
              ) : (
                <p className="mt-1 text-xs text-bark-600">Scout them from the map ({costText(COSTS.scout)}) for a private report.</p>
              )}
            </>
          ) : (
            <ul className="text-xs">
              <li>✔ Known: {enemyGatherersAt(view, (target as { locationId: string }).locationId)} enemy parties gathering there right now</li>
              <li>❓ Unknown: who will still be there when orders lock</li>
            </ul>
          )}
        </Step>
      )}

      {target && (
        <Step n={3} title="Attach cards (optional)" help={<><p>A raid can carry one primary card and one support card. Only raid cards can be attached.</p><p>Card costs are paid when you submit.</p></>}>
          {(["primary", "support"] as const).map((slot) => {
            const opts = cardOptions(view, draft, slot);
            const current = slot === "primary" ? draft.primaryUid : draft.supportUid;
            return (
              <fieldset key={slot} className="mb-1">
                <legend className="text-xs font-bold capitalize">{slot} slot</legend>
                <div className="flex flex-wrap gap-1">
                  <button className={`focus-ring rounded-lg border-2 px-2 py-1 text-xs ${!current ? "border-royal-500 bg-royal-400/20" : "border-bark-700/30 bg-white"}`} aria-pressed={!current} onClick={() => set(slot === "primary" ? { primaryUid: null } : { supportUid: null })}>
                    No card
                  </button>
                  {opts.map((o) => {
                    const d = describeCard(o.card.cardId);
                    const on = current === o.card.uid;
                    return (
                      <span key={o.card.uid} className="inline-flex items-center gap-0.5">
                        <button
                          disabled={!o.ok}
                          aria-pressed={on}
                          onClick={() => set(slot === "primary" ? { primaryUid: o.card.uid } : { supportUid: o.card.uid })}
                          className={`focus-ring rounded-lg border-2 px-2 py-1 text-left text-xs disabled:opacity-60 ${on ? "border-royal-500 bg-royal-400/20" : "border-bark-700/30 bg-white"}`}
                        >
                          {d.icon} <b>{d.name}</b> · {d.attackBonus ? `+${d.attackBonus} atk · ` : ""}
                          {costText(d.cost)}
                          {!o.ok && <span className="block text-[11px] text-ember-600">✖ {o.reason}</span>}
                        </button>
                        <InfoTip title={d.name}>
                          <p>{d.effect}</p>
                          <p className="text-xs">{d.applies}</p>
                        </InfoTip>
                      </span>
                    );
                  })}
                </div>
                {opts.length === 0 && <p className="text-xs text-bark-600">No raid cards in your hand for this slot.</p>}
              </fieldset>
            );
          })}
          {cards.some((c) => c.cardId === "false_flag") && (
            <label className="mt-1 block text-xs font-bold">
              False Flag decoy (scouts will think you target them)
              <select className="input mt-0.5 py-1" value={draft.decoyId ?? ""} onChange={(e) => set({ decoyId: e.target.value || null })}>
                <option value="">Choose a decoy…</option>
                {rivals
                  .filter((p) => !(target.kind === "player" && target.playerId === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </Step>
      )}

      {target && (
        <Step n={4} title="Mercenaries" help={<p>Every mercenary you have recruited joins your next submitted raid and is used up by it. +2 attack per recruit, up to +6.</p>}>
          <p className="text-xs">
            <b>+{self.mercenaryBonus} attack</b> will join this raid automatically.
          </p>
          <button className="btn-plain mt-1 px-2 py-0.5 text-xs" disabled={!merc.ok} onClick={() => send({ type: "recruitMercenaries" }, "Mercenaries recruited: +2 attack for your next raid.")}>
            🗡️ Recruit +2 ({costText(COSTS.recruitMercenaries)})
          </button>
          {!merc.ok && <p className="text-[11px] text-ember-600">{merc.reason}</p>}
        </Step>
      )}

      {target?.kind === "player" && (
        <Step n={5} title="Steal first" help={<p>On success you steal up to 6 units, starting with this resource, then whatever they have most of. You can only take what fits in your storage.</p>}>
          <div className="flex gap-1" role="radiogroup" aria-label="Resource to steal first">
            {RESOURCE_TYPES.map((t) => (
              <button key={t} role="radio" aria-checked={draft.priority === t} className={`btn flex-1 ${draft.priority === t ? "bg-gold-400" : "bg-parchment-50"}`} onClick={() => set({ priority: t })}>
                {RESOURCE_ICON[t]} {RESOURCE_LABEL[t]}
              </button>
            ))}
          </div>
        </Step>
      )}

      {target && preview && (
        <Step n={target.kind === "player" ? 6 : 5} title="Attack vs defense">
          <div className="grid gap-2 sm:grid-cols-2" data-testid="raid-preview">
            <div className="rounded-lg bg-ember-400/10 p-2">
              <div className="text-xs font-bold uppercase text-ember-600">Your attack (known)</div>
              <div className="font-display text-2xl font-black">{preview.attack}</div>
              <ul className="text-xs">{preview.attackParts.map((p) => <li key={p.label}>{p.label} {p.label === "Base" ? p.value : `${p.value > 0 ? "+" : ""}${p.value}`}</li>)}</ul>
            </div>
            <div className="rounded-lg bg-royal-400/10 p-2">
              <div className="text-xs font-bold uppercase text-royal-600">Their defense</div>
              <div className="font-display text-2xl font-black">
                {preview.visibleMin === preview.visibleMax ? preview.visibleMin : `${preview.visibleMin}–${preview.visibleMax}`}
                <span className="text-sm font-bold text-bark-600"> + ?</span>
              </div>
              <ul className="text-xs">
                {target.kind === "player" ? (
                  <>
                    <li>✔ Fort counted: {preview.fortCounted}</li>
                    {targetPlayer?.hasBarricade && <li>✔ Barricade: +2 or +4 (size hidden)</li>}
                    <li>❓ Unknown: defense cards, reinforcements, Counter-Ambush</li>
                  </>
                ) : (
                  <>
                    <li>✔ 1 per enemy party gathering now</li>
                    <li>❓ Unknown: who stays until orders lock</li>
                  </>
                )}
              </ul>
            </div>
          </div>
          <p
            className={`mt-2 rounded-lg p-2 text-sm font-semibold ${
              preview.verdict === "cannot_win" ? "bg-ember-500 text-white" : preview.verdict === "beats_visible" ? "bg-moss-300 text-bark-900" : "bg-gold-300 text-bark-900"
            }`}
            data-testid="raid-verdict"
          >
            {target.kind === "location" && preview.visibleMin === 0
              ? "Nobody is gathering there right now. If it stays empty, the ambush finds nothing (no penalty)."
              : preview.verdict === "cannot_win"
                ? `Cannot succeed: attack ${preview.attack} must be greater than the known defense ${preview.visibleMin}. Add cards or mercenaries, or pick another target.`
                : preview.verdict === "beats_visible"
                  ? `Beats all known defense (${preview.attack} > ${preview.visibleMax}). Hidden defenses could still stop it.`
                  : `Uncertain: ${preview.attack} beats the fort, but the barricade's hidden size decides it (${preview.visibleMin}–${preview.visibleMax}).`}
          </p>
          <p className="mt-1 text-[11px] text-bark-600">A tie fails: attack must be strictly greater than defense. {preview.notes.slice(0, -1).join(" ")}</p>
        </Step>
      )}

      {target && (
        <Step n={target.kind === "player" ? 7 : 6} title="Cost, risk and submit">
          <ul className="text-xs">
            <li>
              Card cost now: <b>{costText(cost) || "nothing"}</b>
              {costText(cost) && <> → you would have {RESOURCE_TYPES.map((t) => `${RESOURCE_ICON[t]}${after[t]}`).join(" ")}</>}
            </li>
            <li>Mercenaries used: +{self.mercenaryBonus}</li>
            <li>{failurePenalty(view, draft)}</li>
            <li>Once submitted the order is final and secret. It resolves when Resolution starts.</li>
          </ul>
          <button className="btn-danger mt-2 w-full py-2.5 text-base" disabled={!!blocker || submitting} onClick={() => setConfirm(true)} data-tour="raid-submit">
            {submitting ? "Submitting…" : "⚔️ Review & submit raid"}
          </button>
          {blocker && <p className="mt-1 text-xs font-semibold text-ember-600">Can't submit yet: {blocker}</p>}
        </Step>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Submit this raid?">
        {target && preview && (
          <div className="space-y-2 text-sm">
            <p>
              <b>Target:</b> {targetLabel(view, target)}
            </p>
            <p>
              <b>Cards:</b> {cards.map((c) => CARDS[c.cardId].name).join(" + ") || "none"} · <b>Mercenaries:</b> +{self.mercenaryBonus}
            </p>
            <p>
              <b>Attack:</b> {preview.attack} vs known defense {preview.visibleMin === preview.visibleMax ? preview.visibleMin : `${preview.visibleMin}–${preview.visibleMax}`} + hidden
            </p>
            <p>
              <b>You pay now:</b> {costText(cost) || "nothing"}. {failurePenalty(view, draft)}
            </p>
            {preview.verdict === "cannot_win" && target.kind === "player" && <p className="font-bold text-ember-600">Warning: this raid cannot beat the known defense.</p>}
            <p className="text-xs text-bark-600">The order cannot be changed after submitting{me.clan === "foxfire" && !self.abilityUsed ? " (except once with Change of Heart)" : ""}.</p>
            <div className="flex gap-2">
              <button className="btn-plain flex-1" onClick={() => setConfirm(false)}>
                Keep editing
              </button>
              <button className="btn-danger flex-1" onClick={submit}>
                Submit raid
              </button>
            </div>
          </div>
        )}
      </Sheet>
      {!target && <p className="text-xs text-bark-600">Tip: tap a stronghold or contested site on the map and choose “Plan raid”.</p>}
    </div>
  );
}

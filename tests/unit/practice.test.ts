import { describe, expect, it } from "vitest";
import { CARD_IDS } from "@clan-chaos/shared";
import { DEFAULT_CONFIG } from "@clan-chaos/game-content";
import { BOT, PracticeMatch, TUTORIAL_HAND, YOU, seedHand } from "../../apps/web/lib/practice/match";
import { runTutorialAction } from "../../apps/web/lib/practice/controller";
import { TUTORIAL_STEPS, suggestedSite, type TutorialCtx, type TutorialSignal } from "../../apps/web/lib/practice/tutorial";
import { emptyDraft, type RaidDraft } from "../../apps/web/lib/raidPlan";

const T0 = 1_700_000_000_000;
const step = (id: string) => TUTORIAL_STEPS.find((s) => s.id === id)!;

describe("practice match", () => {
  it("runs the real engine with the player, a bot and the seeded tutorial hand", () => {
    const m = new PracticeMatch({ name: "Ada", now: T0 });
    const v = m.view();
    expect(v.youId).toBe(YOU);
    expect(v.players.map((p) => p.name).sort()).toEqual(["Ada", "Training Dummy"]);
    expect(v.self!.hand.map((c) => c.cardId)).toEqual(TUTORIAL_HAND);
    // Cards are swapped, never created: the deck plus all hands still holds every copy exactly.
    const all = [...m.state.deck, ...Object.values(m.state.players).flatMap((p) => p.hand)];
    expect(all).toHaveLength(CARD_IDS.length * DEFAULT_CONFIG.deckCopies);
    expect(new Set(all.map((c) => c.uid)).size).toBe(all.length);
  });

  it("seedHand keeps cards already in hand and conserves the deck", () => {
    const m = new PracticeMatch({ name: "Ada", now: T0 });
    const p = m.state.players[YOU]!;
    const before = [...m.state.deck, ...p.hand].map((c) => c.uid).sort();
    seedHand(m.state, YOU, ["booby_trap", "sneaky_heist", "eagle_eye_scout"]);
    expect(p.hand.map((c) => c.cardId)).toEqual(["booby_trap", "sneaky_heist", "eagle_eye_scout"]);
    expect([...m.state.deck, ...p.hand].map((c) => c.uid).sort()).toEqual(before);
  });

  it("time is virtual: nothing moves until advanced", () => {
    const m = new PracticeMatch({ name: "Ada", now: T0 });
    const ends = m.state.phaseEndsAt;
    expect(m.view().phase).toBe("build");
    m.advance(ends - T0 - 1000);
    expect(m.view().phase).toBe("build");
    m.skipPhase();
    expect(m.view().phase).toBe("scheme");
  });

  it("the bot only acts through legal commands and raids in round 1, failing against a starting fort", () => {
    const m = new PracticeMatch({ name: "Ada", now: T0 });
    m.advance(1000);
    expect(Object.values(m.state.parties).filter((p) => p.ownerId === BOT && p.status !== "idle")).toHaveLength(2);
    m.skipPhase(); // -> scheme: the bot commits its scripted raid
    expect(m.state.raids[BOT]?.target).toEqual({ kind: "player", playerId: YOU });
    m.skipPhase(); // -> resolution
    const r = m.view().resolutions.find((x) => x.attackerId === BOT)!;
    expect(r.success).toBe(false);
    expect(r.goldLost).toBe(DEFAULT_CONFIG.failedRaidGoldPenalty);
  });

  it("a full practice match can be played to the end against the bot", () => {
    const m = new PracticeMatch({ name: "Ada", now: T0, seed: "full" });
    for (let i = 0; i < 40 && m.state.phase !== "ended"; i++) m.skipPhase();
    expect(m.view().phase).toBe("ended");
    expect(m.view().results?.standings).toHaveLength(2);
  });
});

describe("guided tutorial", () => {
  it("each step completes from real engine state when the player follows it", () => {
    const m = new PracticeMatch({ name: "Ada", now: T0 });
    const signals = new Set<TutorialSignal>();
    let draft: RaidDraft = emptyDraft();
    const ctx = (): TutorialCtx => ({ view: m.view(), signals, draft });
    const done = (id: string) => step(id).done?.(ctx()) ?? true;

    expect(done("send-party")).toBe(false);
    const site = suggestedSite(m.view());
    expect(m.send({ type: "gather", partyId: `${YOU}-p1`, locationId: site.id })).toEqual({ ok: true });
    expect(done("send-party")).toBe(true);

    expect(done("collect")).toBe(false);
    const res = runTutorialAction(m, "fastForwardDelivery");
    if (res.signal) signals.add(res.signal);
    expect(m.view().phase).toBe("build");
    expect(step("collect").success!(ctx())).toMatch(/A party delivered \d+ gold from/);

    expect(done("card")).toBe(false);
    signals.add("card-details");
    expect(done("card")).toBe(true);

    expect(done("to-scheme")).toBe(false);
    runTutorialAction(m, "skipToScheme");
    expect(m.view().phase).toBe("scheme");
    expect(done("to-scheme")).toBe(true);

    expect(done("raid-target")).toBe(false);
    draft = { ...draft, target: { kind: "player", playerId: BOT } };
    expect(done("raid-target")).toBe(true);

    // Base attack alone cannot beat a starting fort; Sneaky Heist ties (fails); mercenaries make it win.
    expect(done("preview")).toBe(false);
    expect(step("preview").body(ctx())).toMatch(/would fail/);
    const heist = m.view().self!.hand.find((c) => c.cardId === "sneaky_heist")!;
    draft = { ...draft, primaryUid: heist.uid };
    expect(done("preview")).toBe(false);
    expect(m.send({ type: "recruitMercenaries" })).toEqual({ ok: true });
    expect(done("preview")).toBe(true);

    expect(done("submit")).toBe(false);
    expect(m.send({ type: "commitRaid", target: draft.target!, primaryCardUid: heist.uid, priority: "gold" })).toEqual({ ok: true });
    expect(done("submit")).toBe(true);

    runTutorialAction(m, "skipToDeadline");
    expect(done("deadline")).toBe(true);
    const story = step("resolution").body(ctx());
    expect(story).toMatch(/Ada → Training Dummy: Success/);
    expect(story).toMatch(/Training Dummy → Ada: Repelled/);

    expect(done("upkeep")).toBe(false);
    runTutorialAction(m, "finishRound");
    expect(done("upkeep")).toBe(true);
    expect(m.view().round).toBe(2);
    expect(step("upkeep").success!(ctx())).toMatch(/Upkeep: you paid 1 food/);
    expect(m.view().players.find((p) => p.id === YOU)!.score).toBeGreaterThan(0);
  });

  it("every step has text and the helper buttons never break the match when pressed out of order", () => {
    const m = new PracticeMatch({ name: "Ada", now: T0 });
    for (const s of TUTORIAL_STEPS) {
      const c: TutorialCtx = { view: m.view(), signals: new Set(), draft: null };
      expect(s.body(c).length).toBeGreaterThan(20);
      if (s.task) expect(s.task(c).length).toBeGreaterThan(10);
      if (s.action) runTutorialAction(m, s.action.kind);
    }
    expect(m.view().round).toBeGreaterThanOrEqual(2);
  });
});

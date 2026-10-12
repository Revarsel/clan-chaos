import { describe, expect, it } from "vitest";
import { CARD_IDS, type PlayerView } from "@clan-chaos/shared";
import { buildPlayerView, tick } from "@clan-chaos/game-engine";
import { phaseInfo } from "../../apps/web/lib/phaseInfo";
import { cardAvailability, economyAvailability, phaseReason, scoutAvailability, acceptTradeAvailability } from "../../apps/web/lib/availability";
import { describeCard } from "../../apps/web/lib/cardInfo";
import { feedItems } from "../../apps/web/lib/feed";
import { cardOptions, draftPreview, emptyDraft, raidStatus, sanitizeDraft, submitBlocker, type RaidDraft } from "../../apps/web/lib/raidPlan";
import { explainRaid, personalSummary } from "../../apps/web/lib/resolutionText";
import { objectives } from "../../apps/web/lib/objective";
import { cmd, giveCard, makeMatch, player, setRes, toResolution, toScheme } from "../helpers";

const view = (s: ReturnType<typeof makeMatch>, id = "p1", now = s.phaseStartedAt + 1): PlayerView => buildPlayerView(s, id, now);

describe("phase indicator", () => {
  it("explains each phase from the server phase and deadline", () => {
    const s = makeMatch();
    let info = phaseInfo(view(s));
    expect(info.name).toBe("Build & Gather");
    expect(info.sentence).toBe("Collect resources and prepare your clan.");
    expect(info.deadlineAt).toBe(s.phaseEndsAt);
    expect(info.availableNow).toContain("Gather & recall parties");
    expect(info.notYet).toEqual(["Submit your raid"]);
    toScheme(s);
    info = phaseInfo(view(s));
    expect(info.sentence).toBe("Prepare your strategy and submit secret orders.");
    expect(info.availableNow).toContain("Submit your raid");
    expect(info.notYet).toEqual([]);
    tick(s, s.phaseEndsAt);
    info = phaseInfo(view(s));
    expect(info.sentence).toBe("Raids are being resolved.");
    expect(info.availableNow).toEqual([]);
    expect(info.deadlineLabel).toContain("Round 2 begins");
  });
});

describe("availability reasons", () => {
  it("explains phase, cost and limit blocks with real numbers", () => {
    const s = makeMatch(["toads", "rats"]);
    const now = s.phaseStartedAt + 1;
    expect(phaseReason(view(s), "commitRaid", now)).toMatch(/Only during Scheme & Commit \(opens in \d+s\)/);
    expect(economyAvailability(view(s), "repairFort", now)).toEqual({ ok: false, reason: "Your fort is already fully repaired (7/7)." });
    setRes(s, "p1", 1, 0, 0);
    expect(economyAvailability(view(s), "recruitMercenaries", now)).toEqual({
      ok: false,
      reason: "Needs 2 more gold and 2 more food. Get more by gathering at gold mines or farms, the market (Actions) or a trade.",
    });
    setRes(s, "p1", 50, 0, 0);
    for (let i = 0; i < 4; i++) cmd(s, "p1", { type: "buyCard" });
    expect(economyAvailability(view(s), "buyCard", now)).toEqual({ ok: false, reason: "Your hand is full (7/7). Play or commit a card first." });
    cmd(s, "p1", { type: "scout", targetPlayerId: "p2" });
    expect(scoutAvailability(view(s), "p2", now).ok).toBe(false);
    toScheme(s);
    tick(s, s.phaseEndsAt);
    expect(phaseReason(view(s), "buyCard", s.phaseStartedAt + 1)).toMatch(/^Orders are locked during Resolution\. You can act again/);
  });

  it("explains why cards cannot be used, including the defense limit", () => {
    const s = makeMatch(["rats", "rats"]);
    const now = s.phaseStartedAt + 1;
    const heist = { uid: giveCard(s, "p1", "sneaky_heist"), cardId: "sneaky_heist" as const };
    expect(cardAvailability(view(s), heist, now)).toMatchObject({ ok: false });
    setRes(s, "p1", 0, 30, 30);
    const trap = { uid: giveCard(s, "p1", "booby_trap"), cardId: "booby_trap" as const };
    const lmr = { uid: giveCard(s, "p1", "last_minute_reinforcements"), cardId: "last_minute_reinforcements" as const };
    const gates = { uid: giveCard(s, "p1", "reinforced_gates"), cardId: "reinforced_gates" as const };
    expect(cardAvailability(view(s), trap, now)).toEqual({ ok: true });
    cmd(s, "p1", { type: "commitDefense", cardUid: trap.uid });
    cmd(s, "p1", { type: "commitDefense", cardUid: lmr.uid });
    expect(cardAvailability(view(s), gates, now)).toEqual({ ok: false, reason: "Defense limit reached (2/2 this round)." });
    const scout = { uid: giveCard(s, "p1", "eagle_eye_scout"), cardId: "eagle_eye_scout" as const };
    expect(cardAvailability(view(s), scout, now)).toMatchObject({ ok: false, reason: expect.stringMatching(/^Needs 1 more gold\. Get more by gathering at gold mines/) });
  });

  it("checks whether the viewer can afford to accept a trade", () => {
    const s = makeMatch();
    setRes(s, "p1", 1, 0, 0);
    expect(acceptTradeAvailability(view(s), { gold: 3 }, { food: 1 }, s.phaseStartedAt + 1)).toMatchObject({ ok: false });
    expect(acceptTradeAvailability(view(s), { gold: 1 }, { food: 1 }, s.phaseStartedAt + 1)).toEqual({ ok: true });
  });
});

describe("card explanations", () => {
  it("every card states name, effect, cost, timing, target, kind, when it applies and counterplay", () => {
    for (const id of CARD_IDS) {
      const c = describeCard(id);
      for (const field of [c.name, c.effect, c.costLabel, c.timing, c.target, c.kind, c.kindHelp, c.applies, c.counters]) {
        expect(field.length, `${id}`).toBeGreaterThan(0);
      }
      expect(c.limits.length, id).toBeGreaterThan(0);
    }
    expect(describeCard("sneaky_heist").applies).toMatch(/Resolution/);
    expect(describeCard("eagle_eye_scout").applies).toBe("Immediately.");
    expect(describeCard("booby_trap").limits[0]).toMatch(/At most 2 defense cards per round/);
    expect(describeCard("tunnel_rats").limits).toContain("Cannot be used on an ambush of a resource site.");
  });
});

describe("raid planning", () => {
  it("moves from draft to submitted to resolved, with explicit status", () => {
    const s = makeMatch(["rats", "rats"]);
    let d: RaidDraft = { ...emptyDraft(), target: { kind: "player", playerId: "p2" } };
    expect(raidStatus(view(s), emptyDraft(), false).stage).toBe("none");
    expect(raidStatus(view(s), d, false).stage).toBe("draft");
    expect(submitBlocker(view(s), d, s.phaseStartedAt + 1, (n) => phaseReason(view(s), "commitRaid", n))).toMatch(/Only during Scheme/);
    const at = toScheme(s);
    expect(raidStatus(view(s, "p1", at), d, true).stage).toBe("submitting");
    cmd(s, "p1", { type: "commitRaid", target: d.target!, priority: "gold" }, at);
    expect(raidStatus(view(s, "p1", at), d, false).stage).toBe("submitted");
    toResolution(s);
    const st = raidStatus(view(s), d, false);
    expect(st.stage).toBe("resolved");
    expect(st.label).toBe("Resolved: failed");
    d = sanitizeDraft(view(s), d);
    expect(d.target).not.toBeNull();
  });

  it("separates known from hidden defense and flags a raid that cannot win", () => {
    const s = makeMatch(["rats", "rats"]);
    const d = { ...emptyDraft(), target: { kind: "player" as const, playerId: "p2" } };
    const p = draftPreview(view(s), d)!;
    expect(p.attack).toBe(2);
    expect(p.visibleMin).toBe(5);
    expect(p.verdict).toBe("cannot_win");
    expect(p.notes.join(" ")).toMatch(/Secret defense cards/);
    // The preview depends only on public data: a hidden defense card does not change it.
    cmd(s, "p2", { type: "commitDefense", cardUid: giveCard(s, "p2", "reinforced_gates") });
    expect(draftPreview(view(s), d)).toEqual(p);
  });

  it("lists illegal cards with reasons and drops selections that became illegal", () => {
    const s = makeMatch(["rats", "rats"]);
    const heist = giveCard(s, "p1", "sneaky_heist");
    const hit = giveCard(s, "p1", "hit_and_run");
    let d: RaidDraft = { ...emptyDraft(), target: { kind: "player", playerId: "p2" }, primaryUid: heist };
    expect(cardOptions(view(s), d, "primary").find((o) => o.card.uid === hit)?.reason).toBe("Support slot only");
    d = { ...d, target: { kind: "location", locationId: "thornwood" } };
    expect(cardOptions(view(s), d, "primary").find((o) => o.card.uid === heist)?.reason).toBe("Strongholds only, not ambushes");
    expect(sanitizeDraft(view(s), d).primaryUid).toBeNull();
  });

  it("explains a resolved raid and summarises it for the people involved", () => {
    const s = makeMatch(["rats", "rats", "rats"]);
    player(s, "p2").fortDefense = 1;
    const at = toScheme(s);
    cmd(s, "p1", { type: "commitRaid", target: { kind: "player", playerId: "p2" }, priority: "gold" }, at);
    toResolution(s);
    const v = view(s, "p3");
    const e = explainRaid(v, v.resolutions[0]!);
    expect(e.outcome).toBe("Success");
    expect(e.why).toBe("Attack 2 is greater than defense 1, so the raid succeeded.");
    expect(e.changes.join(" ")).toMatch(/stole 6 gold/);
    expect(personalSummary(view(s, "p1"))[0]).toMatch(/^Your raid on Player2 succeeded/);
    expect(personalSummary(view(s, "p2"))[0]).toMatch(/^Player1 raided you and stole 6 gold; your fort lost 1/);
    expect(personalSummary(view(s, "p3"))).toEqual(["No raid involved you this round."]);
  });
});

describe("action feed and objectives", () => {
  it("builds feed rows with who, what changed, why and points, keeping private rows marked", () => {
    const s = makeMatch(["rats", "rats"]);
    cmd(s, "p1", { type: "buildBarricade" });
    const rows = feedItems(view(s));
    const row = rows.find((r) => r.text.startsWith("You built a barricade"))!;
    expect(row.category).toBe("build");
    expect(row.delta).toEqual({ materials: -3 });
    expect(row.private).toBe(true);
    expect(row.actors.map((a) => a.name)).toEqual(["Player1"]);
    expect(feedItems(view(s, "p2")).some((r) => r.text.startsWith("You built"))).toBe(false);
  });

  it("suggests only relevant, state-based objectives", () => {
    const s = makeMatch(["rats", "rats"]);
    let ids = objectives(view(s), s.phaseStartedAt + 1).map((o) => o.id);
    expect(ids).toContain("gather");
    expect(ids).not.toContain("raid");
    const at = toScheme(s);
    expect(objectives(view(s, "p1", at), at).find((o) => o.id === "raid")?.done).toBeFalsy();
    cmd(s, "p1", { type: "commitRaid", target: { kind: "player", playerId: "p2" }, priority: "gold" }, at);
    expect(objectives(view(s, "p1", at), at).find((o) => o.id === "raid")?.done).toBe(true);
    cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "sunny_acres" }, at);
    cmd(s, "p1", { type: "gather", partyId: "p1-p2", locationId: "sunny_acres" }, at);
    ids = objectives(view(s, "p1", at), at).map((o) => o.id);
    expect(ids).not.toContain("gather");
  });
});

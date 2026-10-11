import { describe, expect, it } from "vitest";
import { buildPlayerView, computeResults, endMatch, tick } from "@clan-chaos/game-engine";
import { cmd, giveCard, makeMatch, player, setRes, toNextRound, toResolution, toScheme } from "../helpers";

describe("clan abilities", () => {
  it("Rats: once per match, take 2 gold from each rival with 5+ gold", () => {
    const s = makeMatch(["rats", "toads", "mushrooms"]);
    setRes(s, "p3", 4, 0, 0);
    expect(cmd(s, "p1", { type: "useClanAbility" }).ok).toBe(true);
    expect(player(s, "p1").resources.gold).toBe(12);
    expect(player(s, "p2").resources.gold).toBe(8);
    expect(player(s, "p3").resources.gold).toBe(4);
    expect(cmd(s, "p1", { type: "useClanAbility" }).code).toBe("LIMIT");
    expect(cmd(s, "p2", { type: "useClanAbility" }).code).toBe("INVALID");
  });

  it("Iron Toads: fort starts at 7 and never exceeds 7", () => {
    const s = makeMatch(["toads", "rats"]);
    expect(player(s, "p1").fortDefense).toBe(7);
    expect(cmd(s, "p1", { type: "clanGrowth" }).code).toBe("LIMIT");
  });

  it("Mushroom Merchants: first card each round costs 2", () => {
    const s = makeMatch(["mushrooms", "rats"]);
    cmd(s, "p1", { type: "buyCard" });
    expect(player(s, "p1").resources.gold).toBe(8);
    cmd(s, "p1", { type: "buyCard" });
    expect(player(s, "p1").resources.gold).toBe(4);
    toNextRound(s);
    cmd(s, "p1", { type: "buyCard" });
    expect(player(s, "p1").resources.gold).toBe(2);
  });

  it("Foxfire Bandits: change a committed target once, for free, before the lock", () => {
    const s = makeMatch(["foxfire", "rats", "toads"]);
    expect(cmd(s, "p1", { type: "foxfireRetarget", target: { kind: "player", playerId: "p3" } }).code).toBe("WRONG_PHASE");
    const at = toScheme(s);
    expect(cmd(s, "p1", { type: "foxfireRetarget", target: { kind: "player", playerId: "p3" } }, at).code).toBe("INVALID");
    cmd(s, "p1", { type: "commitRaid", target: { kind: "player", playerId: "p2" }, priority: "gold" }, at);
    const gold = player(s, "p1").resources.gold;
    expect(cmd(s, "p1", { type: "foxfireRetarget", target: { kind: "player", playerId: "p3" } }, at).ok).toBe(true);
    expect(player(s, "p1").resources.gold).toBe(gold);
    expect(cmd(s, "p1", { type: "foxfireRetarget", target: { kind: "player", playerId: "p2" } }, at).code).toBe("LIMIT");
    expect(cmd(s, "p2", { type: "foxfireRetarget", target: { kind: "player", playerId: "p3" } }, at).code).toBe("INVALID");
    toResolution(s);
    expect(s.resolutions[0]!.defenderId).toBe("p3");
  });
});

describe("match flow and events", () => {
  it("runs 8 rounds of build/scheme/resolution and ends", () => {
    const s = makeMatch(["rats", "toads"]);
    const phases: string[] = [];
    for (let i = 0; i < 30 && s.phase !== "ended"; i++) {
      phases.push(`${s.round}:${s.phase}`);
      tick(s, s.phaseEndsAt);
    }
    expect(phases.slice(0, 4)).toEqual(["1:build", "1:scheme", "1:resolution", "2:build"]);
    expect(phases).toHaveLength(24);
    expect(s.phase).toBe("ended");
    expect(s.results).not.toBeNull();
  });

  it("nominal duration is ten minutes with default timings", () => {
    const s = makeMatch();
    const start = s.phaseStartedAt;
    while (s.phase !== "ended") tick(s, s.phaseEndsAt);
    expect(s.phaseEndsAt - start).toBe(8 * 75_000);
  });

  it("announces events at the end of rounds 3, 5, 7 and activates them next round", () => {
    const s = makeMatch(["rats", "toads"]);
    const seen: string[] = [];
    while (s.phase !== "ended") {
      if (s.phase === "resolution" && s.pendingEvent) seen.push(`announce@${s.round}`);
      if (s.phase === "build" && s.activeEvent && s.activeEvent.startRound === s.round) seen.push(`active@${s.round}`);
      tick(s, s.phaseEndsAt);
    }
    expect(seen).toEqual(["announce@3", "active@4", "announce@5", "active@6", "announce@7", "active@8"]);
  });

  it("Fort Inspection awards 2 points once to max forts", () => {
    const s = makeMatch(["toads", "rats"]);
    s.eventQueue = ["fort_inspection"];
    s.round = 3;
    toNextRound(s);
    expect(s.activeEvent?.id).toBe("fort_inspection");
    expect(player(s, "p1").score).toBe(2);
    expect(player(s, "p2").score).toBe(0);
    tick(s, s.phaseStartedAt + 5);
    tick(s, s.phaseStartedAt + 5);
    expect(player(s, "p1").score).toBe(2);
  });

  it("Goblin Tax takes 2 gold from clans with more than 15", () => {
    const s = makeMatch(["toads", "rats"]);
    s.eventQueue = ["goblin_tax"];
    s.round = 3;
    setRes(s, "p1", 16, 0, 5);
    setRes(s, "p2", 15, 0, 5);
    toNextRound(s);
    expect(player(s, "p1").resources.gold).toBe(14);
    expect(player(s, "p2").resources.gold).toBe(15);
  });

  it("Wandering Merchant sells one card for 2 gold to the first buyer only", () => {
    const s = makeMatch(["toads", "rats"]);
    s.eventQueue = ["wandering_merchant"];
    s.round = 3;
    toNextRound(s);
    expect(s.merchantCard).not.toBeNull();
    expect(buildPlayerView(s, "p1", 0).merchantCard).not.toBeNull();
    expect(cmd(s, "p1", { type: "buyMerchantCard" }).ok).toBe(true);
    expect(player(s, "p1").resources.gold).toBe(8);
    expect(cmd(s, "p2", { type: "buyMerchantCard" }).code).toBe("INVALID");
  });

  it("Bounty Board pays 3 points once for raiding the wealthiest clan", () => {
    const s = makeMatch(["rats", "rats", "rats"]);
    s.eventQueue = ["bounty_board"];
    s.round = 3;
    setRes(s, "p3", 30, 0, 5);
    toNextRound(s);
    expect(s.activeEvent?.wealthiestIds).toEqual(["p3"]);
    player(s, "p3").fortDefense = 0;
    const at = toScheme(s);
    cmd(s, "p1", { type: "commitRaid", target: { kind: "player", playerId: "p3" }, priority: "gold" }, at);
    cmd(s, "p2", { type: "commitRaid", target: { kind: "player", playerId: "p3" }, priority: "gold" }, at);
    toResolution(s);
    const bonus = ["p1", "p2"].map((id) => player(s, id).scoreBreakdown.filter((e) => e.reason.startsWith("Bounty Board")).length);
    expect(bonus.reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe("scoring and tie-breakers", () => {
  it("awards end-of-match points for intact forts and every 5 resources", () => {
    const s = makeMatch(["rats", "rats"]);
    setRes(s, "p1", 14, 5, 4);
    player(s, "p2").fortDefense = 0;
    setRes(s, "p2", 0, 0, 1);
    endMatch(s, s.phaseStartedAt, "rounds_complete");
    expect(player(s, "p1").score).toBe(2 + 2 + 1);
    expect(player(s, "p2").score).toBe(0);
    expect(s.results!.winnerIds).toEqual(["p1"]);
    expect(s.results!.standings[0]!.breakdown.length).toBe(3);
  });

  it("breaks ties by raids, then resources, then fort; else shared victory", () => {
    const s = makeMatch(["rats", "rats", "rats"]);
    for (const id of ["p1", "p2", "p3"]) player(s, id).score = 10;
    player(s, "p2").successfulRaids = 1;
    let r = computeResults(s, "rounds_complete");
    expect(r.winnerIds).toEqual(["p2"]);
    player(s, "p2").successfulRaids = 0;
    setRes(s, "p3", 30, 0, 0);
    r = computeResults(s, "rounds_complete");
    expect(r.winnerIds).toEqual(["p3"]);
    setRes(s, "p3", 10, 6, 6);
    player(s, "p1").fortDefense = 6;
    r = computeResults(s, "rounds_complete");
    expect(r.winnerIds).toEqual(["p1"]);
    player(s, "p1").fortDefense = 5;
    r = computeResults(s, "rounds_complete");
    expect(r.winnerIds.sort()).toEqual(["p1", "p2", "p3"]);
    expect(r.standings.every((x) => x.rank === 1)).toBe(true);
  });

  it("never double-awards the end-of-match bonus", () => {
    const s = makeMatch(["rats", "rats"]);
    endMatch(s, 1, "rounds_complete");
    const score = player(s, "p1").score;
    endMatch(s, 2, "rounds_complete");
    expect(player(s, "p1").score).toBe(score);
  });
});

describe("disconnects and privacy", () => {
  it("marks a disconnected clan inactive after 60s while the match continues", () => {
    const s = makeMatch(["rats", "rats"]);
    player(s, "p1").connected = false;
    player(s, "p1").disconnectedAt = s.phaseStartedAt;
    tick(s, s.phaseStartedAt + 59_000);
    expect(player(s, "p1").inactive).toBe(false);
    tick(s, s.phaseStartedAt + 61_000);
    expect(player(s, "p1").inactive).toBe(true);
    expect(s.round).toBe(2);
  });

  it("player views never include other clans' hands, resources or raid targets", () => {
    const s = makeMatch(["rats", "rats", "rats"]);
    const at = toScheme(s);
    const uid = giveCard(s, "p1", "sneaky_heist");
    cmd(s, "p1", { type: "commitRaid", target: { kind: "player", playerId: "p2" }, priority: "gold", primaryCardUid: uid }, at);
    cmd(s, "p2", { type: "commitDefense", cardUid: giveCard(s, "p2", "reinforced_gates") }, at);
    const v2 = JSON.stringify(buildPlayerView(s, "p2", at));
    const v3 = JSON.stringify(buildPlayerView(s, "p3", at));
    for (const v of [v2, v3]) {
      expect(v).not.toContain("sneaky_heist");
      expect(v).not.toContain(uid);
      for (const c of player(s, "p1").hand) expect(v).not.toContain(c.uid);
    }
    expect(v3).not.toContain("reinforced_gates");
    const view = buildPlayerView(s, "p3", at);
    expect(view.players.find((p) => p.id === "p1")!.hasCommittedRaid).toBe(true);
    expect(view.self!.id).toBe("p3");
    expect(Object.keys(view.players[0]!)).not.toContain("resources");
  });
});

import { describe, expect, it } from "vitest";
import { raidResolutionOrder, tick } from "@clan-chaos/game-engine";
import { cmd, makeMatch, player, setRes, toResolution, toScheme } from "../helpers";

const raid = (s: ReturnType<typeof makeMatch>, from: string, to: string, extra: Record<string, unknown> = {}, now?: number) =>
  cmd(s, from, { type: "commitRaid", target: { kind: "player", playerId: to }, priority: "gold", ...extra }, now);

describe("raid commitment", () => {
  it("only allows raids in the Scheme phase, once per round, never at yourself", () => {
    const s = makeMatch(["rats", "rats", "rats"]);
    expect(raid(s, "p1", "p2").code).toBe("WRONG_PHASE");
    const at = toScheme(s);
    expect(raid(s, "p1", "p1", {}, at).code).toBe("INVALID");
    expect(raid(s, "p1", "p2", {}, at).ok).toBe(true);
    expect(raid(s, "p1", "p3", {}, at).code).toBe("LIMIT");
  });

  it("cannot raid safe locations", () => {
    const s = makeMatch();
    const at = toScheme(s);
    const r = cmd(s, "p1", { type: "commitRaid", target: { kind: "location", locationId: "sunny_acres" }, priority: "food" }, at);
    expect(r.code).toBe("INVALID");
  });

  it("consumes mercenaries into the raid order", () => {
    const s = makeMatch(["rats", "rats"]);
    cmd(s, "p1", { type: "recruitMercenaries" });
    const at = toScheme(s);
    raid(s, "p1", "p2", {}, at);
    expect(player(s, "p1").mercenaryBonus).toBe(0);
    expect(s.raids.p1!.mercenaryBonus).toBe(2);
  });
});

describe("combat resolution", () => {
  it("fails when attack does not strictly exceed defense, costing 2 gold", () => {
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 2;
    const at = toScheme(s);
    raid(s, "p1", "p2", {}, at);
    toResolution(s);
    const v = s.resolutions[0]!;
    expect(v.attackStrength).toBe(2);
    expect(v.defenseStrength).toBe(2);
    expect(v.success).toBe(false);
    expect(player(s, "p1").resources.gold).toBe(8);
    expect(player(s, "p2").fortDefense).toBe(2);
  });

  it("succeeds when attack > defense: steals up to 6 prioritised, 1 fort damage, +2 points", () => {
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 1;
    setRes(s, "p2", 4, 5, 1);
    const at = toScheme(s);
    cmd(s, "p1", { type: "commitRaid", target: { kind: "player", playerId: "p2" }, priority: "gold" }, at);
    toResolution(s);
    const v = s.resolutions[0]!;
    expect(v.success).toBe(true);
    expect(v.stolen).toEqual({ gold: 4, materials: 2 });
    expect(player(s, "p2").resources).toEqual({ gold: 0, materials: 3, food: 1 });
    expect(player(s, "p2").fortDefense).toBe(0);
    // +2 raid, +3 fort destroyed
    expect(player(s, "p1").score).toBe(5);
    expect(v.fortDamage).toBe(1);
  });

  it("an exposed fort contributes no defense", () => {
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 0;
    const at = toScheme(s);
    raid(s, "p1", "p2", {}, at);
    toResolution(s);
    expect(s.resolutions[0]!.defenseStrength).toBe(0);
    expect(s.resolutions[0]!.success).toBe(true);
    expect(player(s, "p1").score).toBe(2); // no fort destruction bonus: already destroyed
  });

  it("barricades add +2 and are used up by a raid", () => {
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 0;
    cmd(s, "p2", { type: "buildBarricade" });
    const at = toScheme(s);
    raid(s, "p1", "p2", {}, at);
    toResolution(s);
    expect(s.resolutions[0]!.defenseStrength).toBe(2);
    expect(s.resolutions[0]!.success).toBe(false);
    expect(player(s, "p2").barricadeDefense).toBe(0);
  });

  it("eliminates a clan with a destroyed fort and no resources", () => {
    const s = makeMatch(["rats", "rats", "rats"]);
    player(s, "p2").fortDefense = 1;
    setRes(s, "p2", 3, 0, 0);
    const at = toScheme(s);
    raid(s, "p1", "p2", {}, at);
    toResolution(s);
    expect(player(s, "p2").eliminated).toBe(true);
    expect(player(s, "p1").score).toBe(2 + 3 + 4);
    expect(cmd(s, "p2", { type: "buyCard" }, s.phaseEndsAt + 10).code).toBe("ELIMINATED");
  });

  it("ends the match immediately when one clan remains", () => {
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 0;
    setRes(s, "p2", 2, 0, 0);
    const at = toScheme(s);
    raid(s, "p1", "p2", {}, at);
    toResolution(s);
    expect(s.phase).toBe("ended");
    expect(s.results!.endedReason).toBe("last_clan_standing");
    expect(s.results!.winnerIds).toEqual(["p1"]);
  });

  it("resolves simultaneous raids sequentially so loot is never stolen twice", () => {
    const s = makeMatch(["rats", "rats", "rats"]);
    player(s, "p3").fortDefense = 0;
    setRes(s, "p3", 8, 0, 0);
    const at = toScheme(s);
    raid(s, "p1", "p3", {}, at);
    raid(s, "p2", "p3", {}, at);
    toResolution(s);
    const total = s.resolutions.reduce((n, v) => n + (v.stolen.gold ?? 0), 0);
    expect(total).toBe(8);
    expect(player(s, "p3").resources.gold).toBe(0);
    expect(player(s, "p1").resources.gold + player(s, "p2").resources.gold).toBe(28);
  });

  it("uses a deterministic order that rotates each round", () => {
    const s = makeMatch(["rats", "rats", "rats"]);
    const at = toScheme(s);
    for (const p of ["p1", "p2", "p3"]) raid(s, p, p === "p1" ? "p2" : "p1", {}, at);
    const order1 = raidResolutionOrder(s);
    expect(order1).toEqual(s.seatOrder);
    s.round = 2;
    expect(raidResolutionOrder(s)).toEqual([...s.seatOrder.slice(1), s.seatOrder[0]]);
  });

  it("raids resolve exactly once even if tick is called repeatedly", () => {
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 0;
    const at = toScheme(s);
    raid(s, "p1", "p2", {}, at);
    toResolution(s);
    const gold = player(s, "p1").resources.gold;
    tick(s, s.phaseStartedAt + 10);
    tick(s, s.phaseStartedAt + 20);
    expect(player(s, "p1").resources.gold).toBe(gold);
    expect(player(s, "p1").successfulRaids).toBe(1);
  });
});

describe("location ambushes", () => {
  it("intercepts enemy parties gathering at a contested site", () => {
    const s = makeMatch(["rats", "rats"]);
    const at = toScheme(s);
    cmd(s, "p2", { type: "gather", partyId: "p2-p1", locationId: "ancient_ruins" }, at);
    const party = s.parties["p2-p1"]!;
    tick(s, party.arriveAt);
    expect(party.status).toBe("gathering");
    cmd(s, "p1", { type: "commitRaid", target: { kind: "location", locationId: "ancient_ruins" }, priority: "gold" }, at + 1);
    // Keep the party working past the deadline: it is exactly half-way done at resolution.
    party.workStartAt = s.phaseEndsAt - 5000;
    party.workEndsAt = s.phaseEndsAt + 5000;
    toResolution(s);
    const v = s.resolutions[0]!;
    expect(v.success).toBe(true);
    expect(party.status).toBe("intercepted");
    const stolen = Object.values(v.stolen).reduce((a, b) => a + (b ?? 0), 0);
    expect(stolen).toBe(2); // half of 4
    expect(player(s, "p1").score).toBe(2);
  });

  it("an empty ambush has no penalty", () => {
    const s = makeMatch(["rats", "rats"]);
    const at = toScheme(s);
    cmd(s, "p1", { type: "commitRaid", target: { kind: "location", locationId: "thornwood" }, priority: "gold" }, at);
    toResolution(s);
    expect(s.resolutions[0]!.success).toBe(false);
    expect(player(s, "p1").resources.gold).toBe(10);
  });
});

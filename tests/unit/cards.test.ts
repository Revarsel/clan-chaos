import { describe, expect, it } from "vitest";
import { CARD_IDS, type CardId } from "@clan-chaos/shared";
import { CARDS } from "@clan-chaos/game-content";
import { tick } from "@clan-chaos/game-engine";
import { cmd, giveCard, makeMatch, player, setRes, toNextRound, toResolution, toScheme } from "../helpers";

type M = ReturnType<typeof makeMatch>;
const covered = new Set<CardId>();
const cover = (id: CardId) => covered.add(id);

function raidWith(s: M, from: string, to: string, primary?: CardId, support?: CardId, extra: Record<string, unknown> = {}) {
  const at = s.phase === "scheme" ? s.phaseStartedAt + 1 : toScheme(s);
  const primaryCardUid = primary ? giveCard(s, from, primary) : undefined;
  const supportCardUid = support ? giveCard(s, from, support) : undefined;
  return cmd(s, from, { type: "commitRaid", target: { kind: "player", playerId: to }, priority: "gold", primaryCardUid, supportCardUid, ...extra }, at);
}

function defend(s: M, who: string, card: CardId) {
  return cmd(s, who, { type: "commitDefense", cardUid: giveCard(s, who, card) });
}

function play(s: M, who: string, card: CardId, extra: Record<string, unknown> = {}) {
  return cmd(s, who, { type: "playCard", cardUid: giveCard(s, who, card), ...extra });
}

describe("card definitions", () => {
  it("has exactly 22 distinct cards with explicit costs, timing and text", () => {
    expect(CARD_IDS).toHaveLength(22);
    for (const id of CARD_IDS) {
      const c = CARDS[id];
      expect(c.id).toBe(id);
      expect(Object.values(c.cost).reduce((a, b) => a + (b ?? 0), 0)).toBeGreaterThan(0);
      expect(["attack", "defense", "instant"]).toContain(c.timing);
      expect(c.text.length).toBeGreaterThan(10);
      if (c.timing === "attack") expect(c.slot).toBeDefined();
      const atk = c.params.attack ?? 0;
      expect(atk).toBeGreaterThanOrEqual(-2);
      expect(atk).toBeLessThanOrEqual(4);
    }
  });
});

describe("attack cards", () => {
  it("Sneaky Heist: +3 attack, 2 gold, steals up to 4 extra gold", () => {
    cover("sneaky_heist");
    const s = makeMatch(["rats", "rats"]);
    setRes(s, "p2", 12, 0, 0);
    expect(raidWith(s, "p1", "p2", "sneaky_heist").ok).toBe(true);
    expect(player(s, "p1").resources.gold).toBe(8);
    toResolution(s);
    const v = s.resolutions[0]!;
    expect(v.attackStrength).toBe(5);
    expect(v.defenseStrength).toBe(5);
    expect(v.success).toBe(false); // 5 vs 5 fails
    const s2 = makeMatch(["rats", "rats"]);
    setRes(s2, "p2", 12, 0, 0);
    player(s2, "p2").fortDefense = 4;
    raidWith(s2, "p1", "p2", "sneaky_heist");
    toResolution(s2);
    expect(s2.resolutions[0]!.success).toBe(true);
    expect(s2.resolutions[0]!.stolen.gold).toBe(10);
    expect(player(s2, "p2").resources.gold).toBe(2);
  });

  it("Smoke and Mirrors: +1 attack and hides target from scouting", () => {
    cover("smoke_and_mirrors");
    const s = makeMatch(["rats", "rats", "rats"]);
    raidWith(s, "p1", "p2", "smoke_and_mirrors");
    cmd(s, "p3", { type: "scout", targetPlayerId: "p1" }, s.phaseStartedAt + 2);
    const intel = s.intel.p3!.at(-1)!.text;
    expect(intel).toContain("hidden in smoke");
    expect(intel).not.toContain("Player2.");
    toResolution(s);
    expect(s.resolutions[0]!.attackStrength).toBe(3);
  });

  it("False Flag: +1 attack, shows a decoy target to scouts until the reveal", () => {
    cover("false_flag");
    const s = makeMatch(["rats", "rats", "rats"]);
    expect(raidWith(s, "p1", "p2", undefined, "false_flag").code).toBe("INVALID"); // decoy required
    const r = raidWith(s, "p1", "p2", undefined, "false_flag", { decoyPlayerId: "p3" });
    expect(r.ok).toBe(true);
    cmd(s, "p2", { type: "scout", targetPlayerId: "p1" }, s.phaseStartedAt + 2);
    expect(s.intel.p2!.at(-1)!.text).toContain("against Player3");
    toResolution(s);
    expect(s.resolutions[0]!.attackStrength).toBe(3);
    expect(s.resolutions[0]!.defenderId).toBe("p2");
  });

  it("Tunnel Rats: ignores up to 3 fort defense", () => {
    cover("tunnel_rats");
    const s = makeMatch(["rats", "rats"]);
    raidWith(s, "p1", "p2", "tunnel_rats");
    toResolution(s);
    const v = s.resolutions[0]!;
    expect(v.attackStrength).toBe(3);
    expect(v.defenseStrength).toBe(2);
    expect(v.success).toBe(true);
  });

  it("Battering Ram: +2 attack, costs 3 materials, 2 extra fort damage", () => {
    cover("battering_ram");
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 3;
    raidWith(s, "p1", "p2", "battering_ram");
    expect(player(s, "p1").resources.materials).toBe(3);
    toResolution(s);
    expect(s.resolutions[0]!.success).toBe(true);
    expect(s.resolutions[0]!.fortDamage).toBe(3);
    expect(player(s, "p2").fortDefense).toBe(0);
  });

  it("Decoy Caravan: strips up to 2 soft defense but not the fort", () => {
    cover("decoy_caravan");
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 1;
    cmd(s, "p2", { type: "buildBarricade" });
    cmd(s, "p1", { type: "recruitMercenaries" });
    raidWith(s, "p1", "p2", undefined, "decoy_caravan");
    toResolution(s);
    const v = s.resolutions[0]!;
    expect(v.defenseStrength).toBe(1); // fort 1 + barricade 2 - 2
    expect(v.attackStrength).toBe(4);
    expect(v.success).toBe(true);
  });

  it("Hit and Run: steals at most 3 and avoids the failure penalty", () => {
    cover("hit_and_run");
    const s = makeMatch(["rats", "rats"]);
    raidWith(s, "p1", "p2", undefined, "hit_and_run");
    toResolution(s);
    expect(s.resolutions[0]!.success).toBe(false);
    expect(player(s, "p1").resources.gold).toBe(9); // only the card cost
    const s2 = makeMatch(["rats", "rats"]);
    player(s2, "p2").fortDefense = 0;
    raidWith(s2, "p1", "p2", undefined, "hit_and_run");
    toResolution(s2);
    expect(Object.values(s2.resolutions[0]!.stolen).reduce((a, b) => a + (b ?? 0), 0)).toBe(3);
  });

  it("rejects cards in the wrong slot or stronghold-only cards on ambushes", () => {
    const s = makeMatch(["rats", "rats"]);
    expect(raidWith(s, "p1", "p2", "hit_and_run").code).toBe("INVALID");
    const uid = giveCard(s, "p1", "sneaky_heist");
    const r = cmd(s, "p1", { type: "commitRaid", target: { kind: "location", locationId: "thornwood" }, priority: "gold", primaryCardUid: uid }, s.phaseStartedAt + 1);
    expect(r.code).toBe("INVALID");
    expect(raidWith(s, "p1", "p2", "booby_trap").code).toBe("INVALID");
  });
});

describe("defense cards", () => {
  it("Booby Trap: +3 vs first raid; defeated attacker loses 2 more gold", () => {
    cover("booby_trap");
    const s = makeMatch(["rats", "rats", "rats"]);
    player(s, "p2").fortDefense = 0;
    expect(defend(s, "p2", "booby_trap").ok).toBe(true);
    expect(player(s, "p2").resources.materials).toBe(4);
    raidWith(s, "p1", "p2");
    raidWith(s, "p3", "p2");
    toResolution(s);
    const [first, second] = s.resolutions;
    expect(first!.defenseStrength).toBe(3);
    expect(first!.success).toBe(false);
    expect(first!.goldLost).toBe(4);
    expect(second!.defenseStrength).toBe(0); // trap only works once
    expect(second!.success).toBe(true);
  });

  it("Last-Minute Reinforcements: +2 vs the next incoming raid only", () => {
    cover("last_minute_reinforcements");
    const s = makeMatch(["rats", "rats", "rats"]);
    player(s, "p2").fortDefense = 1;
    expect(defend(s, "p2", "last_minute_reinforcements").ok).toBe(true);
    expect(player(s, "p2").resources.food).toBe(3);
    raidWith(s, "p1", "p2");
    raidWith(s, "p3", "p2");
    toResolution(s);
    expect(s.resolutions[0]!.defenseStrength).toBe(3);
    expect(s.resolutions[1]!.defenseStrength).toBe(1);
    expect(player(s, "p2").reinforcementDefense).toBe(0);
  });

  it("Last-Minute Reinforcements cannot be committed after the deadline", () => {
    const s = makeMatch(["rats", "rats"]);
    toResolution(s);
    const uid = giveCard(s, "p2", "last_minute_reinforcements");
    expect(cmd(s, "p2", { type: "commitDefense", cardUid: uid }, s.phaseStartedAt + 1).code).toBe("WRONG_PHASE");
  });

  it("Reinforced Gates: +2 vs every raid this round", () => {
    cover("reinforced_gates");
    const s = makeMatch(["rats", "rats", "rats"]);
    player(s, "p2").fortDefense = 0;
    defend(s, "p2", "reinforced_gates");
    raidWith(s, "p1", "p2");
    raidWith(s, "p3", "p2");
    toResolution(s);
    expect(s.resolutions.map((v) => v.defenseStrength)).toEqual([2, 2]);
  });

  it("Counter-Ambush: -3 to strong raids (-1 otherwise), halves plunder and prevents fort damage", () => {
    cover("counter_ambush");
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 1;
    setRes(s, "p2", 20, 0, 0);
    defend(s, "p2", "counter_ambush");
    setRes(s, "p1", 30, 0, 30);
    cmd(s, "p1", { type: "recruitMercenaries" });
    cmd(s, "p1", { type: "recruitMercenaries" });
    raidWith(s, "p1", "p2"); // attack 6
    toResolution(s);
    const v = s.resolutions[0]!;
    expect(v.attackStrength).toBe(3);
    expect(v.success).toBe(true);
    expect(v.stolen.gold).toBe(3);
    expect(v.fortDamage).toBe(0);
    const s2 = makeMatch(["rats", "rats"]);
    defend(s2, "p2", "counter_ambush");
    raidWith(s2, "p1", "p2");
    toResolution(s2);
    expect(s2.resolutions[0]!.attackStrength).toBe(1);
  });

  it("Decoy Vault: successful raids steal 3 fewer units", () => {
    cover("decoy_vault");
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 0;
    defend(s, "p2", "decoy_vault");
    raidWith(s, "p1", "p2");
    toResolution(s);
    expect(Object.values(s.resolutions[0]!.stolen).reduce((a, b) => a + (b ?? 0), 0)).toBe(3);
  });

  it("limits defense cards per round and forbids duplicates", () => {
    const s = makeMatch(["rats", "rats"]);
    setRes(s, "p2", 20, 20, 20);
    expect(defend(s, "p2", "reinforced_gates").ok).toBe(true);
    expect(defend(s, "p2", "reinforced_gates").code).toBe("LIMIT");
    expect(defend(s, "p2", "decoy_vault").ok).toBe(true);
    expect(defend(s, "p2", "booby_trap").code).toBe("LIMIT");
  });

  it("Emergency Evacuation: up to 8 units are unstealable and return after upkeep", () => {
    cover("emergency_evacuation");
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 0;
    setRes(s, "p2", 6, 0, 4);
    expect(play(s, "p2", "emergency_evacuation", { evacuate: { gold: 9 } }).code).toBe("LIMIT");
    expect(play(s, "p2", "emergency_evacuation", { evacuate: { gold: 6 } }).ok).toBe(true);
    expect(player(s, "p2").resources).toEqual({ gold: 0, materials: 0, food: 2 });
    raidWith(s, "p1", "p2");
    toResolution(s);
    expect(s.resolutions[0]!.stolen).toEqual({ food: 2 });
    toNextRound(s);
    expect(player(s, "p2").resources.gold).toBe(6);
    expect(player(s, "p2").safeReserve.gold).toBe(0);
    expect(player(s, "p2").eliminated).toBe(false);
  });
});

describe("reconnaissance cards", () => {
  it("Eagle-Eye Scout reveals true raid cards and target", () => {
    cover("eagle_eye_scout");
    const s = makeMatch(["rats", "rats", "rats"]);
    raidWith(s, "p1", "p2", "smoke_and_mirrors", "false_flag", { decoyPlayerId: "p3" });
    expect(play(s, "p2", "eagle_eye_scout", { targetPlayerId: "p1" }).ok).toBe(true);
    const text = s.intel.p2!.at(-1)!.text;
    expect(text).toContain("raiding Player2");
    expect(text).toContain("Smoke and Mirrors");
    expect(text).toContain("False Flag");
    expect(s.intel.p3).toHaveLength(0);
  });

  it("Counter-Intel blocks scouting and Eagle-Eye for this round and next", () => {
    cover("counter_intel");
    const s = makeMatch(["rats", "rats"]);
    expect(play(s, "p1", "counter_intel").ok).toBe(true);
    cmd(s, "p2", { type: "scout", targetPlayerId: "p1" });
    expect(s.intel.p2!.at(-1)!.text).toContain("Counter-Intel");
    expect(player(s, "p2").resources.gold).toBe(8);
    toNextRound(s);
    play(s, "p2", "eagle_eye_scout", { targetPlayerId: "p1" });
    expect(s.intel.p2!.at(-1)!.text).toContain("Counter-Intel");
    toNextRound(s);
    cmd(s, "p2", { type: "scout", targetPlayerId: "p1" });
    expect(s.intel.p2!.at(-1)!.text).toContain("fort");
  });

  it("Trail Markers reveals stock and adds +1 yield there", () => {
    cover("trail_markers");
    const s = makeMatch(["rats", "rats"]);
    expect(play(s, "p1", "trail_markers", { locationId: "trading_post" }).code).toBe("INVALID");
    expect(play(s, "p1", "trail_markers", { locationId: "sunny_acres" }).ok).toBe(true);
    cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "sunny_acres" });
    tick(s, s.parties["p1-p1"]!.arriveAt);
    expect(s.parties["p1-p1"]!.reserved).toBe(4);
  });
});

describe("economy cards", () => {
  it("Merchant Caravan improves the market to 2:1", () => {
    cover("merchant_caravan");
    const s = makeMatch(["rats", "rats"]);
    play(s, "p1", "merchant_caravan");
    expect(cmd(s, "p1", { type: "marketExchange", give: "gold", get: "food", amount: 4 }).ok).toBe(true);
    expect(player(s, "p1").resources).toMatchObject({ gold: 1, food: 10 });
  });

  it("Resource Rush adds +2 yield and +2 capacity at a site", () => {
    cover("resource_rush");
    const s = makeMatch(["rats", "rats"]);
    play(s, "p1", "resource_rush", { locationId: "dragons_teeth" });
    cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "dragons_teeth" });
    tick(s, s.parties["p1-p1"]!.arriveAt);
    expect(s.parties["p1-p1"]!.reserved).toBe(7);
  });

  it("Sabotage Supplies reduces a rival's yields by 2 (min 1)", () => {
    cover("sabotage_supplies");
    const s = makeMatch(["rats", "rats"]);
    expect(play(s, "p1", "sabotage_supplies", { targetPlayerId: "p1" }).code).toBe("INVALID");
    play(s, "p1", "sabotage_supplies", { targetPlayerId: "p2" });
    cmd(s, "p2", { type: "gather", partyId: "p2-p1", locationId: "glimmer_hollow" });
    tick(s, s.parties["p2-p1"]!.arriveAt);
    expect(s.parties["p2-p1"]!.reserved).toBe(1);
  });

  it("Emergency Rations gives 2 food and skips next upkeep", () => {
    cover("emergency_rations");
    const s = makeMatch(["rats", "rats"]);
    play(s, "p1", "emergency_rations");
    expect(player(s, "p1").resources.food).toBe(8);
    toNextRound(s);
    expect(player(s, "p1").resources.food).toBe(8);
    toNextRound(s);
    expect(player(s, "p1").resources.food).toBe(7);
  });
});

describe("politics cards", () => {
  it("Bounty Contract: +2 for a successful raid on the nominee", () => {
    cover("bounty_contract");
    const s = makeMatch(["rats", "rats"]);
    play(s, "p1", "bounty_contract", { targetPlayerId: "p2" });
    player(s, "p2").fortDefense = 0;
    setRes(s, "p2", 10, 0, 0);
    raidWith(s, "p1", "p2");
    toResolution(s);
    expect(player(s, "p1").score).toBe(4);
    expect(player(s, "p1").effects.bounty).toBeNull();
  });

  it("Unstable Truce: accepted and honoured gives both +2; betrayal forfeits", () => {
    cover("unstable_truce");
    const s = makeMatch(["rats", "rats", "rats"]);
    expect(play(s, "p1", "unstable_truce", { targetPlayerId: "p2" }).ok).toBe(true);
    expect(cmd(s, "p2", { type: "truceRespond", accept: true }).ok).toBe(true);
    expect(s.truces).toHaveLength(1);
    toNextRound(s);
    raidWith(s, "p2", "p1"); // p2 betrays
    toNextRound(s);
    expect(player(s, "p1").scoreBreakdown.some((e) => e.reason.includes("Truce"))).toBe(true);
    expect(player(s, "p2").scoreBreakdown.some((e) => e.reason.includes("Truce"))).toBe(false);
    expect(s.truces).toHaveLength(0);
  });

  it("a truce can be refused", () => {
    const s = makeMatch(["rats", "rats"]);
    play(s, "p1", "unstable_truce", { targetPlayerId: "p2" });
    expect(cmd(s, "p2", { type: "truceRespond", accept: false }).ok).toBe(true);
    expect(s.truces).toHaveLength(0);
    expect(cmd(s, "p2", { type: "truceRespond", accept: true }).code).toBe("NOT_FOUND");
  });
});

describe("coverage", () => {
  it("every one of the 22 cards has a behavioural test", () => {
    expect([...CARD_IDS].filter((c) => !covered.has(c))).toEqual([]);
  });
});

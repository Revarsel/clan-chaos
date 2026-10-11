import { describe, expect, it } from "vitest";
import { applyCommand, tick } from "@clan-chaos/game-engine";
import { cmd, makeMatch, player, setRes, toNextRound, toScheme, T0 } from "../helpers";

describe("starting conditions", () => {
  it("gives every clan the approved starting kit", () => {
    const s = makeMatch(["rats", "mushrooms", "foxfire"]);
    for (const p of Object.values(s.players)) {
      expect(p.resources).toEqual({ gold: 10, materials: 6, food: 6 });
      expect(p.fortDefense).toBe(5);
      expect(p.hand).toHaveLength(3);
      expect(Object.values(s.parties).filter((x) => x.ownerId === p.id)).toHaveLength(2);
    }
    expect(s.deck.length + 9).toBe(44);
  });

  it("Iron Toads start at fort 7 (the cap)", () => {
    const s = makeMatch(["toads", "rats"]);
    expect(player(s, "p1").fortDefense).toBe(7);
    expect(player(s, "p1").fortLevel).toBe(7);
  });
});

describe("economy actions", () => {
  it("buys a card for 4 gold and respects hand size", () => {
    const s = makeMatch(["rats", "toads"]);
    expect(cmd(s, "p1", { type: "buyCard" }).ok).toBe(true);
    expect(player(s, "p1").resources.gold).toBe(6);
    expect(player(s, "p1").hand).toHaveLength(4);
    setRes(s, "p1", 50, 0, 0);
    for (let i = 0; i < 3; i++) expect(cmd(s, "p1", { type: "buyCard" }).ok).toBe(true);
    const r = cmd(s, "p1", { type: "buyCard" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("LIMIT");
    expect(player(s, "p1").hand).toHaveLength(7);
  });

  it("recruits mercenaries for 3 gold + 2 food, capped", () => {
    const s = makeMatch();
    expect(cmd(s, "p1", { type: "recruitMercenaries" }).ok).toBe(true);
    expect(player(s, "p1").resources).toMatchObject({ gold: 7, food: 4 });
    expect(player(s, "p1").mercenaryBonus).toBe(2);
    setRes(s, "p1", 50, 0, 50);
    cmd(s, "p1", { type: "recruitMercenaries" });
    cmd(s, "p1", { type: "recruitMercenaries" });
    expect(cmd(s, "p1", { type: "recruitMercenaries" }).code).toBe("LIMIT");
    expect(player(s, "p1").mercenaryBonus).toBe(6);
  });

  it("builds barricades (+2, max +4) for 3 materials", () => {
    const s = makeMatch();
    expect(cmd(s, "p1", { type: "buildBarricade" }).ok).toBe(true);
    expect(player(s, "p1").barricadeDefense).toBe(2);
    expect(player(s, "p1").resources.materials).toBe(3);
    setRes(s, "p1", 0, 20, 0);
    cmd(s, "p1", { type: "buildBarricade" });
    expect(cmd(s, "p1", { type: "buildBarricade" }).code).toBe("LIMIT");
  });

  it("repairs the fort by 2 up to its level, and growth raises the level to max 7", () => {
    const s = makeMatch(["rats", "rats"]);
    expect(cmd(s, "p1", { type: "repairFort" }).code).toBe("LIMIT");
    const p = player(s, "p1");
    p.fortDefense = 2;
    expect(cmd(s, "p1", { type: "repairFort" }).ok).toBe(true);
    expect(p.fortDefense).toBe(4);
    expect(p.resources.materials).toBe(4);
    setRes(s, "p1", 0, 10, 30);
    expect(cmd(s, "p1", { type: "clanGrowth" }).ok).toBe(true);
    expect(p.fortLevel).toBe(6);
    expect(p.fortDefense).toBe(5);
    expect(p.resources.food).toBe(25);
    cmd(s, "p1", { type: "clanGrowth" });
    expect(p.fortLevel).toBe(7);
    expect(cmd(s, "p1", { type: "clanGrowth" }).code).toBe("LIMIT");
    cmd(s, "p1", { type: "repairFort" });
    expect(p.fortDefense).toBe(7);
  });

  it("rejects actions that would make balances negative and leaves state untouched", () => {
    const s = makeMatch();
    setRes(s, "p1", 1, 0, 0);
    const before = structuredClone(player(s, "p1"));
    for (const type of ["buyCard", "recruitMercenaries", "buildBarricade", "clanGrowth", "trainParty"] as const) {
      const r = cmd(s, "p1", { type });
      expect(r.ok).toBe(false);
    }
    expect(player(s, "p1").resources).toEqual(before.resources);
  });

  it("trains extra gathering parties up to 4", () => {
    const s = makeMatch();
    setRes(s, "p1", 20, 0, 20);
    expect(cmd(s, "p1", { type: "trainParty" }).ok).toBe(true);
    expect(cmd(s, "p1", { type: "trainParty" }).ok).toBe(true);
    expect(cmd(s, "p1", { type: "trainParty" }).code).toBe("LIMIT");
    expect(Object.values(s.parties).filter((x) => x.ownerId === "p1")).toHaveLength(4);
  });

  it("market exchange uses a 3:1 rate and respects the storage cap", () => {
    const s = makeMatch();
    expect(cmd(s, "p1", { type: "marketExchange", give: "gold", get: "food", amount: 3 }).ok).toBe(true);
    expect(player(s, "p1").resources).toMatchObject({ gold: 1, food: 9 });
    setRes(s, "p1", 30, 0, 99);
    expect(cmd(s, "p1", { type: "marketExchange", give: "gold", get: "food", amount: 2 }).code).toBe("LIMIT");
  });

  it("charges 1 food upkeep per round, falling back to 1 gold", () => {
    const s = makeMatch();
    setRes(s, "p1", 3, 0, 1);
    setRes(s, "p2", 3, 0, 0);
    toNextRound(s);
    expect(player(s, "p1").resources).toMatchObject({ gold: 3, food: 0 });
    expect(player(s, "p2").resources).toMatchObject({ gold: 2, food: 0 });
    setRes(s, "p2", 0, 0, 0);
    toNextRound(s);
    expect(player(s, "p2").resources).toEqual({ gold: 0, materials: 0, food: 0 });
  });

  it("enforces phases: no orders during resolution", () => {
    const s = makeMatch();
    toScheme(s);
    tick(s, s.phaseEndsAt);
    expect(s.phase).toBe("resolution");
    expect(cmd(s, "p1", { type: "buyCard" }, s.phaseStartedAt + 1).code).toBe("WRONG_PHASE");
  });
});

describe("idempotency", () => {
  it("a duplicated command id never applies twice", () => {
    const s = makeMatch();
    const a = applyCommand(s, "p1", "same-id-123", { type: "buyCard" }, T0 + 5);
    const b = applyCommand(s, "p1", "same-id-123", { type: "buyCard" }, T0 + 6);
    expect(a.ok).toBe(true);
    expect(b.duplicate).toBe(true);
    expect(player(s, "p1").resources.gold).toBe(6);
    expect(player(s, "p1").hand).toHaveLength(4);
  });

  it("the same id from different players is independent", () => {
    const s = makeMatch();
    applyCommand(s, "p1", "shared-id-1", { type: "buyCard" }, T0 + 5);
    const r = applyCommand(s, "p2", "shared-id-1", { type: "buyCard" }, T0 + 5);
    expect(r.duplicate).toBeUndefined();
    expect(player(s, "p2").resources.gold).toBe(6);
  });
});

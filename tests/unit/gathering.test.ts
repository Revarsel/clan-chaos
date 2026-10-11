import { describe, expect, it } from "vitest";
import { tick } from "@clan-chaos/game-engine";
import { getLocation } from "@clan-chaos/game-content";
import { cmd, makeMatch, player, T0 } from "../helpers";

const partyOf = (s: ReturnType<typeof makeMatch>, pid: string, n = 1) => s.parties[`${pid}-p${n}`]!;

describe("gathering parties", () => {
  it("travels, gathers, returns and delivers exactly the trip yield", () => {
    const s = makeMatch();
    const r = cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "glimmer_hollow" }, T0 + 10);
    expect(r.ok).toBe(true);
    const party = partyOf(s, "p1");
    expect(party.status).toBe("traveling");
    tick(s, party.arriveAt);
    expect(party.status).toBe("gathering");
    expect(party.reserved).toBe(3);
    expect(s.locations.glimmer_hollow!.stock).toBe(37);
    tick(s, party.workEndsAt);
    expect(party.status).toBe("returning");
    expect(party.load).toBe(3);
    tick(s, party.arriveAt);
    expect(party.status).toBe("idle");
    expect(player(s, "p1").resources.gold).toBe(13);
  });

  it("gather duration is 8-15 seconds", () => {
    for (const id of ["glimmer_hollow", "dragons_teeth", "ancient_ruins"]) {
      const l = getLocation(id)!;
      expect(l.gatherMs).toBeGreaterThanOrEqual(8000);
      expect(l.gatherMs).toBeLessThanOrEqual(15000);
    }
  });

  it("cannot send a busy party or another clan's party", () => {
    const s = makeMatch();
    cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "glimmer_hollow" }, T0 + 10);
    expect(cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "sunny_acres" }, T0 + 11).code).toBe("INVALID");
    expect(cmd(s, "p2", { type: "gather", partyId: "p1-p2", locationId: "sunny_acres" }, T0 + 11).code).toBe("NOT_FOUND");
    expect(cmd(s, "p1", { type: "gather", partyId: "p1-p2", locationId: "trading_post" }, T0 + 11).code).toBe("INVALID");
  });

  it("recall while gathering returns partial yield and releases the rest of the stock", () => {
    const s = makeMatch();
    cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "dragons_teeth" }, T0 + 10);
    const party = partyOf(s, "p1");
    tick(s, party.arriveAt);
    expect(party.reserved).toBe(5);
    const mid = party.workStartAt + (party.workEndsAt - party.workStartAt) / 2;
    tick(s, mid);
    expect(cmd(s, "p1", { type: "recall", partyId: "p1-p1" }, mid).ok).toBe(true);
    expect(party.status).toBe("returning");
    expect(party.load).toBe(2); // floor(5 * 0.5)
    expect(s.locations.dragons_teeth!.stock).toBe(30 - 2);
    tick(s, party.arriveAt);
    expect(player(s, "p1").resources.gold).toBe(12);
  });

  it("recall while traveling brings the party home empty", () => {
    const s = makeMatch();
    cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "dragons_teeth" }, T0 + 10);
    expect(cmd(s, "p1", { type: "recall", partyId: "p1-p1" }, T0 + 200).ok).toBe(true);
    const party = partyOf(s, "p1");
    tick(s, party.arriveAt);
    expect(party.status).toBe("idle");
    expect(player(s, "p1").resources.gold).toBe(10);
    expect(s.locations.dragons_teeth!.stock).toBe(30);
  });

  it("party loads never exceed capacity and storage never exceeds 100", () => {
    const s = makeMatch();
    player(s, "p1").resources.gold = 99;
    cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "dragons_teeth" }, T0 + 10);
    const party = partyOf(s, "p1");
    tick(s, party.arriveAt);
    expect(party.reserved).toBeLessThanOrEqual(s.config.partyCapacity);
    tick(s, party.workEndsAt);
    tick(s, party.arriveAt);
    expect(player(s, "p1").resources.gold).toBe(100);
  });

  it("contested stock is shared: two parties cannot take more than exists", () => {
    const s = makeMatch(["rats", "toads", "foxfire"]);
    s.locations.dragons_teeth!.stock = 6;
    s.config.stockRegenIntervalMs = 1e9;
    cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "dragons_teeth" }, T0 + 10);
    cmd(s, "p2", { type: "gather", partyId: "p2-p1", locationId: "dragons_teeth" }, T0 + 10);
    tick(s, T0 + 20_000);
    expect(player(s, "p1").resources.gold + player(s, "p2").resources.gold).toBe(20 + 6);
    expect(s.locations.dragons_teeth!.stock).toBe(0);
    expect(cmd(s, "p3", { type: "gather", partyId: "p3-p1", locationId: "dragons_teeth" }, T0 + 20_000).ok).toBe(false);
  });

  it("stock regenerates gradually up to its maximum", () => {
    const s = makeMatch();
    s.locations.sunny_acres!.stock = 0;
    tick(s, T0 + 10_000);
    expect(s.locations.sunny_acres!.stock).toBe(2);
    tick(s, T0 + 25_000);
    expect(s.locations.sunny_acres!.stock).toBe(4);
  });

  it("Food Shortage reduces food yields by 1", () => {
    const s = makeMatch();
    s.activeEvent = { id: "food_shortage", startRound: 1, untilRound: 2, wealthiestIds: [], claimed: {} };
    cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "sunny_acres" }, T0 + 10);
    tick(s, partyOf(s, "p1").arriveAt);
    expect(partyOf(s, "p1").reserved).toBe(2);
  });

  it("Gold Rush grants +2 gold once per player", () => {
    const s = makeMatch();
    s.activeEvent = { id: "gold_rush", startRound: 1, untilRound: 2, wealthiestIds: [], claimed: {} };
    cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "glimmer_hollow" }, T0 + 10);
    cmd(s, "p1", { type: "gather", partyId: "p1-p2", locationId: "glimmer_hollow" }, T0 + 10);
    tick(s, T0 + 25_000);
    expect(player(s, "p1").resources.gold).toBe(10 + 3 + 3 + 2);
  });
});

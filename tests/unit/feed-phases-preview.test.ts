import { describe, expect, it } from "vitest";
import { COMMAND_PHASES, type CardId, type GameCommand, type GameCommandType } from "@clan-chaos/shared";
import { CARDS } from "@clan-chaos/game-content";
import { buildPlayerView, previewStrongholdRaid, tick } from "@clan-chaos/game-engine";
import { cmd, giveCard, makeMatch, player, setRes, toNextRound, toResolution, toScheme } from "../helpers";

const sample: Record<GameCommandType, GameCommand> = {
  gather: { type: "gather", partyId: "p1-p1", locationId: "sunny_acres" },
  recall: { type: "recall", partyId: "p1-p1" },
  buildBarricade: { type: "buildBarricade" },
  repairFort: { type: "repairFort" },
  recruitMercenaries: { type: "recruitMercenaries" },
  buyCard: { type: "buyCard" },
  buyMerchantCard: { type: "buyMerchantCard" },
  clanGrowth: { type: "clanGrowth" },
  trainParty: { type: "trainParty" },
  scout: { type: "scout", targetPlayerId: "p2" },
  playCard: { type: "playCard", cardUid: "nope" },
  commitDefense: { type: "commitDefense", cardUid: "nope" },
  commitRaid: { type: "commitRaid", target: { kind: "player", playerId: "p2" }, priority: "gold" },
  useClanAbility: { type: "useClanAbility" },
  foxfireRetarget: { type: "foxfireRetarget", target: { kind: "player", playerId: "p2" } },
  tradeOffer: { type: "tradeOffer", toPlayerId: "p2", give: { gold: 1 }, want: {} },
  tradeRespond: { type: "tradeRespond", offerId: "nope", accept: true },
  tradeCancel: { type: "tradeCancel", offerId: "nope" },
  marketExchange: { type: "marketExchange", give: "gold", get: "food", amount: 1 },
  truceRespond: { type: "truceRespond", accept: true },
};

describe("COMMAND_PHASES is what the engine enforces", () => {
  it("rejects every command outside its listed phases and never for phase reasons inside them", () => {
    for (const type of Object.keys(COMMAND_PHASES) as GameCommandType[]) {
      for (const phase of ["build", "scheme", "resolution"] as const) {
        const s = makeMatch(["foxfire", "rats"]);
        if (phase !== "build") toScheme(s);
        if (phase === "resolution") toResolution(s);
        const r = cmd(s, "p1", sample[type], s.phaseStartedAt + 1);
        if (COMMAND_PHASES[type].includes(phase)) expect(r.code, `${type} in ${phase}`).not.toBe("WRONG_PHASE");
        else expect(r.code, `${type} in ${phase}`).toBe("WRONG_PHASE");
      }
    }
  });
});

describe("defense card limits (R1)", () => {
  it("counts Last-Minute Reinforcements towards the 2-per-round limit and rejects duplicates", () => {
    const s = makeMatch(["rats", "rats"]);
    setRes(s, "p2", 20, 20, 20);
    const commit = (c: CardId) => cmd(s, "p2", { type: "commitDefense", cardUid: giveCard(s, "p2", c) });
    expect(commit("last_minute_reinforcements").ok).toBe(true);
    expect(commit("last_minute_reinforcements").code).toBe("LIMIT");
    expect(commit("reinforced_gates").ok).toBe(true);
    expect(commit("decoy_vault").code).toBe("LIMIT");
    expect(player(s, "p2").reinforcementDefense).toBe(2);
    expect(buildPlayerView(s, "p2", 0).self!.defenseCommitsThisRound).toEqual(["last_minute_reinforcements", "reinforced_gates"]);
    toNextRound(s);
    expect(player(s, "p2").defenseCommitsThisRound).toEqual([]);
    expect(commit("decoy_vault").ok).toBe(true);
  });
});

describe("action feed entries", () => {
  it("logs upkeep privately with the resource change", () => {
    const s = makeMatch(["rats", "rats"]);
    toNextRound(s);
    const mine = buildPlayerView(s, "p1", 0).log.find((l) => l.category === "upkeep");
    expect(mine?.delta).toEqual({ food: -1 });
    expect(buildPlayerView(s, "p2", 0).log.filter((l) => l.category === "upkeep")).toHaveLength(1);
  });

  it("describes the player's own commands with the real resource change", () => {
    const s = makeMatch(["rats", "rats"]);
    cmd(s, "p1", { type: "recruitMercenaries" });
    const before = player(s, "p1").hand.map((c) => c.uid);
    cmd(s, "p1", { type: "buyCard" });
    const drawn = player(s, "p1").hand.find((c) => !before.includes(c.uid))!;
    const log = buildPlayerView(s, "p1", 0).log;
    expect(log.find((l) => l.text.startsWith("You recruited"))?.delta).toEqual({ gold: -3, food: -2 });
    const buy = log.find((l) => l.text.startsWith("You bought a card"))!;
    expect(buy.text).toContain(CARDS[drawn.cardId].name);
    expect(buy.delta).toEqual({ gold: -4 });
    // Rivals see none of it.
    const rival = JSON.stringify(buildPlayerView(s, "p2", 0).log);
    expect(rival).not.toContain("You recruited");
    expect(rival).not.toContain("You bought");
  });

  it("keeps the raid target private until the reveal, then explains the outcome", () => {
    const s = makeMatch(["rats", "rats", "rats"]);
    const at = toScheme(s);
    cmd(s, "p1", { type: "commitRaid", target: { kind: "player", playerId: "p2" }, priority: "gold" }, at);
    const p3 = buildPlayerView(s, "p3", at).log.map((l) => l.text).join("\n");
    expect(p3).toContain("Player1 has committed a secret raid order");
    expect(p3).not.toContain("raid on Player2");
    expect(buildPlayerView(s, "p1", at).log.some((l) => l.text.includes("secret raid on Player2"))).toBe(true);
    toResolution(s);
    const pub = buildPlayerView(s, "p3", 0).log.find((l) => l.category === "raid" && l.text.startsWith("Player1 raided"))!;
    expect(pub.why).toBe("Attack 2 did not exceed defense 5.");
    expect(pub.actors).toEqual(["p1", "p2"]);
    expect(pub.delta).toBeUndefined();
    const own = buildPlayerView(s, "p1", 0).log.find((l) => l.text.startsWith("Your raid on"))!;
    expect(own.delta).toEqual({ gold: -2 });
  });

  it("gives both trade partners their own resource change", () => {
    const s = makeMatch(["rats", "rats"]);
    cmd(s, "p1", { type: "tradeOffer", toPlayerId: "p2", give: { gold: 3 }, want: { food: 2 } });
    const offer = s.trades[0]!;
    cmd(s, "p2", { type: "tradeRespond", offerId: offer.id, accept: true });
    const a = buildPlayerView(s, "p1", 0).log.find((l) => l.category === "trade" && l.text.startsWith("Trade with"))!;
    const b = buildPlayerView(s, "p2", 0).log.find((l) => l.category === "trade" && l.text.startsWith("You accepted"))!;
    expect(a.delta).toEqual({ gold: -3, food: 2 });
    expect(b.delta).toEqual({ gold: 3, food: -2 });
  });

  it("logs points publicly with the reason", () => {
    const s = makeMatch(["rats", "rats"]);
    player(s, "p2").fortDefense = 1;
    const at = toScheme(s);
    cmd(s, "p1", { type: "commitRaid", target: { kind: "player", playerId: "p2" }, priority: "gold" }, at);
    toResolution(s);
    const scores = buildPlayerView(s, "p2", 0).log.filter((l) => l.category === "score");
    expect(scores.map((l) => l.points)).toEqual([2, 3]);
    expect(scores[0]!.actors).toEqual(["p1"]);
  });

  it("deliveries record what was gathered", () => {
    const s = makeMatch(["rats", "rats"]);
    cmd(s, "p1", { type: "gather", partyId: "p1-p1", locationId: "sunny_acres" });
    tick(s, s.phaseStartedAt + 25_000);
    const d = buildPlayerView(s, "p1", 0).log.find((l) => l.text.startsWith("A party delivered"))!;
    expect(d.text).toContain("Sunny Acres");
    expect(d.delta).toEqual({ food: 3 });
  });
});

describe("raid preview uses the same attack maths as resolution", () => {
  const attackCards = (Object.keys(CARDS) as CardId[]).filter((c) => CARDS[c].timing === "attack");
  const primaries = [undefined, ...attackCards.filter((c) => CARDS[c].slot !== "support")];
  const supports = [undefined, ...attackCards.filter((c) => CARDS[c].slot !== "primary")];

  it("matches the resolved attack strength and never claims a sure loss that wins", () => {
    for (const prim of primaries) {
      for (const sup of supports) {
        if (prim && sup && prim === sup) continue;
        for (const merc of [0, 2]) {
          for (const fort of [0, 3, 5]) {
            for (const barricade of [false, true]) {
              const s = makeMatch(["rats", "rats", "rats"]);
              setRes(s, "p1", 30, 30, 30);
              player(s, "p2").fortDefense = fort;
              if (barricade) player(s, "p2").barricadeDefense = 2;
              if (merc) cmd(s, "p1", { type: "recruitMercenaries" });
              const at = toScheme(s);
              const cards = [prim, sup].filter((c): c is CardId => !!c);
              const r = cmd(
                s,
                "p1",
                {
                  type: "commitRaid",
                  target: { kind: "player", playerId: "p2" },
                  priority: "gold",
                  primaryCardUid: prim ? giveCard(s, "p1", prim) : undefined,
                  supportCardUid: sup ? giveCard(s, "p1", sup) : undefined,
                  decoyPlayerId: "p3",
                },
                at,
              );
              expect(r.ok, JSON.stringify(r)).toBe(true);
              const preview = previewStrongholdRaid(merc, cards, { fortDefense: fort, hasBarricade: barricade });
              toResolution(s);
              const res = s.resolutions[0]!;
              expect(res.attackStrength, `${cards} merc ${merc}`).toBe(preview.attack);
              expect(res.defenseStrength).toBeGreaterThanOrEqual(preview.visibleMin);
              expect(res.defenseStrength).toBeLessThanOrEqual(preview.visibleMax);
              if (preview.verdict === "cannot_win") expect(res.success).toBe(false);
              if (preview.verdict === "beats_visible") expect(res.success).toBe(true); // no hidden defenses in this setup
            }
          }
        }
      }
    }
  });
});

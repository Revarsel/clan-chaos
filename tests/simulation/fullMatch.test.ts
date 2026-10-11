import { describe, expect, it } from "vitest";
import { CARD_IDS, CLAN_IDS, RESOURCE_TYPES, type GameCommand, type ResourceType } from "@clan-chaos/shared";
import { CARDS, MAP_LOCATIONS } from "@clan-chaos/game-content";
import { applyCommand, buildPlayerView, createMatch, hashSeed, nextRandom, tick, type MatchState } from "@clan-chaos/game-engine";

/** Generates a random (often legal, sometimes illegal) command for a player. */
function randomCommand(state: MatchState, pid: string, r: () => number): GameCommand {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)] as T;
  const p = state.players[pid]!;
  const rivals = state.seatOrder.filter((id) => id !== pid);
  const parties = Object.values(state.parties).filter((x) => x.ownerId === pid);
  const gatherable = MAP_LOCATIONS.filter((l) => l.resource);
  const card = p.hand.length ? pick(p.hand) : null;
  const res = (): ResourceType => pick(RESOURCE_TYPES);
  const roll = r();
  if (roll < 0.25 && parties.length) return { type: "gather", partyId: pick(parties).id, locationId: pick(gatherable).id };
  if (roll < 0.3 && parties.length) return { type: "recall", partyId: pick(parties).id };
  if (roll < 0.45 && state.phase === "scheme") {
    const attack = p.hand.filter((c) => CARDS[c.cardId].timing === "attack");
    const primary = attack.find((c) => CARDS[c.cardId].slot !== "support");
    const support = attack.find((c) => c !== primary && CARDS[c.cardId].slot !== "primary");
    const contested = MAP_LOCATIONS.filter((l) => l.resource && !l.safe);
    return {
      type: "commitRaid",
      target: r() < 0.8 ? { kind: "player", playerId: pick(rivals) } : { kind: "location", locationId: pick(contested).id },
      primaryCardUid: r() < 0.6 ? primary?.uid : undefined,
      supportCardUid: r() < 0.5 ? support?.uid : undefined,
      decoyPlayerId: pick(rivals),
      priority: res(),
    };
  }
  if (roll < 0.55 && card) {
    const def = CARDS[card.cardId];
    if (def.timing === "defense") return { type: "commitDefense", cardUid: card.uid };
    return {
      type: "playCard",
      cardUid: card.uid,
      targetPlayerId: pick(rivals),
      locationId: pick(gatherable).id,
      evacuate: { [res()]: Math.floor(r() * 6) + 1 },
    };
  }
  const simple: GameCommand[] = [
    { type: "buyCard" },
    { type: "buildBarricade" },
    { type: "repairFort" },
    { type: "recruitMercenaries" },
    { type: "clanGrowth" },
    { type: "trainParty" },
    { type: "useClanAbility" },
    { type: "scout", targetPlayerId: pick(rivals) },
    { type: "marketExchange", give: res(), get: res(), amount: 1 + Math.floor(r() * 3) },
    { type: "tradeOffer", toPlayerId: pick(rivals), give: { [res()]: 1 + Math.floor(r() * 3) }, want: { [res()]: 1 + Math.floor(r() * 3) } },
    { type: "foxfireRetarget", target: { kind: "player", playerId: pick(rivals) } },
    { type: "truceRespond", accept: r() < 0.5 },
  ];
  const open = state.trades.find((t) => t.toId === pid && t.status === "open");
  if (open && r() < 0.5) return { type: "tradeRespond", offerId: open.id, accept: r() < 0.7 };
  return pick(simple);
}

function checkInvariants(state: MatchState) {
  for (const p of Object.values(state.players)) {
    for (const t of RESOURCE_TYPES) {
      expect(p.resources[t]).toBeGreaterThanOrEqual(0);
      expect(p.resources[t]).toBeLessThanOrEqual(state.config.storageCap);
      expect(Number.isInteger(p.resources[t])).toBe(true);
      expect(p.safeReserve[t]).toBeGreaterThanOrEqual(0);
    }
    expect(p.fortDefense).toBeGreaterThanOrEqual(0);
    expect(p.fortDefense).toBeLessThanOrEqual(state.config.fortMax);
    expect(p.fortDefense).toBeLessThanOrEqual(p.fortLevel);
    expect(p.hand.length).toBeLessThanOrEqual(state.config.maxHandSize);
    expect(p.mercenaryBonus).toBeLessThanOrEqual(state.config.maxMercenaryBonus);
    expect(p.barricadeDefense).toBeLessThanOrEqual(state.config.maxBarricadeDefense);
    expect(p.defenseCards.length).toBeLessThanOrEqual(state.config.maxDefenseCardsPerRound);
    expect(p.tradesOfferedThisRound).toBeLessThanOrEqual(state.config.maxTradeOffersPerRound);
    expect(p.score).toBe(p.scoreBreakdown.reduce((a, e) => a + e.points, 0));
    const parties = Object.values(state.parties).filter((x) => x.ownerId === p.id);
    expect(parties.length).toBeLessThanOrEqual(state.config.maxParties);
  }
  for (const party of Object.values(state.parties)) {
    expect(party.load).toBeLessThanOrEqual(state.config.partyCapacity + 2);
    expect(party.reserved).toBeGreaterThanOrEqual(0);
  }
  for (const loc of MAP_LOCATIONS) {
    const st = state.locations[loc.id]!.stock;
    expect(st).toBeGreaterThanOrEqual(0);
    expect(st).toBeLessThanOrEqual(loc.maxStock);
  }
  // Card conservation: every physical card is in exactly one place.
  const uids = [
    ...state.deck,
    ...state.discard,
    ...(state.merchantCard ? [state.merchantCard] : []),
    ...Object.values(state.players).flatMap((p) => [...p.hand, ...p.defenseCards]),
    ...Object.values(state.raids).flatMap((r) => [r.primary, r.support].filter((c) => c !== null)),
  ].map((c) => c!.uid);
  expect(new Set(uids).size).toBe(uids.length);
  expect(uids.length).toBe(CARD_IDS.length * state.config.deckCopies);
}

function simulate(seed: string, playerCount: number) {
  const rng = { rng: hashSeed(seed) };
  const r = () => nextRandom(rng);
  const t0 = 1_000_000;
  const state = createMatch({
    id: seed,
    seed,
    now: t0,
    players: Array.from({ length: playerCount }, (_, i) => ({ id: `p${i}`, name: `P${i}`, clan: CLAN_IDS[i % 4]! })),
  });
  let now = t0;
  let resolutionsSeen = 0;
  const raidsPerRound = new Map<number, number>();
  let steps = 0;
  while (state.phase !== "ended") {
    steps++;
    if (steps > 20_000) throw new Error("match did not terminate");
    now += 250 + Math.floor(r() * 750);
    const before = state.resolutionRound;
    tick(state, now);
    if (state.resolutionRound !== before) {
      resolutionsSeen++;
      raidsPerRound.set(state.resolutionRound, state.resolutions.length);
    }
    if (state.phase === "ended") break;
    for (const pid of state.seatOrder) {
      if (r() < 0.5) continue;
      const command = randomCommand(state, pid, r);
      const id = `${pid}-${steps}-${Math.floor(r() * 1e9)}`;
      const res = applyCommand(state, pid, id, command, now);
      // Duplicate delivery must be a no-op.
      if (r() < 0.1) {
        const snapshot = JSON.stringify(state.players[pid]);
        const dup = applyCommand(state, pid, id, command, now);
        expect(dup.duplicate).toBe(true);
        expect(dup.ok).toBe(res.ok);
        expect(JSON.stringify(state.players[pid])).toBe(snapshot);
      }
    }
    checkInvariants(state);
    // Views always build and never leak other hands.
    if (steps % 25 === 0) {
      for (const pid of state.seatOrder) {
        const view = JSON.stringify(buildPlayerView(state, pid, now));
        for (const other of state.seatOrder.filter((x) => x !== pid)) {
          for (const c of state.players[other]!.hand) expect(view).not.toContain(`"${c.uid}"`);
        }
      }
    }
  }
  return { state, resolutionsSeen, raidsPerRound };
}

describe("full-match simulations", () => {
  for (const players of [2, 3, 5, 8]) {
    for (const seed of ["alpha", "bravo", "charlie"]) {
      it(`${players} players, seed ${seed}: terminates with consistent state`, () => {
        const { state, resolutionsSeen, raidsPerRound } = simulate(`${seed}-${players}`, players);
        expect(state.phase).toBe("ended");
        expect(state.results).not.toBeNull();
        expect(state.results!.standings).toHaveLength(players);
        if (state.results!.endedReason === "rounds_complete") {
          expect(state.round).toBe(8);
          expect(resolutionsSeen).toBe(8);
        }
        for (const n of raidsPerRound.values()) expect(n).toBeLessThanOrEqual(players);
        expect(state.results!.winnerIds.length).toBeGreaterThanOrEqual(1);
        expect(state.stats.raidsLaunched).toBeGreaterThan(0);
        expect(state.stats.cardsPlayed).toBeGreaterThan(0);
        checkInvariants(state);
      });
    }
  }

  it("is deterministic for a given seed and command stream", () => {
    const a = simulate("determinism", 4).state;
    const b = simulate("determinism", 4).state;
    expect(JSON.stringify(a.results)).toBe(JSON.stringify(b.results));
  });
});

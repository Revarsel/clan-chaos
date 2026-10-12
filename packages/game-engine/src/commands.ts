import {
  COMMAND_PHASES,
  PHASE_NAMES,
  RESOURCE_TYPES,
  fillResources,
  formatResources,
  totalResources,
  type CardId,
  type FeedCategory,
  type GameCommand,
  type RaidTarget,
  type Resources,
} from "@clan-chaos/shared";
import { ACTION_VALUES, CARDS, CLANS, COSTS, getLocation } from "@clan-chaos/game-content";
import type { CommandRecord, MatchState, PlayerState } from "./state.js";
import {
  RuleError,
  addResource,
  canAfford,
  drawCard,
  fail,
  getPlayer,
  log,
  pay,
  removeFromHand,
  removeResource,
  resourceDelta,
  rivalsOf,
  takeFromHand,
} from "./helpers.js";
import { addParty } from "./create.js";
import { isGatherable, recallParty, startGather } from "./gathering.js";
import { validateRaidTarget } from "./raids.js";

export interface CommandResult {
  ok: boolean;
  code?: string;
  message?: string;
  duplicate?: boolean;
}

const MAX_PROCESSED = 5000;

/**
 * Applies one player command. Idempotent per (player, commandId): a repeated id returns the
 * original result without re-applying effects. Failed commands are rolled back to
 * a snapshot taken before the command; on RuleError the snapshot is restored, so no state changes.
 */
export function applyCommand(
  state: MatchState,
  playerId: string,
  commandId: string,
  cmd: GameCommand,
  now: number,
): CommandResult {
  const key = `${playerId}:${commandId}`;
  const prior = state.processed[key];
  if (prior) return { ...prior, duplicate: true };
  let record: CommandRecord;
  try {
    const p = getPlayer(state, playerId);
    if (state.phase === "ended") fail("WRONG_PHASE", "The match is over");
    if (p.eliminated) fail("ELIMINATED", "Your clan has been eliminated; you are spectating");
    if (state.phase === "resolution") fail("WRONG_PHASE", "Orders are locked during Resolution");
    requireCommandPhase(state, cmd.type);
    // The log is append-only, so it is excluded from the (deep) snapshot and trimmed on rollback instead.
    const { processed: _processed, log: _log, ...rest } = state;
    const snapshot = structuredClone(rest);
    const lastLogEntry = state.log[state.log.length - 1];
    try {
      const before = { ...p.resources };
      const handBefore = new Set(p.hand.map((c) => c.uid));
      execute(state, p, cmd, now);
      const entry = describeCommand(state, p, cmd, handBefore, now);
      if (entry) {
        log(state, now, entry.text, "private", [p.id], {
          category: entry.category,
          actors: entry.actors ?? [p.id],
          delta: resourceDelta(before, p.resources),
          why: entry.why,
        });
      }
    } catch (err) {
      // Roll back any partial mutation so a failed command never leaves state half-applied.
      restoreInPlace(state as unknown as Record<string, unknown>, snapshot as unknown as Record<string, unknown>);
      while (state.log.length && state.log[state.log.length - 1] !== lastLogEntry) state.log.pop();
      throw err;
    }
    record = { ok: true };
    state.seq += 1;
  } catch (err) {
    if (err instanceof RuleError) record = { ok: false, code: err.code, message: err.message };
    else throw err;
  }
  state.processed[key] = record;
  const keys = Object.keys(state.processed);
  if (keys.length > MAX_PROCESSED) for (const k of keys.slice(0, keys.length - MAX_PROCESSED)) delete state.processed[k];
  return record;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Restores `target` to `snap` while keeping existing object/array identities stable. */
function restoreInPlace(target: Record<string, unknown>, snap: Record<string, unknown>): void {
  for (const k of Object.keys(target)) if (!(k in snap) && k !== "processed" && k !== "log") delete target[k];
  for (const [k, v] of Object.entries(snap)) {
    const cur = target[k];
    if (Array.isArray(cur) && Array.isArray(v)) {
      cur.length = 0;
      cur.push(...v);
    } else if (isPlainObject(cur) && isPlainObject(v)) {
      restoreInPlace(cur, v);
    } else {
      target[k] = v;
    }
  }
}

/** Enforces the shared COMMAND_PHASES table (the client reads the same table to explain availability). */
function requireCommandPhase(state: MatchState, type: GameCommand["type"]): void {
  const phases = COMMAND_PHASES[type];
  if (!phases.includes(state.phase)) {
    fail("WRONG_PHASE", `Only allowed during ${phases.map((x) => PHASE_NAMES[x]).join(" or ")}`);
  }
}

function rival(state: MatchState, p: PlayerState, id: string | undefined): PlayerState {
  if (!id) return fail("INVALID", "Choose a rival clan");
  const t = getPlayer(state, id);
  if (t.id === p.id) fail("INVALID", "Choose a rival, not yourself");
  if (t.eliminated) fail("INVALID", "That clan has been eliminated");
  return t;
}

export function cardBuyCost(state: MatchState, p: PlayerState): number {
  return p.clan === "mushrooms" && p.cardsBoughtThisRound === 0 ? COSTS.buyCardMushroomDiscount.gold : COSTS.buyCard.gold;
}

function addIntel(state: MatchState, to: string, aboutId: string, source: string, text: string): void {
  state.intel[to]?.push({ round: state.round, aboutId, source, text });
}

function counterIntelActive(state: MatchState, p: PlayerState): boolean {
  return p.effects.counterIntelUntil >= state.round;
}

function targetName(state: MatchState, t: RaidTarget): string {
  return t.kind === "player" ? (state.players[t.playerId]?.name ?? "?") : (getLocation(t.locationId)?.name ?? "?");
}

function execute(state: MatchState, p: PlayerState, cmd: GameCommand, now: number): void {
  const cfg = state.config;
  switch (cmd.type) {
    case "gather":
      startGather(state, p, cmd.partyId, cmd.locationId, now);
      return;
    case "recall":
      recallParty(state, p, cmd.partyId, now);
      return;
    case "buildBarricade":
      if (p.barricadeDefense + ACTION_VALUES.barricadeDefense > cfg.maxBarricadeDefense) {
        fail("LIMIT", `Barricades are capped at +${cfg.maxBarricadeDefense} defense`);
      }
      pay(p, COSTS.barricade);
      p.barricadeDefense += ACTION_VALUES.barricadeDefense;
      return;
    case "repairFort":
      if (p.fortDefense >= p.fortLevel) fail("LIMIT", "Your fort is already fully repaired");
      pay(p, COSTS.repairFort);
      p.fortDefense = Math.min(p.fortLevel, cfg.fortMax, p.fortDefense + ACTION_VALUES.repairAmount);
      return;
    case "clanGrowth":
      if (p.fortLevel >= cfg.fortMax) fail("LIMIT", `Fort level is already at the maximum of ${cfg.fortMax}`);
      pay(p, COSTS.clanGrowth);
      p.fortLevel += ACTION_VALUES.growthAmount;
      p.fortDefense = Math.min(p.fortLevel, p.fortDefense + ACTION_VALUES.growthAmount);
      return;
    case "recruitMercenaries":
      if (p.mercenaryBonus + ACTION_VALUES.mercenaryBonus > cfg.maxMercenaryBonus) {
        fail("LIMIT", `Mercenary bonus is capped at +${cfg.maxMercenaryBonus}`);
      }
      pay(p, COSTS.recruitMercenaries);
      p.mercenaryBonus += ACTION_VALUES.mercenaryBonus;
      return;
    case "buyCard": {
      if (p.hand.length >= cfg.maxHandSize) fail("LIMIT", `Hand is full (${cfg.maxHandSize} cards)`);
      if (state.deck.length === 0 && state.discard.length === 0) fail("LIMIT", "The deck is empty");
      pay(p, { gold: cardBuyCost(state, p) });
      drawCard(state, p);
      p.cardsBoughtThisRound += 1;
      return;
    }
    case "buyMerchantCard": {
      if (state.activeEvent?.id !== "wandering_merchant" || !state.merchantCard) fail("INVALID", "No merchant card is for sale");
      if (p.hand.length >= cfg.maxHandSize) fail("LIMIT", "Your hand is full");
      pay(p, COSTS.merchantCard);
      p.hand.push(state.merchantCard!);
      log(state, now, `${p.name} bought the Wandering Merchant's ${CARDS[state.merchantCard!.cardId].name}.`, "event");
      state.merchantCard = null;
      return;
    }
    case "trainParty": {
      const count = Object.values(state.parties).filter((x) => x.ownerId === p.id).length;
      if (count >= cfg.maxParties) fail("LIMIT", `You already have ${cfg.maxParties} parties`);
      pay(p, COSTS.trainParty);
      addParty(state, p);
      return;
    }
    case "scout": {
      const t = rival(state, p, cmd.targetPlayerId);
      if (p.scoutedThisRound.includes(t.id)) fail("LIMIT", "You already scouted that clan this round");
      pay(p, COSTS.scout);
      p.scoutedThisRound.push(t.id);
      if (counterIntelActive(state, t)) {
        addIntel(state, p.id, t.id, "Scout", `Your scouts were caught by ${t.name}'s Counter-Intel. No report.`);
        log(state, now, `Counter-Intel blocked a scouting attempt by ${p.name}.`, "private", [t.id]);
        return;
      }
      const raid = state.raids[t.id];
      let raidText = "No raid committed yet.";
      if (raid) {
        const usesSmoke = raid.primary?.cardId === "smoke_and_mirrors" || raid.support?.cardId === "smoke_and_mirrors";
        if (usesSmoke) raidText = "A raid is committed, but its target is hidden in smoke.";
        else if (raid.decoyPlayerId) raidText = `Raid committed against ${state.players[raid.decoyPlayerId]?.name}.`;
        else raidText = `Raid committed against ${targetName(state, raid.target)}.`;
      }
      addIntel(
        state,
        p.id,
        t.id,
        "Scout",
        `${t.name}: ${formatResources(t.resources)}; fort ${t.fortDefense}/${t.fortLevel}; barricade +${t.barricadeDefense}; ` +
          `${t.hand.length} cards; ${t.defenseCards.length} defense card(s) committed. ${raidText}`,
      );
      return;
    }
    case "playCard":
      playInstant(state, p, cmd, now);
      return;
    case "commitDefense": {
      const card = takeFromHand(p, cmd.cardUid);
      const def = CARDS[card.cardId];
      if (def.timing !== "defense") fail("INVALID", `${def.name} is not a defensive card`);
      if (p.defenseCommitsThisRound.length >= cfg.maxDefenseCardsPerRound) {
        fail("LIMIT", `At most ${cfg.maxDefenseCardsPerRound} defense cards per round`);
      }
      if (p.defenseCommitsThisRound.includes(card.cardId)) fail("LIMIT", `${def.name} is already committed this round`);
      pay(p, def.cost);
      removeFromHand(p, card.uid);
      state.stats.cardsPlayed += 1;
      p.defenseCommitsThisRound.push(card.cardId);
      if (card.cardId === "last_minute_reinforcements") {
        p.reinforcementDefense += def.params.defense ?? 0;
        state.discard.push(card);
      } else {
        p.defenseCards.push(card);
      }
      return;
    }
    case "commitRaid": {
      if (state.raids[p.id]) fail("LIMIT", "You have already committed a raid this round");
      const primary = cmd.primaryCardUid ? takeFromHand(p, cmd.primaryCardUid) : null;
      const support = cmd.supportCardUid ? takeFromHand(p, cmd.supportCardUid) : null;
      if (primary && support && primary.uid === support.uid) fail("INVALID", "Choose two different cards");
      if (primary) {
        const d = CARDS[primary.cardId];
        if (d.timing !== "attack" || d.slot === "support") fail("INVALID", `${d.name} cannot be a primary raid card`);
      }
      if (support) {
        const d = CARDS[support.cardId];
        if (d.timing !== "attack" || d.slot === "primary") fail("INVALID", `${d.name} cannot be a support raid card`);
      }
      const cards = [primary, support].filter((c) => c !== null).map((c) => c!.cardId);
      validateRaidTarget(state, p, cmd.target, cards);
      let decoy: string | null = null;
      if (cards.includes("false_flag")) {
        const d = rival(state, p, cmd.decoyPlayerId);
        if (cmd.target.kind === "player" && d.id === cmd.target.playerId) fail("INVALID", "The decoy must differ from the real target");
        decoy = d.id;
      }
      const total: Partial<Resources> = {};
      for (const c of cards) for (const t of RESOURCE_TYPES) total[t] = (total[t] ?? 0) + (CARDS[c].cost[t] ?? 0);
      pay(p, total);
      for (const c of [primary, support]) if (c) removeFromHand(p, c.uid);
      state.raids[p.id] = {
        attackerId: p.id,
        target: cmd.target,
        primary,
        support,
        decoyPlayerId: decoy,
        priority: cmd.priority,
        mercenaryBonus: p.mercenaryBonus,
        committedAt: now,
      };
      p.mercenaryBonus = 0;
      p.raidsLaunched += 1;
      state.stats.raidsLaunched += 1;
      state.stats.cardsPlayed += cards.length;
      log(state, now, `${p.name} has committed a secret raid order.`, "info");
      return;
    }
    case "foxfireRetarget": {
      if (p.clan !== "foxfire") fail("INVALID", "Only the Foxfire Bandits can do that");
      if (p.abilityUsed) fail("LIMIT", "Change of Heart has already been used this match");
      const raid = state.raids[p.id];
      if (!raid) return fail("INVALID", "Commit a raid first");
      const cards = [raid.primary, raid.support].filter((c) => c !== null).map((c) => c!.cardId);
      validateRaidTarget(state, p, cmd.target, cards);
      if (JSON.stringify(cmd.target) === JSON.stringify(raid.target)) fail("INVALID", "That is already your target");
      if (raid.decoyPlayerId && cmd.target.kind === "player" && cmd.target.playerId === raid.decoyPlayerId) {
        fail("INVALID", "The new target cannot be your False Flag decoy");
      }
      raid.target = cmd.target;
      p.abilityUsed = true;
      return;
    }
    case "useClanAbility": {
      if (CLANS[p.clan].abilityKind !== "active" || p.clan !== "rats") {
        fail("INVALID", p.clan === "foxfire" ? "Use Change of Heart from the raid planner" : "Your clan ability is passive");
      }
      if (p.abilityUsed) fail("LIMIT", "Protection Money has already been collected this match");
      p.abilityUsed = true;
      let total = 0;
      for (const t of rivalsOf(state, p.id)) {
        if (t.resources.gold >= 5) {
          const room = cfg.storageCap - p.resources.gold;
          const take = Math.min(2, room);
          removeResource(t, "gold", take);
          addResource(state, p, "gold", take);
          total += take;
          log(state, now, `${p.name} (Rats of the Racket) collected ${take} gold of "protection money" from you.`, "private", [t.id], {
            category: "event",
            actors: [p.id, t.id],
            delta: { gold: -take },
            why: "Protection Money takes 2 gold from every rival holding at least 5 gold.",
          });
        }
      }
      log(state, now, `${p.name} called in Protection Money and collected ${total} gold!`, "event", null, { category: "event", actors: [p.id] });
      return;
    }
    case "tradeOffer": {
      const to = rival(state, p, cmd.toPlayerId);
      if (p.tradesOfferedThisRound >= cfg.maxTradeOffersPerRound) {
        fail("LIMIT", `At most ${cfg.maxTradeOffersPerRound} trade offers per round`);
      }
      const give = fillResources(cmd.give);
      const want = fillResources(cmd.want);
      if (totalResources(give) + totalResources(want) === 0) fail("INVALID", "A trade must include something");
      if (!canAfford(p, give)) fail("INSUFFICIENT", "You don't have what you are offering");
      p.tradesOfferedThisRound += 1;
      const offer = {
        id: `t${state.nextTradeId++}`,
        fromId: p.id,
        toId: to.id,
        give: cmd.give,
        want: cmd.want,
        status: "open" as const,
        round: state.round,
      };
      state.trades.push(offer);
      log(state, now, `${p.name} offers ${formatResources(give)} for ${formatResources(want)}.`, "trade", [p.id, to.id]);
      return;
    }
    case "tradeRespond": {
      const offer = state.trades.find((t) => t.id === cmd.offerId);
      if (!offer || offer.toId !== p.id) return fail("NOT_FOUND", "Trade offer not found");
      if (offer.status !== "open") fail("INVALID", `That offer is ${offer.status}`);
      if (!cmd.accept) {
        offer.status = "rejected";
        log(state, now, `${p.name} rejected a trade offer.`, "trade", [offer.fromId, offer.toId]);
        return;
      }
      const from = getPlayer(state, offer.fromId);
      if (from.eliminated) fail("INVALID", "That clan has been eliminated");
      const give = fillResources(offer.give);
      const want = fillResources(offer.want);
      if (!canAfford(from, give)) fail("INSUFFICIENT", `${from.name} can no longer afford this trade`);
      if (!canAfford(p, want)) fail("INSUFFICIENT", "You can't afford this trade");
      for (const t of RESOURCE_TYPES) {
        if (p.resources[t] - want[t] + give[t] > cfg.storageCap || from.resources[t] - give[t] + want[t] > cfg.storageCap) {
          fail("LIMIT", "That trade would exceed a storage cap");
        }
      }
      for (const t of RESOURCE_TYPES) {
        from.resources[t] += want[t] - give[t];
        p.resources[t] += give[t] - want[t];
      }
      offer.status = "accepted";
      state.stats.tradesCompleted += 1;
      const net = (plus: Resources, minus: Resources): Partial<Resources> =>
        Object.fromEntries(RESOURCE_TYPES.filter((t) => plus[t] - minus[t] !== 0).map((t) => [t, plus[t] - minus[t]]));
      log(state, now, `Trade with ${p.name} completed: you gave ${formatResources(give)} and received ${formatResources(want)}.`, "trade", [from.id], {
        category: "trade",
        actors: [from.id, p.id],
        delta: net(want, give),
        why: "Trades are final once accepted.",
      });
      log(state, now, `You accepted ${from.name}'s trade: you gave ${formatResources(want)} and received ${formatResources(give)}.`, "trade", [p.id], {
        category: "trade",
        actors: [from.id, p.id],
        delta: net(give, want),
        why: "Trades are final once accepted.",
      });
      return;
    }
    case "tradeCancel": {
      const offer = state.trades.find((t) => t.id === cmd.offerId);
      if (!offer || offer.fromId !== p.id) return fail("NOT_FOUND", "Trade offer not found");
      if (offer.status !== "open") fail("INVALID", `That offer is ${offer.status}`);
      offer.status = "cancelled";
      return;
    }
    case "marketExchange": {
      if (cmd.give === cmd.get) fail("INVALID", "Pick two different resources");
      const rate = p.effects.merchantUntil >= state.round ? cfg.marketRateWithCaravan : cfg.marketRate;
      const cost = cmd.amount * rate;
      if (p.resources[cmd.get] + cmd.amount > cfg.storageCap) fail("LIMIT", "That would exceed your storage cap");
      pay(p, { [cmd.give]: cost });
      p.resources[cmd.get] += cmd.amount;
      return;
    }
    case "truceRespond": {
      const offer = state.truceOffers.find((o) => o.toId === p.id);
      if (!offer) return fail("NOT_FOUND", "No truce has been offered to you");
      state.truceOffers = state.truceOffers.filter((o) => o !== offer);
      const from = getPlayer(state, offer.fromId);
      if (cmd.accept) {
        state.truces.push({ a: from.id, b: p.id, untilRound: state.round + 1, brokenBy: [] });
        log(state, now, `${from.name} and ${p.name} have agreed to an Unstable Truce!`, "event");
      } else {
        log(state, now, `${p.name} refused the truce offered by ${from.name}.`, "trade", [from.id, p.id]);
      }
      return;
    }
  }
}

type PlayCmd = Extract<GameCommand, { type: "playCard" }>;

function playInstant(state: MatchState, p: PlayerState, cmd: PlayCmd, now: number): void {
  const card = takeFromHand(p, cmd.cardUid);
  const def = CARDS[card.cardId];
  if (def.timing !== "instant") {
    fail("INVALID", def.timing === "attack" ? `${def.name} is attached to a raid order` : `${def.name} is committed as a defense`);
  }
  const rounds = (def.params.rounds ?? 2) - 1;
  const id: CardId = card.cardId;
  // Validate targets first, then pay, then apply.
  let target: PlayerState | null = null;
  if (def.target === "player") target = rival(state, p, cmd.targetPlayerId);
  let locationId: string | null = null;
  if (def.target === "location") {
    const loc = getLocation(cmd.locationId ?? "");
    if (!isGatherable(loc)) return fail("INVALID", "Choose a resource location");
    locationId = loc.id;
  }
  let evac: Resources | null = null;
  if (id === "emergency_evacuation") {
    evac = fillResources(cmd.evacuate ?? {});
    const n = totalResources(evac);
    if (n <= 0) fail("INVALID", "Choose resources to evacuate");
    if (n > (def.params.maxUnits ?? 8)) fail("LIMIT", `Evacuate at most ${def.params.maxUnits} units`);
  }
  if (id === "unstable_truce" && target) {
    if (state.truceOffers.some((o) => o.toId === target!.id)) fail("LIMIT", `${target.name} is already considering a truce`);
    if (state.truces.some((t) => (t.a === p.id && t.b === target!.id) || (t.b === p.id && t.a === target!.id))) {
      fail("LIMIT", "You already have a truce with that clan");
    }
  }
  pay(p, def.cost);
  if (evac) {
    for (const t of RESOURCE_TYPES) {
      if (p.resources[t] < evac[t]) fail("INSUFFICIENT", `Not enough ${t} to evacuate after paying the cost`);
    }
  }
  removeFromHand(p, card.uid);
  state.discard.push(card);
  state.stats.cardsPlayed += 1;

  switch (id) {
    case "eagle_eye_scout": {
      const t = target!;
      if (counterIntelActive(state, t)) {
        addIntel(state, p.id, t.id, def.name, `${t.name}'s Counter-Intel blinded your eagle.`);
        log(state, now, `Counter-Intel blocked an Eagle-Eye Scout from ${p.name}.`, "private", [t.id]);
        break;
      }
      const raid = state.raids[t.id];
      const text = raid
        ? `${t.name} is raiding ${targetName(state, raid.target)} with ` +
          `${[raid.primary, raid.support].filter((c) => c).map((c) => CARDS[c!.cardId].name).join(" + ") || "no cards"}` +
          ` (+${raid.mercenaryBonus} mercenaries).`
        : `${t.name} has not committed a raid yet.`;
      addIntel(state, p.id, t.id, def.name, text);
      break;
    }
    case "trail_markers":
      p.effects.trail.push({ locationId: locationId!, untilRound: state.round + rounds });
      break;
    case "counter_intel":
      p.effects.counterIntelUntil = state.round + rounds;
      break;
    case "emergency_evacuation":
      for (const t of RESOURCE_TYPES) {
        p.resources[t] -= evac![t];
        p.safeReserve[t] += evac![t];
      }
      break;
    case "merchant_caravan":
      p.effects.merchantUntil = state.round + rounds;
      break;
    case "resource_rush":
      p.effects.rush = { locationId: locationId!, untilRound: state.round + rounds };
      break;
    case "sabotage_supplies":
      target!.effects.sabotagedUntil = state.round + rounds;
      log(state, now, `Someone sabotaged your supplies! Gathering yields -2 for this round and next.`, "private", [target!.id]);
      break;
    case "emergency_rations":
      addResource(state, p, "food", def.params.food ?? 2);
      p.effects.skipUpkeep = true;
      break;
    case "bounty_contract":
      p.effects.bounty = { targetId: target!.id, untilRound: state.round + rounds };
      log(state, now, `${p.name} has posted a Bounty Contract on ${target!.name}!`, "event");
      break;
    case "unstable_truce":
      state.truceOffers.push({ fromId: p.id, toId: target!.id, round: state.round });
      log(state, now, `${p.name} offers ${target!.name} an Unstable Truce.`, "event");
      break;
    default:
      fail("INVALID", `${def.name} cannot be played this way`);
  }
}

interface CommandDescription {
  text: string;
  category: FeedCategory;
  actors?: string[];
  why?: string;
}

const secs = (ms: number) => `${Math.max(1, Math.round(ms / 1000))}s`;

/** Private, factual feed text for the acting player's own successful command. */
function describeCommand(
  state: MatchState,
  p: PlayerState,
  cmd: GameCommand,
  handBefore: Set<string>,
  now: number,
): CommandDescription | null {
  const name = (id: string) => state.players[id]?.name ?? "?";
  switch (cmd.type) {
    case "gather": {
      const party = state.parties[cmd.partyId];
      const loc = getLocation(cmd.locationId);
      if (!party || !loc) return null;
      return {
        text: `You sent a party to ${loc.name}. It arrives in ${secs(party.arriveAt - now)}, gathers for ${secs(loc.gatherMs)}, then walks home; you can spend what it brings once it is home.`,
        category: "gather",
        why: `A party carries at most ${state.config.partyCapacity} units per trip.`,
      };
    }
    case "recall": {
      const party = state.parties[cmd.partyId];
      if (!party) return null;
      return {
        text: party.load > 0 ? `You recalled a party; it is bringing back ${party.load} ${party.resource}.` : "You recalled a party; it returns empty-handed.",
        category: "gather",
        why: "A recalled party keeps only what it gathered before leaving.",
      };
    }
    case "buildBarricade":
      return { text: `You built a barricade: +${p.barricadeDefense} defense until the next raid on your stronghold.`, category: "build" };
    case "repairFort":
      return { text: `You repaired your fort: defense ${p.fortDefense}/${p.fortLevel}.`, category: "build" };
    case "clanGrowth":
      return { text: `Clan growth: fort level ${p.fortLevel}, defense ${p.fortDefense}.`, category: "build" };
    case "recruitMercenaries":
      return { text: `You recruited mercenaries: your next raid gets +${p.mercenaryBonus} attack.`, category: "build" };
    case "trainParty":
      return {
        text: `You trained a new gathering party (${Object.values(state.parties).filter((x) => x.ownerId === p.id).length}/${state.config.maxParties}).`,
        category: "build",
      };
    case "buyCard":
    case "buyMerchantCard": {
      const drawn = p.hand.filter((c) => !handBefore.has(c.uid)).map((c) => CARDS[c.cardId].name);
      return {
        text: drawn.length ? `You bought a card: ${drawn.join(", ")}.` : "You bought a card.",
        category: "card",
      };
    }
    case "marketExchange":
      return { text: `Market exchange: ${cmd.amount} ${cmd.get} received.`, category: "trade" };
    case "scout":
      return { text: `You scouted ${name(cmd.targetPlayerId)}. The report is in your intel.`, category: "card", actors: [p.id, cmd.targetPlayerId] };
    case "playCard": {
      const played = state.discard[state.discard.length - 1];
      const card = played ? CARDS[played.cardId] : null;
      if (!card) return null;
      const on = cmd.targetPlayerId && card.target === "player" ? ` on ${name(cmd.targetPlayerId)}` : cmd.locationId && card.target === "location" ? ` at ${getLocation(cmd.locationId)?.name}` : "";
      return {
        text: `You played ${card.name}${on}.`,
        category: "card",
        actors: card.target === "player" && cmd.targetPlayerId ? [p.id, cmd.targetPlayerId] : [p.id],
        why: card.text,
      };
    }
    case "commitDefense": {
      const id = p.defenseCommitsThisRound[p.defenseCommitsThisRound.length - 1];
      if (!id) return null;
      return {
        text: `You secretly committed ${CARDS[id].name}. Rivals see nothing until a raid hits you.`,
        category: "card",
        why: CARDS[id].text,
      };
    }
    case "commitRaid": {
      const raid = state.raids[p.id];
      if (!raid) return null;
      const target = raid.target.kind === "player" ? name(raid.target.playerId) : (getLocation(raid.target.locationId)?.name ?? "?");
      const cards = [raid.primary, raid.support].filter((c) => c !== null).map((c) => CARDS[c!.cardId].name);
      return {
        text: `You submitted a secret raid on ${target}${cards.length ? ` with ${cards.join(" + ")}` : ""}. It is locked and resolves in Resolution.`,
        category: "raid",
        why: "Only you know the target until the reveal.",
      };
    }
    case "foxfireRetarget": {
      const raid = state.raids[p.id];
      if (!raid) return null;
      const target = raid.target.kind === "player" ? name(raid.target.playerId) : (getLocation(raid.target.locationId)?.name ?? "?");
      return { text: `Change of Heart: your raid now targets ${target}.`, category: "raid" };
    }
    case "useClanAbility":
      return { text: "You called in Protection Money.", category: "event" };
    case "tradeCancel":
      return { text: "You cancelled a trade offer.", category: "trade" };
    default:
      return null;
  }
}

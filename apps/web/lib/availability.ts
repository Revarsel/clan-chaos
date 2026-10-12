import {
  COMMAND_PHASES,
  PHASE_NAMES,
  RESOURCE_TYPES,
  type CardInstance,
  type GameCommandType,
  type PlayerView,
  type Resources,
} from "@clan-chaos/shared";
import { CARDS, COSTS, DEFAULT_CONFIG } from "@clan-chaos/game-content";

/**
 * Advisory "why can't I do this?" checks for the UI. The server re-validates every command and
 * remains the authority; these only read the player's own view plus the shared rule tables.
 */
export type Availability = { ok: true } | { ok: false; reason: string };

const OK: Availability = { ok: true };
const no = (reason: string): Availability => ({ ok: false, reason });

export const RESOURCE_WORD: Record<keyof Resources, string> = { gold: "gold", materials: "materials", food: "food" };

/** Phase/eligibility reason, or null if the command type is allowed right now. */
export function phaseReason(view: PlayerView, type: GameCommandType, now: number): string | null {
  const me = view.players.find((p) => p.id === view.youId);
  if (view.phase === "ended") return "The match is over.";
  if (!view.self) return "Spectators can't take actions.";
  if (me?.eliminated) return "Your clan has been eliminated; you are spectating.";
  if (view.phase === "resolution") return "Orders are locked during Resolution. You can act again when the next round starts.";
  const allowed = COMMAND_PHASES[type];
  if (!allowed.includes(view.phase)) {
    const secs = Math.max(0, Math.ceil((view.phaseEndsAt - now) / 1000));
    return `Only during ${allowed.map((p) => PHASE_NAMES[p]).join(" or ")}${view.phase === "build" && allowed.includes("scheme") ? ` (opens in ${secs}s)` : ""}.`;
  }
  return null;
}

const SOURCES: Record<keyof Resources, string> = { gold: "gold mines", materials: "forests", food: "farms" };

/** "2 more gold and 1 more food", or null when affordable. */
export function missingResources(resources: Resources, cost: Partial<Resources>): string | null {
  const missing = RESOURCE_TYPES.filter((t) => resources[t] < (cost[t] ?? 0)).map((t) => `${(cost[t] ?? 0) - resources[t]} more ${RESOURCE_WORD[t]}`);
  return missing.length ? missing.join(" and ") : null;
}

/** "Needs 2 more gold. Get more from …", or null when affordable. Always says how to recover. */
export function costReason(resources: Resources, cost: Partial<Resources>): string | null {
  const missing = missingResources(resources, cost);
  if (!missing) return null;
  const types = RESOURCE_TYPES.filter((t) => resources[t] < (cost[t] ?? 0));
  return `Needs ${missing}. Get more by gathering at ${types.map((t) => SOURCES[t]).join(" or ")}, the market (Actions) or a trade.`;
}

const combine = (...reasons: (string | null)[]): Availability => {
  const r = reasons.find((x) => x);
  return r ? no(r) : OK;
};

export type EconomyAction = "buyCard" | "recruitMercenaries" | "buildBarricade" | "repairFort" | "clanGrowth" | "trainParty";

export function economyCost(view: PlayerView, action: EconomyAction): Partial<Resources> {
  switch (action) {
    case "buyCard":
      return { gold: view.self?.nextCardCost ?? COSTS.buyCard.gold };
    case "recruitMercenaries":
      return COSTS.recruitMercenaries;
    case "buildBarricade":
      return COSTS.barricade;
    case "repairFort":
      return COSTS.repairFort;
    case "clanGrowth":
      return COSTS.clanGrowth;
    case "trainParty":
      return COSTS.trainParty;
  }
}

export function economyAvailability(view: PlayerView, action: EconomyAction, now: number): Availability {
  const self = view.self;
  const phase = phaseReason(view, action, now);
  if (phase || !self) return no(phase ?? "Unavailable.");
  const parties = view.parties.filter((p) => p.ownerId === view.youId).length;
  let limit: string | null = null;
  switch (action) {
    case "buyCard":
      if (self.hand.length >= self.maxHandSize) limit = `Your hand is full (${self.hand.length}/${self.maxHandSize}). Play or commit a card first.`;
      break;
    case "recruitMercenaries":
      if (self.mercenaryBonus >= DEFAULT_CONFIG.maxMercenaryBonus) limit = `Mercenaries are capped at +${DEFAULT_CONFIG.maxMercenaryBonus} attack.`;
      break;
    case "buildBarricade":
      if (self.barricadeDefense >= DEFAULT_CONFIG.maxBarricadeDefense) limit = `Barricades are capped at +${DEFAULT_CONFIG.maxBarricadeDefense} defense.`;
      break;
    case "repairFort":
      if (self.fortDefense >= self.fortMax) limit = `Your fort is already fully repaired (${self.fortDefense}/${self.fortMax}).`;
      break;
    case "clanGrowth":
      if (self.fortMax >= DEFAULT_CONFIG.fortMax) limit = `Your fort level is already at the maximum of ${DEFAULT_CONFIG.fortMax}.`;
      break;
    case "trainParty":
      if (parties >= DEFAULT_CONFIG.maxParties) limit = `You already have the maximum of ${DEFAULT_CONFIG.maxParties} parties.`;
      break;
  }
  return combine(limit, costReason(self.resources, economyCost(view, action)));
}

export function scoutAvailability(view: PlayerView, targetId: string, now: number): Availability {
  const self = view.self;
  const phase = phaseReason(view, "scout", now);
  if (phase || !self) return no(phase ?? "Unavailable.");
  if (self.scoutedThisRound.includes(targetId)) return no("You already scouted this clan this round.");
  return combine(costReason(self.resources, COSTS.scout));
}

/** Can this card be used right now, and if not, why? */
export function cardAvailability(view: PlayerView, card: CardInstance, now: number): Availability {
  const self = view.self;
  const def = CARDS[card.cardId];
  if (!self) return no("Spectators can't play cards.");
  if (def.timing === "attack") {
    const phase = phaseReason(view, "commitRaid", now);
    if (phase) return no(`Raid cards are attached to a raid order. ${phase}`);
    if (self.raid) return no("Your raid is already submitted this round.");
    return combine(costReason(self.resources, def.cost));
  }
  if (def.timing === "defense") {
    const phase = phaseReason(view, "commitDefense", now);
    if (phase) return no(phase);
    if (self.defenseCommitsThisRound.length >= self.maxDefenseCardsPerRound) {
      return no(`Defense limit reached (${self.defenseCommitsThisRound.length}/${self.maxDefenseCardsPerRound} this round).`);
    }
    if (self.defenseCommitsThisRound.includes(card.cardId)) return no(`${def.name} is already committed this round.`);
    return combine(costReason(self.resources, def.cost));
  }
  const phase = phaseReason(view, "playCard", now);
  if (phase) return no(phase);
  if (def.target === "player" && !view.players.some((p) => p.id !== view.youId && !p.eliminated)) return no("There is no rival to target.");
  return combine(costReason(self.resources, def.cost));
}

export function tradeOfferAvailability(view: PlayerView, now: number): Availability {
  const self = view.self;
  const phase = phaseReason(view, "tradeOffer", now);
  if (phase || !self) return no(phase ?? "Unavailable.");
  if (self.tradesOfferedThisRound >= DEFAULT_CONFIG.maxTradeOffersPerRound) {
    return no(`You have used all ${DEFAULT_CONFIG.maxTradeOffersPerRound} trade offers this round.`);
  }
  return OK;
}

/** Whether accepting an offer would work for *this* player (the other side is checked by the server). */
export function acceptTradeAvailability(view: PlayerView, want: Partial<Resources>, give: Partial<Resources>, now: number): Availability {
  const self = view.self;
  const phase = phaseReason(view, "tradeRespond", now);
  if (phase || !self) return no(phase ?? "Unavailable.");
  const missing = missingResources(self.resources, want);
  if (missing) return no(`You can't pay: you need ${missing}.`);
  for (const t of RESOURCE_TYPES) {
    if (self.resources[t] - (want[t] ?? 0) + (give[t] ?? 0) > self.storageCap) return no(`That would put your ${t} over the ${self.storageCap} cap.`);
  }
  return OK;
}

export function marketAvailability(view: PlayerView, give: keyof Resources, get: keyof Resources, amount: number, rate: number, now: number): Availability {
  const self = view.self;
  const phase = phaseReason(view, "marketExchange", now);
  if (phase || !self) return no(phase ?? "Unavailable.");
  if (give === get) return no("Pick two different resources.");
  if (self.resources[get] + amount > self.storageCap) return no(`That would put your ${get} over the ${self.storageCap} cap.`);
  return combine(costReason(self.resources, { [give]: amount * rate }));
}

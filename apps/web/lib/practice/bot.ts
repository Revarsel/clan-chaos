import type { GameCommand, RaidTarget } from "@clan-chaos/shared";
import { CARDS, MAP_LOCATIONS } from "@clan-chaos/game-content";
import { applyCommand, distance, isGatherable, previewStrongholdRaid, type MatchState } from "@clan-chaos/game-engine";

/**
 * "Training Dummy": a simple, predictable practice opponent. It issues ordinary commands through the
 * real engine (so it obeys every rule and phase restriction) and only looks at information any
 * player could see on the board: forts, barricade presence and where parties are gathering.
 *
 * Round 1 is scripted for the tutorial: it raids your stronghold with no cards, which cannot beat
 * a starting fort, so the reveal shows a failed raid and its gold penalty.
 */

export interface BotMemory {
  builtRound: number;
  schemedRound: number;
  n: number;
}

export const newBotMemory = (): BotMemory => ({ builtRound: 0, schemedRound: 0, n: 0 });

const ORDERS_OPEN = new Set(["build", "scheme"]);

export function botAct(state: MatchState, botId: string, now: number, mem: BotMemory): void {
  const me = state.players[botId];
  if (!me || me.eliminated || !ORDERS_OPEN.has(state.phase)) return;
  const issue = (cmd: GameCommand) => applyCommand(state, botId, `bot-${++mem.n}`, cmd, now).ok;

  // Keep idle parties busy at the nearest site that still has stock.
  const sites = MAP_LOCATIONS.filter((l) => isGatherable(l) && (state.locations[l.id]?.stock ?? 0) > 0).sort(
    (a, b) => distance(me.home, a.position) - distance(me.home, b.position),
  );
  const idle = Object.values(state.parties).filter((p) => p.ownerId === botId && p.status === "idle");
  idle.forEach((party, i) => {
    const site = sites[i % Math.max(1, Math.min(2, sites.length))];
    if (site) issue({ type: "gather", partyId: party.id, locationId: site.id });
  });

  if (state.phase === "build" && mem.builtRound !== state.round) {
    mem.builtRound = state.round;
    if (state.round >= 2) {
      if (me.fortDefense < me.fortLevel) issue({ type: "repairFort" });
      if (state.round % 2 === 0 && me.barricadeDefense === 0) issue({ type: "buildBarricade" });
      if (me.resources.gold >= 6 && me.resources.food >= 4) issue({ type: "recruitMercenaries" });
    }
  }

  if (state.phase === "scheme" && mem.schemedRound !== state.round) {
    mem.schemedRound = state.round;
    const rival = Object.values(state.players).find((p) => p.id !== botId && !p.eliminated);
    if (!rival) return;
    if (state.round === 1) {
      issue({ type: "commitRaid", target: { kind: "player", playerId: rival.id }, priority: "gold" });
      return;
    }
    const attackCard = me.hand.find((c) => CARDS[c.cardId].timing === "attack" && CARDS[c.cardId].slot !== "support" && !CARDS[c.cardId].strongholdOnly);
    const strongholdCard = me.hand.find((c) => CARDS[c.cardId].timing === "attack" && CARDS[c.cardId].slot === "primary");
    const preview = previewStrongholdRaid(me.mercenaryBonus, strongholdCard ? [strongholdCard.cardId] : [], {
      fortDefense: rival.fortDefense,
      hasBarricade: rival.barricadeDefense > 0,
    });
    if (preview.verdict === "beats_visible") {
      issue({ type: "commitRaid", target: { kind: "player", playerId: rival.id }, primaryCardUid: strongholdCard?.uid, priority: "gold" });
      return;
    }
    // Otherwise ambush a site where the rival is gathering, if any.
    const busy = Object.values(state.parties).find((p) => p.ownerId === rival.id && p.status === "gathering" && p.locationId);
    if (busy?.locationId) {
      const target: RaidTarget = { kind: "location", locationId: busy.locationId };
      if (!issue({ type: "commitRaid", target, primaryCardUid: attackCard?.uid, priority: "gold" })) {
        issue({ type: "commitRaid", target, priority: "gold" });
      }
    }
  }
}

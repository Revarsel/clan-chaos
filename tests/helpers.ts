import type { CardId, ClanId, GameCommand } from "@clan-chaos/shared";
import {
  applyCommand,
  createMatch,
  tick,
  type MatchState,
  type PlayerState,
} from "@clan-chaos/game-engine";
import type { MatchConfig } from "@clan-chaos/game-content";

export const T0 = 1_000_000;

export function makeMatch(clans: ClanId[] = ["rats", "toads"], config: Partial<MatchConfig> = {}, seed = "test-seed"): MatchState {
  return createMatch({
    id: "m1",
    seed,
    now: T0,
    players: clans.map((clan, i) => ({ id: `p${i + 1}`, name: `Player${i + 1}`, clan })),
    config,
  });
}

let counter = 0;
export function cmd(state: MatchState, playerId: string, command: GameCommand, now = state.phaseStartedAt + 1) {
  counter += 1;
  return applyCommand(state, playerId, `cmd-${counter}-xxxxxxxx`, command, now);
}

export function player(state: MatchState, id: string): PlayerState {
  return state.players[id] as PlayerState;
}

/** Puts a specific card in a player's hand and returns its uid. */
export function giveCard(state: MatchState, playerId: string, cardId: CardId): string {
  const uid = `test${state.nextUid++}`;
  player(state, playerId).hand.push({ uid, cardId });
  return uid;
}

export function toScheme(state: MatchState): number {
  tick(state, state.phaseEndsAt);
  if (state.phase !== "scheme") throw new Error(`expected scheme, got ${state.phase}`);
  return state.phaseStartedAt + 1;
}

export function toResolution(state: MatchState): void {
  if (state.phase === "build") toScheme(state);
  tick(state, state.phaseEndsAt);
  if (state.phase !== "resolution" && state.phase !== "ended") throw new Error(`expected resolution, got ${state.phase}`);
}

export function toNextRound(state: MatchState): void {
  if (state.phase !== "resolution") toResolution(state);
  if (state.phase === "ended") return;
  tick(state, state.phaseEndsAt);
}

export function setRes(state: MatchState, id: string, gold: number, materials: number, food: number): void {
  player(state, id).resources = { gold, materials, food };
}

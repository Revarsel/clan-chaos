import type { CardId, ClanId, GameCommand, PlayerView } from "@clan-chaos/shared";
import { applyCommand, buildPlayerView, createMatch, tick, type MatchState } from "@clan-chaos/game-engine";
import { botAct, newBotMemory, type BotMemory } from "./bot";

/**
 * A practice match runs the real, unmodified rules engine inside the browser with its own isolated
 * state. It never talks to the game server, so nothing here can affect (or fake) a real match.
 * Time is virtual: it only moves when the caller advances it, so the tutorial can pause and fast-forward.
 */

export const YOU = "you";
export const BOT = "bot";
export const BOT_NAME = "Training Dummy";
/** Cards placed in the player's opening hand so every tutorial step has something to teach with. */
export const TUTORIAL_HAND: CardId[] = ["sneaky_heist", "booby_trap", "eagle_eye_scout"];

const STEP_MS = 250;

export interface PracticeOptions {
  name: string;
  clan?: ClanId;
  seed?: string;
  /** Wall-clock start; virtual time begins here so absolute timestamps look normal. */
  now: number;
}

export type CommandOutcome = { ok: true } | { ok: false; message: string };

export class PracticeMatch {
  readonly state: MatchState;
  /** Virtual "now" in ms. */
  vt: number;
  private bot: BotMemory = newBotMemory();
  private nextId = 1;

  constructor(opts: PracticeOptions) {
    this.vt = opts.now;
    this.state = createMatch({
      id: `practice-${opts.now.toString(36)}`,
      seed: opts.seed ?? "clan-chaos-tutorial",
      players: [
        { id: YOU, name: opts.name.trim() || "You", clan: opts.clan ?? "rats" },
        { id: BOT, name: BOT_NAME, clan: "mushrooms" },
      ],
      now: opts.now,
    });
    seedHand(this.state, YOU, TUTORIAL_HAND);
  }

  view(): PlayerView {
    return buildPlayerView(this.state, YOU, this.vt);
  }

  /** Applies one of the player's commands through the real engine at the current virtual time. */
  send(cmd: GameCommand): CommandOutcome {
    const r = applyCommand(this.state, YOU, `you-${this.nextId++}`, cmd, this.vt);
    tick(this.state, this.vt);
    return r.ok ? { ok: true } : { ok: false, message: r.message ?? "That order was refused." };
  }

  /** Moves virtual time forward in small steps, letting the bot act between steps. */
  advance(ms: number): void {
    const end = this.vt + Math.max(0, ms);
    while (this.vt < end && this.state.phase !== "ended") {
      this.vt = Math.min(end, this.vt + STEP_MS);
      tick(this.state, this.vt);
      // The bot reacts after the tick so it sees a phase change in the same step.
      botAct(this.state, BOT, this.vt, this.bot);
    }
  }

  /** Advances until `pred` holds or `maxMs` of virtual time has passed. Returns whether `pred` held. */
  advanceUntil(pred: (s: MatchState) => boolean, maxMs: number): boolean {
    const end = this.vt + maxMs;
    while (!pred(this.state) && this.vt < end && this.state.phase !== "ended") this.advance(STEP_MS);
    return pred(this.state);
  }

  /** Fast-forwards to the start of the next phase. */
  skipPhase(): void {
    const { round, phase } = this.state;
    this.advanceUntil((s) => s.round !== round || s.phase !== phase, 120_000);
  }
}

/** Puts the wanted cards at the front of a player's hand, swapping with the deck (cards are conserved, never created). */
export function seedHand(state: MatchState, playerId: string, wanted: CardId[]): void {
  const p = state.players[playerId];
  if (!p) return;
  wanted.forEach((cardId, i) => {
    if (i >= p.hand.length || p.hand[i]!.cardId === cardId) return;
    const inHand = p.hand.findIndex((c, k) => k > i && c.cardId === cardId);
    if (inHand >= 0) {
      [p.hand[i], p.hand[inHand]] = [p.hand[inHand]!, p.hand[i]!];
      return;
    }
    const deckIdx = state.deck.findIndex((c) => c.cardId === cardId);
    if (deckIdx < 0) return;
    [p.hand[i], state.deck[deckIdx]] = [state.deck[deckIdx]!, p.hand[i]!];
  });
}

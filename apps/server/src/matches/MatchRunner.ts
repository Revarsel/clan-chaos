import type { GameCommand, PlayerView } from "@clan-chaos/shared";
import {
  applyCommand,
  buildPlayerView,
  createMatch,
  tick,
  type CommandResult,
  type MatchState,
  type NewPlayer,
} from "@clan-chaos/game-engine";
import type { MatchConfig } from "@clan-chaos/game-content";
import type { Persistence } from "../persistence/persistence.js";

export interface MatchRunnerOptions {
  id: string;
  seed: string;
  roomCode: string;
  players: NewPlayer[];
  config: Partial<MatchConfig>;
  persistence: Persistence;
  sessionIds: Record<string, string>;
  /** Called whenever authoritative state changes and views should be pushed. */
  onChange: () => void;
  onFinished: (state: MatchState) => void;
  now?: () => number;
  tickMs?: number;
}

/**
 * Owns one authoritative match. All mutations go through `run`, which executes synchronously on
 * Node's single thread, so commands and ticks for a match are strictly serialised. Persistence
 * writes are chained on a promise queue and never block or reorder gameplay.
 */
export class MatchRunner {
  readonly state: MatchState;
  private timer: NodeJS.Timeout | null = null;
  private persistQueue: Promise<void> = Promise.resolve();
  private readonly now: () => number;
  private finishedHandled = false;

  constructor(private readonly opts: MatchRunnerOptions) {
    this.now = opts.now ?? Date.now;
    this.state = createMatch({ id: opts.id, seed: opts.seed, players: opts.players, now: this.now(), config: opts.config });
    this.persist(() => opts.persistence.matchStarted(this.state, opts.roomCode, opts.seed, opts.sessionIds));
  }

  start(): void {
    this.timer = setInterval(() => this.advance(), this.opts.tickMs ?? 200);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Brings the match up to the current server time. */
  advance(): void {
    const before = { round: this.state.round, phase: this.state.phase };
    const changed = tick(this.state, this.now());
    if (!changed) return;
    this.state.seq += 1;
    this.afterTransition(before);
    this.opts.onChange();
  }

  command(playerId: string, commandId: string, cmd: GameCommand): CommandResult & { seq: number } {
    this.advance();
    const result = applyCommand(this.state, playerId, commandId, cmd, this.now());
    if (result.ok && !result.duplicate) this.opts.onChange();
    return { ...result, seq: this.state.seq };
  }

  setConnected(playerId: string, connected: boolean): void {
    const p = this.state.players[playerId];
    if (!p) return;
    p.connected = connected;
    if (connected) {
      p.disconnectedAt = null;
      p.inactive = false;
    } else {
      p.disconnectedAt = this.now();
    }
    this.state.seq += 1;
    this.opts.onChange();
  }

  viewFor(playerId: string): PlayerView {
    return buildPlayerView(this.state, playerId, this.now());
  }

  get finished(): boolean {
    return this.state.phase === "ended";
  }

  private afterTransition(before: { round: number; phase: string }): void {
    const s = this.state;
    if (before.phase === "scheme" && s.phase !== "scheme" && s.resolutionRound === before.round) {
      const resolutions = s.resolutions;
      this.persist(() => this.opts.persistence.recordEvent(s.id, before.round, "raids_resolved", resolutions));
    }
    if (before.round !== s.round || (s.phase === "ended" && before.phase !== "ended")) {
      const snap = structuredClone(s);
      this.persist(() => this.opts.persistence.recordEvent(snap.id, before.round, "round_end", { round: before.round }));
      this.persist(() => this.opts.persistence.snapshot(snap));
    }
    if (s.phase === "ended" && !this.finishedHandled && s.results) {
      this.finishedHandled = true;
      const results = s.results;
      this.persist(() => this.opts.persistence.matchFinished(s.id, results));
      this.stop();
      this.opts.onFinished(s);
    }
  }

  persist(fn: () => Promise<void>): void {
    this.persistQueue = this.persistQueue.then(fn).catch((err: unknown) => {
      console.error(`[persistence] match ${this.state.id}:`, err instanceof Error ? err.message : err);
    });
  }

  /** Resolves once queued persistence writes have completed (used by tests and shutdown). */
  flush(): Promise<void> {
    return this.persistQueue;
  }
}

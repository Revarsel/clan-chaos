import { PrismaClient, Prisma } from "@prisma/client";
import type { MatchResultsView } from "@clan-chaos/shared";
import type { MatchState } from "@clan-chaos/game-engine";

export interface Persistence {
  readonly enabled: boolean;
  init(): Promise<void>;
  saveSession(s: { id: string; name: string; roomCode: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  touchSession(id: string): Promise<void>;
  matchStarted(state: MatchState, roomCode: string, seed: string, sessionIds: Record<string, string>): Promise<void>;
  recordEvent(matchId: string, round: number, kind: string, payload: unknown): Promise<void>;
  snapshot(state: MatchState): Promise<void>;
  matchFinished(matchId: string, results: MatchResultsView): Promise<void>;
  matchAbandoned(matchId: string): Promise<void>;
  close(): Promise<void>;
}

const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

export class PrismaPersistence implements Persistence {
  readonly enabled = true;
  private db = new PrismaClient();

  async init(): Promise<void> {
    await this.db.$connect();
    await this.db.$queryRaw`SELECT 1`;
    // Matches still "in_progress" belonged to a previous server process: live state was in memory.
    await this.db.match.updateMany({ where: { status: "in_progress" }, data: { status: "abandoned", endedAt: new Date() } });
  }

  async saveSession(s: { id: string; name: string; roomCode: string; tokenHash: string; expiresAt: Date }) {
    await this.db.guestSession.create({ data: s });
  }

  async touchSession(id: string) {
    await this.db.guestSession.updateMany({ where: { id }, data: { lastSeenAt: new Date() } });
  }

  async matchStarted(state: MatchState, roomCode: string, seed: string, sessionIds: Record<string, string>) {
    await this.db.match.create({
      data: {
        id: state.id,
        roomCode,
        status: "in_progress",
        seed,
        config: json(state.config),
        playerCount: state.seatOrder.length,
        participants: {
          create: state.seatOrder.map((pid) => {
            const p = state.players[pid]!;
            return { playerId: p.id, sessionId: sessionIds[p.id] ?? null, name: p.name, clan: p.clan, seat: p.seat };
          }),
        },
      },
    });
  }

  async recordEvent(matchId: string, round: number, kind: string, payload: unknown) {
    await this.db.matchEvent.create({ data: { matchId, round, kind, payload: json(payload) } });
  }

  async snapshot(state: MatchState) {
    const { processed: _p, ...rest } = state;
    await this.db.matchSnapshot.create({
      data: { matchId: state.id, round: state.round, phase: state.phase, state: json(rest) },
    });
  }

  async matchFinished(matchId: string, results: MatchResultsView) {
    await this.db.$transaction([
      this.db.match.update({
        where: { id: matchId },
        data: { status: "finished", endedAt: new Date(), endedReason: results.endedReason },
      }),
      ...results.standings.map((s) =>
        this.db.matchResult.create({
          data: {
            matchId,
            playerId: s.playerId,
            name: s.name,
            clan: s.clan,
            rank: s.rank,
            score: s.score,
            isWinner: s.isWinner,
            eliminated: s.eliminated,
            successfulRaids: s.successfulRaids,
            totalResources: s.totalResources,
            fortDefense: s.fortDefense,
            breakdown: json(s.breakdown),
          },
        }),
      ),
    ]);
  }

  async matchAbandoned(matchId: string) {
    await this.db.match.updateMany({ where: { id: matchId, status: "in_progress" }, data: { status: "abandoned", endedAt: new Date() } });
  }

  async close() {
    await this.db.$disconnect();
  }
}

/** Explicit opt-out (PERSISTENCE=off), used by automated tests. Nothing is stored. */
export class DisabledPersistence implements Persistence {
  readonly enabled = false;
  async init() {}
  async saveSession() {}
  async touchSession() {}
  async matchStarted() {}
  async recordEvent() {}
  async snapshot() {}
  async matchFinished() {}
  async matchAbandoned() {}
  async close() {}
}

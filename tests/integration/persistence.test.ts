import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { MatchRunner } from "../../apps/server/src/matches/MatchRunner";
import { PrismaPersistence } from "../../apps/server/src/persistence/persistence";

if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
const hasDb = !!process.env.DATABASE_URL && process.env.SKIP_DB_TESTS !== "1";

describe.skipIf(!hasDb)("PostgreSQL persistence", () => {
  it("stores the match, participants, events and final results", async () => {
    const persistence = new PrismaPersistence();
    await persistence.init();
    let clock = 1_000_000;
    const id = `m_test_${Date.now()}`;
    const runner = new MatchRunner({
      id,
      seed: "persist-seed",
      roomCode: "TEST01",
      players: [
        { id: `${id}_a`, name: "Alice", clan: "rats" },
        { id: `${id}_b`, name: "Bob", clan: "toads" },
      ],
      config: {},
      persistence,
      sessionIds: {},
      onChange: () => undefined,
      onFinished: () => undefined,
      now: () => clock,
    });
    for (let i = 0; i < 30 && !runner.finished; i++) {
      clock = runner.state.phaseEndsAt;
      runner.advance();
    }
    expect(runner.finished).toBe(true);
    await runner.flush();
    const db = new PrismaClient();
    try {
      const match = await db.match.findUnique({ where: { id }, include: { participants: true, results: true } });
      expect(match?.status).toBe("finished");
      expect(match?.participants).toHaveLength(2);
      expect(match?.results).toHaveLength(2);
      expect(match?.results.some((r) => r.isWinner)).toBe(true);
      const events = await db.matchEvent.count({ where: { matchId: id } });
      expect(events).toBeGreaterThanOrEqual(8);
      const snaps = await db.matchSnapshot.count({ where: { matchId: id } });
      expect(snaps).toBe(8);
      // Post-match feedback: one row per player per match, resubmitting updates it.
      const base = { matchId: id, playerId: `${id}_a`, name: "Alice", clan: "rats", hardest: "", objective: "most points", helped: "" };
      await persistence.saveFeedback({ ...base, confusing: "first answer" });
      await persistence.saveFeedback({ ...base, confusing: "edited answer" });
      const fb = await db.playtestFeedback.findMany({ where: { matchId: id } });
      expect(fb).toHaveLength(1);
      expect(fb[0]!.confusing).toBe("edited answer");
      await db.match.delete({ where: { id } });
    } finally {
      await db.$disconnect();
      await persistence.close();
    }
  });
});

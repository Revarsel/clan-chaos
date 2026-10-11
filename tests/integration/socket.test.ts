import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import type {
  Ack,
  ClientToServerEvents,
  GameCommand,
  LobbyState,
  PlayerView,
  ServerToClientEvents,
  SessionInfo,
} from "@clan-chaos/shared";
import { startGameServer, type GameServerHandle } from "../../apps/server/src/index";
import { DisabledPersistence } from "../../apps/server/src/persistence/persistence";

type Client = Socket<ServerToClientEvents, ClientToServerEvents> & { lobby?: LobbyState; view?: PlayerView };

let server: GameServerHandle;
let url: string;
const clients: Client[] = [];

beforeAll(async () => {
  server = await startGameServer(
    {
      host: "127.0.0.1",
      port: 0,
      corsOrigins: "*",
      persistence: false,
      match: { buildMs: 1200, schemeMs: 1200, resolutionMs: 300, inactiveAfterMs: 500 },
      rateLimits: { joinsPerMinute: 1000, chatPer5s: 5, commandsPerSecond: 100 },
    },
    new DisabledPersistence(),
  );
  url = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  for (const c of clients) c.disconnect();
  await server.close();
});

async function connect(): Promise<Client> {
  const c = ioClient(url, { transports: ["websocket"], forceNew: true }) as Client;
  c.on("lobby:state", (s) => (c.lobby = s));
  c.on("game:state", (v) => (c.view = v));
  clients.push(c);
  await new Promise<void>((resolve) => c.on("connect", () => resolve()));
  return c;
}

function emit<T>(c: Client, event: keyof ClientToServerEvents, payload: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    (c.emit as (e: string, p: unknown, ack: (a: Ack<T>) => void) => void)(event, payload, resolve);
  });
}

let cmdN = 0;
const command = (c: Client, cmd: GameCommand, commandId = `cmd-${++cmdN}-${Date.now()}`) =>
  emit<{ seq: number }>(c, "game:command", { commandId, command: cmd });

async function waitFor(pred: () => boolean, ms = 8000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > ms) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function makeRoom(n: number) {
  const host = await connect();
  const created = await emit<SessionInfo>(host, "room:create", { name: "Host" });
  if (!created.ok) throw new Error(created.message);
  const others: Client[] = [];
  const sessions: SessionInfo[] = [created];
  for (let i = 1; i < n; i++) {
    const c = await connect();
    const joined = await emit<SessionInfo>(c, "room:join", { code: created.roomCode, name: `Guest${i}` });
    if (!joined.ok) throw new Error(joined.message);
    others.push(c);
    sessions.push(joined);
  }
  return { host, others, all: [host, ...others], code: created.roomCode, sessions };
}

async function startMatch(room: Awaited<ReturnType<typeof makeRoom>>) {
  for (const c of room.all) expect((await emit(c, "lobby:setReady", { ready: true })).ok).toBe(true);
  const r = await emit(room.host, "lobby:start", {});
  expect(r.ok).toBe(true);
  await waitFor(() => room.all.every((c) => !!c.view));
}

describe("rooms and lobby", () => {
  it("creates a room with a six-character code and lets others join", async () => {
    const room = await makeRoom(3);
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/);
    await waitFor(() => room.host.lobby?.players.length === 3);
    expect(room.host.lobby!.players.filter((p) => p.isHost)).toHaveLength(1);
  });

  it("rejects invalid and unknown room codes", async () => {
    const c = await connect();
    const bad = await emit(c, "room:join", { code: "abc", name: "X" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe("VALIDATION");
    const missing = await emit(c, "room:join", { code: "ZZZZZZ", name: "X" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");
  });

  it("dedupes duplicate names", async () => {
    const host = await connect();
    const created = await emit<SessionInfo>(host, "room:create", { name: "Sam" });
    if (!created.ok) throw new Error();
    const c = await connect();
    await emit(c, "room:join", { code: created.roomCode, name: "Sam" });
    await waitFor(() => host.lobby?.players.length === 2);
    expect(host.lobby!.players.map((p) => p.name)).toEqual(["Sam", "Sam 2"]);
  });

  it("enforces host permissions and start requirements", async () => {
    const room = await makeRoom(2);
    const notHost = await emit(room.others[0]!, "lobby:start", {});
    expect(notHost.ok).toBe(false);
    if (!notHost.ok) expect(notHost.code).toBe("NOT_HOST");
    const notReady = await emit(room.host, "lobby:start", {});
    expect(notReady.ok).toBe(false);
    if (!notReady.ok) expect(notReady.code).toBe("NOT_READY");
    const kick = await emit(room.others[0]!, "lobby:kick", { playerId: room.sessions[0]!.playerId });
    expect(kick.ok).toBe(false);
  });

  it("requires at least 2 players and caps rooms at 8", async () => {
    const solo = await makeRoom(1);
    await emit(solo.host, "lobby:setReady", { ready: true });
    const r = await emit(solo.host, "lobby:start", {});
    expect(r.ok).toBe(false);
    const full = await makeRoom(8);
    const extra = await connect();
    const j = await emit(extra, "room:join", { code: full.code, name: "Ninth" });
    expect(j.ok).toBe(false);
    if (!j.ok) expect(j.code).toBe("ROOM_FULL");
  });

  it("lets the host kick a player in the lobby", async () => {
    const room = await makeRoom(2);
    let kicked = false;
    room.others[0]!.on("room:kicked", () => (kicked = true));
    expect((await emit(room.host, "lobby:kick", { playerId: room.sessions[1]!.playerId })).ok).toBe(true);
    await waitFor(() => kicked && room.host.lobby?.players.length === 1);
  });

  it("selects clans and syncs readiness across clients", async () => {
    const room = await makeRoom(2);
    await emit(room.others[0]!, "lobby:selectClan", { clan: "foxfire" });
    await emit(room.others[0]!, "lobby:setReady", { ready: true });
    await waitFor(() => room.host.lobby?.players[1]?.clan === "foxfire" && room.host.lobby.players[1].ready);
  });
});

describe("match play over sockets", () => {
  it("prohibits late joining once a match starts", async () => {
    const room = await makeRoom(2);
    await startMatch(room);
    const late = await connect();
    const r = await emit(late, "room:join", { code: room.code, name: "Late" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ROOM_IN_PROGRESS");
  });

  it("validates commands, acknowledges results and dedupes command ids", async () => {
    const room = await makeRoom(2);
    await startMatch(room);
    const bad = await emit(room.host, "game:command", { commandId: "short", command: { type: "buyCard" } });
    expect(bad.ok).toBe(false);
    const unknown = await emit(room.host, "game:command", { commandId: "abcdefgh123", command: { type: "explode" } });
    expect(unknown.ok).toBe(false);
    const id = "dup-command-0001";
    expect((await command(room.host, { type: "buyCard" }, id)).ok).toBe(true);
    expect((await command(room.host, { type: "buyCard" }, id)).ok).toBe(true);
    await waitFor(() => room.host.view?.self?.resources.gold === 6);
    await new Promise((r) => setTimeout(r, 100));
    expect(room.host.view!.self!.resources.gold).toBe(6);
    expect(room.host.view!.self!.hand).toHaveLength(4);
    const tooSoon = await command(room.host, { type: "commitRaid", target: { kind: "player", playerId: room.sessions[1]!.playerId }, priority: "gold" });
    expect(tooSoon.ok).toBe(false);
    if (!tooSoon.ok) expect(tooSoon.code).toBe("WRONG_PHASE");
  });

  it("keeps raid orders secret until the reveal, then resolves simultaneous raids", async () => {
    const room = await makeRoom(3);
    await startMatch(room);
    const [a, b, c] = room.all as [Client, Client, Client];
    const [sa, sb, sc] = room.sessions as [SessionInfo, SessionInfo, SessionInfo];
    await waitFor(() => a.view?.phase === "scheme", 5000);
    const rA = await command(a, { type: "commitRaid", target: { kind: "player", playerId: sc.playerId }, priority: "gold" });
    const rB = await command(b, { type: "commitRaid", target: { kind: "player", playerId: sc.playerId }, priority: "food" });
    expect(rA.ok && rB.ok).toBe(true);
    await waitFor(() => c.view?.players.filter((p) => p.hasCommittedRaid).length === 2);
    const leak = JSON.stringify(c.view);
    expect(c.view!.self!.raid).toBeNull();
    expect(leak).not.toContain('"priority":"food"');
    expect(JSON.stringify(b.view)).not.toContain('"priority":"gold"');
    await waitFor(() => c.view?.phase === "resolution", 5000);
    expect(c.view!.resolutions).toHaveLength(2);
    expect(c.view!.resolutions.every((r) => r.defenderId === sc.playerId)).toBe(true);
    void sa;
    void sb;
  });

  it("handles trade offers, acceptance and rejection with server validation", async () => {
    const room = await makeRoom(2);
    await startMatch(room);
    const [a, b] = room.all as [Client, Client];
    const bId = room.sessions[1]!.playerId;
    expect((await command(a, { type: "tradeOffer", toPlayerId: bId, give: { gold: 50 }, want: { food: 1 } })).ok).toBe(false);
    expect((await command(a, { type: "tradeOffer", toPlayerId: bId, give: { gold: 3 }, want: { food: 2 } })).ok).toBe(true);
    await waitFor(() => (b.view?.trades.length ?? 0) === 1);
    const offer = b.view!.trades[0]!;
    expect((await command(b, { type: "tradeRespond", offerId: offer.id, accept: true })).ok).toBe(true);
    await waitFor(() => a.view?.self?.resources.gold === 7 && a.view.self.resources.food === 8);
    expect(b.view!.self!.resources).toMatchObject({ gold: 13, food: 4 });
    await command(a, { type: "tradeOffer", toPlayerId: bId, give: { gold: 1 }, want: { food: 1 } });
    await waitFor(() => (b.view?.trades.filter((t) => t.status === "open").length ?? 0) === 1);
    const second = b.view!.trades.find((t) => t.status === "open")!;
    expect((await command(b, { type: "tradeRespond", offerId: second.id, accept: false })).ok).toBe(true);
    await waitFor(() => a.view?.trades.find((t) => t.id === second.id)?.status === "rejected");
    await command(a, { type: "tradeOffer", toPlayerId: bId, give: { gold: 1 }, want: {} });
    const fourth = await command(a, { type: "tradeOffer", toPlayerId: bId, give: { gold: 1 }, want: {} });
    expect(fourth.ok).toBe(false); // max 3 offers per round
  });

  it("contested gathering: two clans share one site's stock", async () => {
    const room = await makeRoom(2);
    await startMatch(room);
    const [a, b] = room.all as [Client, Client];
    const ra = await command(a, { type: "gather", partyId: `${room.sessions[0]!.playerId}-p1`, locationId: "dragons_teeth" });
    const rb = await command(b, { type: "gather", partyId: `${room.sessions[1]!.playerId}-p1`, locationId: "dragons_teeth" });
    expect(ra.ok && rb.ok).toBe(true);
    await waitFor(() => (a.view?.parties.filter((p) => p.locationId === "dragons_teeth").length ?? 0) === 2);
    expect(a.view!.parties.find((p) => p.ownerId === room.sessions[1]!.playerId && p.locationId)!.load).toBeNull();
  });

  it("reconnects to the same clan with the token and rejects bad tokens", async () => {
    const room = await makeRoom(2);
    await startMatch(room);
    const guest = room.others[0]!;
    const session = room.sessions[1]!;
    guest.disconnect();
    await waitFor(() => room.host.view?.players.find((p) => p.id === session.playerId)?.connected === false);
    const fresh = await connect();
    const bad = await emit(fresh, "room:resume", { code: room.code, token: "x".repeat(43) });
    expect(bad.ok).toBe(false);
    const ok = await emit<{ playerId: string }>(fresh, "room:resume", { code: room.code, token: session.token });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.playerId).toBe(session.playerId);
    await waitFor(() => fresh.view?.youId === session.playerId);
    expect(room.host.lobby!.players).toHaveLength(2);
    await waitFor(() => room.host.view?.players.find((p) => p.id === session.playerId)?.connected === true);
    expect((await command(fresh, { type: "buyCard" })).ok).toBe(true);
  });

  it("marks long-disconnected players inactive but keeps the match running", async () => {
    const room = await makeRoom(2);
    await startMatch(room);
    const guestId = room.sessions[1]!.playerId;
    room.others[0]!.disconnect();
    await waitFor(() => room.host.view?.players.find((p) => p.id === guestId)?.inactive === true, 4000);
    const round = room.host.view!.round;
    await waitFor(() => (room.host.view?.round ?? 0) > round, 5000);
  });

  it("plays a full 8-round match to completion and returns to the lobby", async () => {
    const room = await makeRoom(3);
    await startMatch(room);
    const [a, b, c] = room.all as [Client, Client, Client];
    const ids = room.sessions.map((s) => s.playerId);
    let lastRound = 0;
    await waitFor(() => {
      const v = a.view;
      if (v && v.phase === "scheme" && v.round !== lastRound) {
        lastRound = v.round;
        void command(a, { type: "commitRaid", target: { kind: "player", playerId: ids[1]! }, priority: "gold" });
        void command(c, { type: "commitRaid", target: { kind: "player", playerId: ids[0]! }, priority: "food" });
      }
      return v?.phase === "ended";
    }, 40_000);
    for (const cl of [a, b, c]) {
      await waitFor(() => cl.view?.phase === "ended");
      expect(cl.view!.results!.standings.length).toBe(3);
    }
    await waitFor(() => a.lobby?.status === "finished");
    expect((await emit(b, "room:returnToLobby", {})).ok).toBe(false);
    expect((await emit(a, "room:returnToLobby", {})).ok).toBe(true);
    await waitFor(() => c.lobby?.status === "lobby");
  }, 60_000);

  it("eliminated players cannot act", async () => {
    const room = await makeRoom(3);
    await startMatch(room);
    const match = server.rooms.get(room.code).match!;
    const victim = match.state.players[room.sessions[2]!.playerId]!;
    victim.eliminated = true;
    const r = await command(room.all[2]!, { type: "buyCard" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ELIMINATED");
    const trade = await command(room.host, { type: "tradeOffer", toPlayerId: victim.id, give: { gold: 1 }, want: {} });
    expect(trade.ok).toBe(false);
  });

  it("broadcasts chat to the room and rate-limits spam", async () => {
    const room = await makeRoom(2);
    const got: string[] = [];
    room.others[0]!.on("chat:message", (m) => got.push(m.text));
    expect((await emit(room.host, "chat:send", { text: "hello" })).ok).toBe(true);
    await waitFor(() => got.includes("hello"));
    const results = [];
    for (let i = 0; i < 8; i++) results.push(await emit(room.host, "chat:send", { text: `spam ${i}` }));
    expect(results.some((r) => !r.ok)).toBe(true);
  });
});

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Ack, SessionInfo } from "@clan-chaos/shared";
import { CLAN_LIST } from "@clan-chaos/game-content";
import { getSocket } from "@/lib/socket";
import { lastName, saveSession } from "@/lib/session";
import { Logo } from "@/components/Logo";

function call(event: "room:create" | "room:join", payload: unknown): Promise<Ack<SessionInfo>> {
  const socket = getSocket();
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, code: "INTERNAL", message: "Can't reach the game server. Is it running on port 4000?" }),
      6000,
    );
    (socket.emit as (e: string, p: unknown, cb: (a: Ack<SessionInfo>) => void) => void)(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    setName(lastName());
    const s = getSocket();
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    s.on("connect", up);
    s.on("connect_error", down);
    s.on("disconnect", down);
    if (s.connected) setOnline(true);
    return () => {
      s.off("connect", up);
      s.off("connect_error", down);
      s.off("disconnect", down);
    };
  }, []);

  async function go(kind: "create" | "join") {
    setError(null);
    if (!name.trim()) return setError("Pick a guest name first.");
    if (kind === "join" && code.trim().length !== 6) return setError("Room codes have six characters.");
    setBusy(kind);
    const ack = await call(kind === "create" ? "room:create" : "room:join", kind === "create" ? { name } : { code, name });
    setBusy(null);
    if (!ack.ok) return setError(ack.message);
    saveSession(ack.roomCode, { playerId: ack.playerId, token: ack.token, name: name.trim() });
    router.push(`/room/${ack.roomCode}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center gap-6 px-4 py-8">
      <Logo />
      <p className="max-w-xl text-center font-display text-lg text-parchment-100">
        Gather. Scheme. Raid your friends. A chaotic 2–8 player clan war that takes about ten minutes.
      </p>

      <div className="grid w-full gap-5 md:grid-cols-2">
        <section className="panel animate-slideUp p-5">
          <h2 className="panel-title mb-3">Enter the fray</h2>
          <label className="mb-1 block text-sm font-semibold text-bark-700" htmlFor="name">
            Guest name
          </label>
          <input
            id="name"
            className="input mb-4"
            maxLength={16}
            placeholder="e.g. Grubnik"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-primary mb-5 w-full py-3 text-base" disabled={!!busy || online === false} onClick={() => go("create")}>
            {busy === "create" ? "Creating…" : "🏰 Create Room"}
          </button>
          <div className="mb-1 text-sm font-semibold text-bark-700">Join with a room code</div>
          <div className="flex gap-2">
            <input
              className="input uppercase tracking-[0.3em]"
              maxLength={6}
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && go("join")}
            />
            <button className="btn-green px-5" disabled={!!busy || online === false} onClick={() => go("join")}>
              {busy === "join" ? "…" : "Join"}
            </button>
          </div>
          {error && <p className="mt-3 rounded-lg bg-ember-500/15 px-3 py-2 text-sm font-semibold text-ember-600">{error}</p>}
          <p className="mt-4 text-xs text-bark-600">
            Server:{" "}
            {online === null ? "connecting…" : online ? <span className="text-moss-600">● online</span> : <span className="text-ember-600">● unreachable</span>}
          </p>
        </section>

        <section className="panel animate-slideUp p-5">
          <h2 className="panel-title mb-3">How to play</h2>
          <ol className="space-y-2 text-sm text-bark-800">
            <li>
              <b>8 rounds</b>, each with <b>Build</b> (30s), <b>Scheme</b> (30s) and <b>Resolution</b> (15s).
            </li>
            <li>
              <b>Gather</b>: send parties to mines 🪙, forests 🪵 and farms 🍖. Contested sites pay more but can be ambushed.
            </li>
            <li>
              <b>Build</b>: barricades, repairs, mercenaries and tactical cards.
            </li>
            <li>
              <b>Scheme</b>: secretly commit one raid per round, plus defensive cards. Attack must <i>beat</i> defense.
            </li>
            <li>
              <b>Score</b>: +2 per successful raid, +3 per fort destroyed, +4 per elimination, event bonuses, an intact fort and
              leftover resources.
            </li>
            <li>Trade, chat and make promises. Nothing stops anyone from breaking them.</li>
          </ol>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {CLAN_LIST.map((c) => (
              <div key={c.id} className="rounded-xl border border-bark-700/30 bg-parchment-50 p-2 text-xs">
                <div className="font-display font-bold">
                  {c.emblem} {c.name}
                </div>
                <div className="text-bark-600">{c.abilityText}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

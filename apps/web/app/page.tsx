"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Ack, SessionInfo } from "@clan-chaos/shared";
import { CLAN_LIST } from "@clan-chaos/game-content";
import { getSocket } from "@/lib/socket";
import { lastName, saveSession } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { RulesSummary } from "@/components/RulesSummary";
import { OnboardingModal, useAutoOnboarding } from "@/components/Onboarding";

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
  const [intro, setIntro] = useAutoOnboarding();

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
          <div className="mt-4 rounded-xl border-2 border-royal-500/30 bg-royal-500/10 p-3 text-sm">
            <div className="font-display font-bold">New here?</div>
            <p className="mb-2 text-bark-700">Learn by playing a short guided match against a bot. It runs in your browser only.</p>
            <div className="flex flex-wrap gap-2">
              <Link className="btn-primary px-4 py-2" href="/practice" data-testid="practice-link">
                🎓 Practice tutorial
              </Link>
              <button className="btn-plain px-4 py-2" onClick={() => setIntro(true)}>
                📖 1-minute intro
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs text-bark-600">
            Server:{" "}
            {online === null ? "connecting…" : online ? <span className="text-moss-600">● online</span> : <span className="text-ember-600">● unreachable</span>}
          </p>
        </section>

        <section className="panel animate-slideUp p-5">
          <h2 className="panel-title mb-3">How to play</h2>
          <RulesSummary />
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
      <OnboardingModal open={intro} onClose={() => setIntro(false)} />
    </main>
  );
}

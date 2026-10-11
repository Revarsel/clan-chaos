"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GameProvider, useGame } from "@/hooks/useGame";
import { lastName, loadSession } from "@/lib/session";
import { Lobby } from "./Lobby";
import { GameScreen } from "./game/GameScreen";
import { Results } from "./game/Results";
import { Toasts } from "./Toasts";
import { Logo } from "./Logo";

export function RoomClient({ code }: { code: string }) {
  return (
    <GameProvider code={code}>
      <RoomBody />
      <Toasts />
    </GameProvider>
  );
}

function RoomBody() {
  const { joined, checked, lobby, view, kicked, code } = useGame();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Centered>Loading…</Centered>;

  if (kicked) {
    return (
      <Centered>
        <p className="mb-4 font-display text-lg">{kicked}</p>
        <Link className="btn-primary" href="/">
          Back home
        </Link>
      </Centered>
    );
  }
  if (!joined) {
    if (!checked && loadSession(code)) return <Centered>Reconnecting to room {code}…</Centered>;
    return <JoinForm />;
  }
  if (view && view.phase === "ended" && view.results) return <Results />;
  if (view && lobby?.status !== "lobby") return <GameScreen />;
  if (lobby) return <Lobby />;
  return <Centered>Loading room…</Centered>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <Logo small />
      <div className="panel max-w-md p-6 text-center font-display text-bark-800">{children}</div>
    </main>
  );
}

function JoinForm() {
  const { code, join, joining, joinError, status } = useGame();
  const [name, setName] = useState("");
  useEffect(() => setName(lastName()), []);
  return (
    <Centered>
      <h2 className="panel-title mb-2">Join room {code}</h2>
      <input className="input mb-3" maxLength={16} placeholder="Guest name" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn-primary w-full" disabled={joining || !name.trim() || status !== "connected"} onClick={() => join(name.trim())}>
        {joining ? "Joining…" : "Join"}
      </button>
      {joinError && <p className="mt-3 text-sm font-semibold text-ember-600">{joinError}</p>}
      {status !== "connected" && <p className="mt-3 text-sm text-bark-600">Connecting to the game server…</p>}
      <Link href="/" className="mt-4 block text-sm text-royal-600 underline">
        Back home
      </Link>
    </Centered>
  );
}

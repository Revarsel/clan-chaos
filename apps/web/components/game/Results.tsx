"use client";
import { useRouter } from "next/navigation";
import { CLANS } from "@clan-chaos/game-content";
import { useGame } from "@/hooks/useGame";
import { Logo } from "../Logo";
import { FeedbackForm } from "./FeedbackForm";

export function Results() {
  const { view, lobby, playerId, emitAck, toast, leave, mode, practice } = useGame();
  const router = useRouter();
  if (!view?.results) return null;
  const r = view.results;
  const winners = r.standings.filter((s) => s.isWinner);
  const isHost = lobby?.hostId === playerId;
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center gap-4 px-4 py-6">
      <Logo small />
      <div className="text-center">
        <div className="font-display text-sm font-bold uppercase tracking-widest text-parchment-200">
          {r.endedReason === "last_clan_standing" ? "Last clan standing!" : "Eight rounds of chaos complete"}
        </div>
        <h2 className="animate-pop font-display text-4xl font-black text-gold-400 md:text-5xl" style={{ textShadow: "0 3px 0 #3d2514" }}>
          🏆 {winners.map((w) => w.name).join(" & ")} {winners.length > 1 ? "share the victory!" : "wins!"}
        </h2>
      </div>
      <section className="panel w-full p-4">
        <h3 className="panel-title mb-2">Final standings</h3>
        <ol className="space-y-2">
          {r.standings.map((s) => (
            <li key={s.playerId} className={`rounded-xl border-2 p-3 ${s.isWinner ? "border-gold-500 bg-gold-300/30" : "border-bark-700/30 bg-parchment-50"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-2xl font-black">#{s.rank}</span>
                <span className="text-xl">{CLANS[s.clan].emblem}</span>
                <span className="font-display text-lg font-bold">
                  {s.name}
                  {s.playerId === playerId && " (you)"}
                </span>
                {s.eliminated && <span className="chip bg-bark-800 text-white">Eliminated</span>}
                <span className="ml-auto font-display text-2xl font-black">{s.score} pts</span>
              </div>
              <div className="mt-1 text-xs text-bark-600">
                Raids won {s.successfulRaids} · Resources {s.totalResources} · Fort {s.fortDefense}
              </div>
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer font-semibold text-royal-600">Why {s.score} points?</summary>
                <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
                  {s.breakdown.length === 0 && <li>No points scored.</li>}
                  {s.breakdown.map((b, i) => (
                    <li key={i}>
                      <b>+{b.points}</b> {b.reason} <span className="text-bark-400">(R{b.round})</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ol>
      </section>
      <section className="panel grid w-full grid-cols-2 gap-2 p-4 text-center font-display sm:grid-cols-4">
        {[
          ["Raids launched", r.stats.raidsLaunched],
          ["Raids succeeded", r.stats.raidsSucceeded],
          ["Trades", r.stats.tradesCompleted],
          ["Cards played", r.stats.cardsPlayed],
        ].map(([label, n]) => (
          <div key={label}>
            <div className="text-3xl font-black">{n}</div>
            <div className="text-xs uppercase text-bark-600">{label}</div>
          </div>
        ))}
      </section>
      {mode === "live" && <FeedbackForm />}
      <div className="flex gap-3">
        {practice ? (
          <button className="btn-primary px-6 py-2.5" onClick={practice.restart}>
            🔁 Practice again
          </button>
        ) : isHost ? (
          <button
            className="btn-primary px-6 py-2.5"
            onClick={async () => {
              const ack = await emitAck("room:returnToLobby", {});
              if (!ack.ok) toast("error", ack.message);
            }}
          >
            🔁 Rematch (back to lobby)
          </button>
        ) : (
          <span className="rounded-xl bg-bark-800/60 px-3 py-2 text-sm text-parchment-100">Waiting for the host to start a rematch…</span>
        )}
        <button
          className="btn-plain"
          onClick={async () => {
            await leave();
            router.push("/");
          }}
        >
          {mode === "practice" ? "Home" : "Leave"}
        </button>
      </div>
    </main>
  );
}

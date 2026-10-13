"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClanId } from "@clan-chaos/shared";
import { CLAN_LIST } from "@clan-chaos/game-content";
import { useGame } from "@/hooks/useGame";
import { lastName } from "@/lib/session";
import { BOT_NAME } from "@/lib/practice/match";
import { tutorialProgress, type Progress } from "@/lib/practice/progress";
import { Logo } from "../Logo";
import { Toasts } from "../Toasts";
import { GameScreen } from "../game/GameScreen";
import { Results } from "../game/Results";
import { PracticeProvider, usePracticeControls } from "./PracticeProvider";
import { TutorialOverlay } from "./TutorialOverlay";

interface Setup {
  name: string;
  clan: ClanId;
  tutorial: boolean;
}

/** /practice: a solo match against a bot, run entirely in this browser with the real rules engine. */
export function PracticeClient() {
  const [mounted, setMounted] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if (!setup) return <PracticeStart onStart={setSetup} />;
  return (
    <PracticeProvider name={setup.name} clan={setup.clan} tutorial={setup.tutorial}>
      <PracticeBody />
      <Toasts />
    </PracticeProvider>
  );
}

function PracticeStart({ onStart }: { onStart: (s: Setup) => void }) {
  const [name, setName] = useState(() => lastName());
  const [clan, setClan] = useState<ClanId>("rats");
  const [done, setDone] = useState<Progress | null>(null);
  useEffect(() => setDone(tutorialProgress()), []);
  const start = (tutorial: boolean) => onStart({ name: name.trim() || "You", clan, tutorial });
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center gap-5 px-4 py-8">
      <Logo small />
      <section className="panel w-full p-5">
        <h1 className="panel-title mb-1">🎓 Practice match</h1>
        <p className="mb-3 text-sm text-bark-700">
          A solo match against <b>{BOT_NAME}</b>, a simple bot. It uses the real rules but runs only in your browser: no room, no server, and nothing
          counts. The guided tutorial walks you through one full round in about 5 minutes, and you can leave it at any time.
        </p>
        {done === "completed" && <p className="mb-3 rounded-lg bg-moss-300/30 px-3 py-1.5 text-sm font-semibold">✅ You have finished the tutorial before.</p>}
        <label className="mb-1 block text-sm font-semibold text-bark-700" htmlFor="practice-name">
          Your name
        </label>
        <input id="practice-name" className="input mb-3" maxLength={16} value={name} placeholder="e.g. Grubnik" onChange={(e) => setName(e.target.value)} />
        <div className="mb-1 text-sm font-semibold text-bark-700">Your clan</div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {CLAN_LIST.map((c) => (
            <button
              key={c.id}
              aria-pressed={clan === c.id}
              onClick={() => setClan(c.id)}
              className={`focus-ring rounded-xl border-2 p-2 text-left text-xs ${clan === c.id ? "border-gold-500 bg-gold-300/30" : "border-bark-700/30 bg-parchment-50"}`}
            >
              <div className="font-display text-sm font-bold">
                {c.emblem} {c.name}
              </div>
              <div className="text-bark-600">{c.abilityName}</div>
            </button>
          ))}
        </div>
        <button className="btn-primary mb-2 w-full py-3 text-base" onClick={() => start(true)} data-testid="start-tutorial">
          🎓 Start the guided tutorial
        </button>
        <button className="btn-plain w-full py-2.5" onClick={() => start(false)} data-testid="start-free">
          ⚔️ Free practice (no tutorial)
        </button>
      </section>
      <Link href="/" className="text-sm font-bold text-parchment-100 underline">
        ← Back home
      </Link>
    </main>
  );
}

function PracticeBody() {
  const { view } = useGame();
  if (view && view.phase === "ended" && view.results) return <Results />;
  return (
    <>
      <PracticeBar />
      <GameScreen />
      <TutorialOverlay />
    </>
  );
}

/** Practice-only controls: the clock can be paused or skipped because nothing here is shared with anyone. */
function PracticeBar() {
  const t = usePracticeControls();
  return (
    <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-1.5 bg-royal-600 px-2 py-1 text-xs text-white md:px-3" data-testid="practice-bar">
      <span className="font-display font-bold">🎓 Practice vs {BOT_NAME}</span>
      <span className="hidden opacity-80 sm:inline">· only in your browser</span>
      <span className="ml-auto" />
      {t.tutorialActive ? (
        <span className="rounded bg-black/20 px-2 py-0.5 font-bold">⏸ Clock paused by the tutorial</span>
      ) : (
        <>
          <button className="focus-ring rounded bg-black/20 px-2 py-0.5 font-bold" onClick={() => t.setPaused(!t.paused)} aria-pressed={t.paused}>
            {t.paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button className="focus-ring rounded bg-black/20 px-2 py-0.5 font-bold" onClick={t.skipPhase}>
            ⏩ Next phase
          </button>
          <button className="focus-ring rounded bg-black/20 px-2 py-0.5 font-bold" onClick={t.restartTutorial}>
            🎓 Restart tutorial
          </button>
        </>
      )}
      <Link className="focus-ring rounded bg-black/20 px-2 py-0.5 font-bold" href="/">
        ✕ Exit
      </Link>
    </div>
  );
}

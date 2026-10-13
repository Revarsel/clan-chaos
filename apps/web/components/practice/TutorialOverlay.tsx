"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TUTORIAL_STEPS } from "@/lib/practice/tutorial";
import { usePracticeControls } from "./PracticeProvider";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** First anchor of the list that is currently rendered and visible. */
function findAnchor(anchors: string[]): HTMLElement | SVGElement | null {
  for (const a of anchors) {
    const els = document.querySelectorAll<HTMLElement | SVGElement>(`[data-tour="${a}"]`);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

/**
 * Guided-tutorial layer: a pulsing ring and arrow over the part of the real game screen being taught,
 * and a small panel with the explanation, the task and Back / Next / Skip controls.
 * The ring ignores pointer events, so the player always interacts with the actual game UI.
 */
export function TutorialOverlay() {
  const t = usePracticeControls();
  const router = useRouter();
  const step = TUTORIAL_STEPS[t.stepIndex]!;
  const [box, setBox] = useState<Box | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scrolledFor = useRef<string | null>(null);

  useEffect(() => {
    setCollapsed(false);
    if (!t.tutorialActive) return;
    const update = () => {
      setSheetOpen(!!document.querySelector('[data-mobile-sheet="open"]'));
      const el = findAnchor(step.anchors);
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      if (scrolledFor.current !== step.id) {
        scrolledFor.current = step.id;
        if (r.top < 90 || r.bottom > window.innerHeight - 60) el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      // Only the on-screen part counts (a long list inside a scrolling sheet can extend far below the screen).
      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, window.innerHeight);
      if (bottom <= top) return setBox(null);
      const next = { top, left: r.left, width: r.width, height: bottom - top };
      setBox((p) => (p && p.top === next.top && p.left === next.left && p.width === next.width && p.height === next.height ? p : next));
    };
    update();
    const id = setInterval(update, 250);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      clearInterval(id);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [step, t.tutorialActive]);

  if (!t.tutorialActive) return null;
  const done = step.done ? step.done(t.ctx) : true;
  const last = t.stepIndex === TUTORIAL_STEPS.length - 1;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  // Keep the panel away from what it points at, and above a phone's bottom sheet when one is open.
  const panelOnTop = sheetOpen || (!!box && box.top + box.height / 2 > vh * 0.5);
  const pad = 6;

  if (collapsed) {
    return (
      <button
        className="btn-primary fixed bottom-16 right-2 z-[72] px-3 py-1.5 text-sm shadow-card lg:bottom-4 lg:right-4"
        onClick={() => setCollapsed(false)}
        aria-label="Show the tutorial"
      >
        🎓 Tutorial {t.stepIndex + 1}/{TUTORIAL_STEPS.length}
      </button>
    );
  }

  return (
    <>
      {box && (
        <>
          <div
            aria-hidden
            data-testid="tutorial-ring"
            className="pointer-events-none fixed z-[71] animate-pulse rounded-xl border-4 border-gold-400"
            style={{
              top: box.top - pad,
              left: box.left - pad,
              width: box.width + pad * 2,
              height: box.height + pad * 2,
              boxShadow: "0 0 0 3px rgba(61,37,20,.85), 0 0 24px 6px rgba(255,196,64,.55)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none fixed z-[71] animate-bounce text-3xl drop-shadow"
            style={{
              left: Math.max(8, Math.min(box.left + box.width / 2 - 14, (typeof window === "undefined" ? 1000 : window.innerWidth) - 36)),
              top: box.top > 70 ? box.top - pad - 38 : box.top + box.height + pad + 2,
            }}
          >
            {box.top > 70 ? "👇" : "👆"}
          </div>
        </>
      )}
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="tutorial-title"
        data-testid="tutorial-panel"
        className={`fixed inset-x-2 z-[72] mx-auto ${sheetOpen ? "max-h-[27dvh]" : "max-h-[34dvh]"} max-w-md overflow-y-auto rounded-2xl border-4 border-bark-800 bg-parchment-50 p-3 text-bark-900 shadow-card lg:inset-x-auto lg:left-4 lg:max-h-[60dvh] lg:w-[420px] ${panelOnTop ? "top-2 lg:top-32" : "bottom-16 lg:bottom-4"}`}
      >
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-bark-500">
          <span>
            🎓 Step {t.stepIndex + 1} of {TUTORIAL_STEPS.length} · {step.lesson}
          </span>
          <button className="focus-ring ml-auto rounded px-1.5 text-base leading-none text-bark-600" onClick={() => setCollapsed(true)} aria-label="Minimise the tutorial">
            –
          </button>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bark-700/15" aria-hidden>
          <div className="h-full bg-gold-500" style={{ width: `${((t.stepIndex + 1) / TUTORIAL_STEPS.length) * 100}%` }} />
        </div>
        <h2 id="tutorial-title" className="mt-1.5 font-display text-lg font-black leading-tight">
          {step.title}
        </h2>
        <p className="mt-1 whitespace-pre-line text-sm" aria-live="polite">
          {step.body(t.ctx)}
        </p>
        {step.task && !done && (
          <p className="mt-2 rounded-lg border-2 border-royal-500/40 bg-royal-500/10 px-2 py-1.5 text-sm font-semibold" data-testid="tutorial-task">
            👉 {step.task(t.ctx)}
          </p>
        )}
        {step.done && done && step.success && (
          <p className="mt-2 rounded-lg border-2 border-moss-500/50 bg-moss-300/30 px-2 py-1.5 text-sm" data-testid="tutorial-success">
            ✅ {step.success(t.ctx)}
          </p>
        )}
        {step.action && (!step.done || !done) && (
          <button className={`${step.done ? "btn-primary" : "btn-plain"} mt-2 w-full py-2`} onClick={() => t.runAction(step.action!.kind)}>
            {step.action.label}
          </button>
        )}
        <p className="mt-2 text-[11px] text-bark-500">⏸ The clock is paused during the tutorial. In a real match it keeps running.</p>
        {last ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-primary flex-1 py-2" onClick={t.next}>
              ▶ Keep practicing
            </button>
            <button
              className="btn-plain flex-1 py-2"
              onClick={() => {
                t.next();
                router.push("/");
              }}
            >
              🏠 Home
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <button className="btn-plain px-3 py-1.5" onClick={t.back} disabled={t.stepIndex === 0}>
              ◀ Back
            </button>
            <button className="focus-ring rounded px-2 py-1.5 text-xs font-bold text-bark-600 underline" onClick={t.skipTutorial}>
              Skip tutorial
            </button>
            <button className={`${done ? "btn-primary" : "btn-plain"} ml-auto px-4 py-1.5`} onClick={t.next} data-testid="tutorial-next">
              {done ? "Next ▶" : "Skip step ▶"}
            </button>
          </div>
        )}
      </section>
    </>
  );
}

"use client";
import { useState } from "react";
import { FEEDBACK_QUESTIONS, type FeedbackAnswers } from "@clan-chaos/shared";
import { useGame } from "@/hooks/useGame";

const empty: FeedbackAnswers = { confusing: "", hardest: "", objective: "", helped: "" };

/** Optional post-match playtest questions. Answers go to the server (stored in PostgreSQL when enabled). */
export function FeedbackForm() {
  const { emitAck } = useGame();
  const [answers, setAnswers] = useState<FeedbackAnswers>(empty);
  const [state, setState] = useState<"idle" | "sending" | "stored" | "logged" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const filled = Object.values(answers).some((v) => v.trim().length > 0);

  const submit = async () => {
    setState("sending");
    setError(null);
    const ack = await emitAck("feedback:submit", answers);
    if (ack.ok) setState(ack.stored ? "stored" : "logged");
    else {
      setState("error");
      setError(ack.message);
    }
  };
  const copy = async () => {
    const text = FEEDBACK_QUESTIONS.map((q) => `${q.question}\n${answers[q.key] || "-"}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy your answers:", text);
    }
  };

  return (
    <section className="panel w-full p-4" aria-labelledby="feedback-title" data-testid="feedback">
      <h3 id="feedback-title" className="panel-title">💬 Quick feedback (optional, about 1 minute)</h3>
      <p className="mb-2 text-xs text-bark-600">Help us make Clan Chaos easier to learn. Skip any question you like.</p>
      {state === "stored" || state === "logged" ? (
        <div className="rounded-lg bg-moss-300/60 p-3 text-sm" role="status">
          <p className="font-bold">Thank you! Your answers were sent.</p>
          {state === "logged" && <p className="text-xs">This server isn&apos;t saving results to a database, so your answers went to the server log. You can also copy them below.</p>}
          <div className="mt-2 flex gap-2">
            <button className="btn-plain px-2 py-0.5 text-xs" onClick={() => setState("idle")}>
              Edit answers
            </button>
            <button className="btn-plain px-2 py-0.5 text-xs" onClick={copy}>
              Copy answers
            </button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {FEEDBACK_QUESTIONS.map((q) => (
            <label key={q.key} className="block text-sm font-semibold">
              {q.question}
              <textarea
                className="input mt-0.5 min-h-[3.5rem] text-sm font-normal"
                maxLength={600}
                value={answers[q.key]}
                onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
              />
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn-primary" disabled={!filled || state === "sending"}>
              {state === "sending" ? "Sending…" : "Send feedback"}
            </button>
            {!filled && <span className="text-xs text-bark-600">Answer at least one question to send.</span>}
          </div>
          {state === "error" && error && (
            <p className="text-sm font-semibold text-ember-600" role="alert">
              Not sent: {error}. Your answers are still here; try again.
            </p>
          )}
        </form>
      )}
    </section>
  );
}

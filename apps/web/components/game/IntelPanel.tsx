"use client";
import type { PlayerView } from "@clan-chaos/shared";

const KIND_STYLE = { info: "", raid: "text-ember-600 font-semibold", event: "text-royal-600 font-semibold", trade: "text-moss-700", private: "text-bark-700 italic" };

export function IntelPanel({ view }: { view: PlayerView }) {
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";
  return (
    <div className="space-y-3">
      <div>
        <div className="panel-title mb-1">🔭 Intel reports</div>
        {view.intel.length === 0 ? (
          <p className="text-xs text-bark-600">Scout a rival (tap their stronghold) or play reconnaissance cards to gather intel.</p>
        ) : (
          <ul className="space-y-1">
            {[...view.intel].reverse().map((i, idx) => (
              <li key={idx} className="rounded-lg bg-royal-400/10 p-2 text-xs">
                <b>
                  R{i.round} · {i.source} on {name(i.aboutId)}:
                </b>{" "}
                {i.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <div className="panel-title mb-1">📜 Chronicle</div>
        <ul className="max-h-72 space-y-0.5 overflow-y-auto text-xs">
          {[...view.log].reverse().map((l, idx) => (
            <li key={idx} className={KIND_STYLE[l.kind]}>
              <span className="text-bark-400">R{l.round}</span> {l.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

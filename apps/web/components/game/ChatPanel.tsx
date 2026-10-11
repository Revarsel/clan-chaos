"use client";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/hooks/useGame";

export function ChatPanel({ className = "" }: { className?: string }) {
  const { chat, emitAck, toast, lobby, playerId } = useGame();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const color = (id: string) => lobby?.players.find((p) => p.id === id)?.color ?? "#3d2514";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat.length]);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    const ack = await emitAck("chat:send", { text: t });
    if (ack.ok) setText("");
    else toast("error", ack.message);
  };

  return (
    <section className={`panel flex min-h-0 flex-col p-3 ${className}`}>
      <h2 className="panel-title mb-2">💬 Clan chatter</h2>
      <div ref={listRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg bg-parchment-50 p-2 text-sm">
        {chat.length === 0 && <p className="text-xs text-bark-500">No messages yet. Threaten someone politely.</p>}
        {chat.map((m) => (
          <div key={m.id} className="break-words">
            <b style={{ color: color(m.fromId) }}>{m.fromId === playerId ? "You" : m.fromName}:</b> {m.text}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        <input
          className="input py-1.5"
          maxLength={200}
          value={text}
          placeholder="Say something…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn-primary" onClick={submit}>
          Send
        </button>
      </div>
    </section>
  );
}

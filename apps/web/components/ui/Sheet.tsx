"use client";
import { useEffect, useRef } from "react";

/** Accessible modal: a bottom sheet on phones, a centred dialog on larger screens. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bark-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-lg animate-slideUp overflow-y-auto rounded-t-2xl border-2 border-bark-800 bg-parchment-100 p-4 shadow-card outline-none sm:rounded-2xl"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="font-display text-lg font-black">{title}</h2>
          <button className="focus-ring rounded-lg px-2 text-xl leading-none text-bark-600" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

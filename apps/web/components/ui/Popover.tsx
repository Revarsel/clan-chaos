"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/**
 * Click/tap-to-open explanation. Works with touch, mouse and keyboard (Enter/Space to open,
 * Escape or outside tap to close). Never relies on hover.
 */
export function Popover({
  trigger,
  label,
  children,
  className = "",
  buttonClassName = "",
  width = 288,
}: {
  trigger: React.ReactNode;
  /** Accessible name of the trigger button. */
  label: string;
  children: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const w = Math.min(width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(b.left + b.width / 2 - w / 2, window.innerWidth - w - 8));
    const below = b.bottom + 6;
    const h = panel.current?.offsetHeight ?? 200;
    const top = below + h > window.innerHeight - 8 && b.top - h - 6 > 8 ? b.top - h - 6 : below;
    setPos({ top, left });
  }, [width]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onMove = () => place();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName || "focus-ring"}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: Math.min(width, typeof window === "undefined" ? width : window.innerWidth - 16) }}
          className="fixed z-[60] animate-pop rounded-xl border-2 border-bark-800 bg-parchment-50 p-3 text-left text-sm font-normal normal-case tracking-normal text-bark-900 shadow-card"
        >
          {children}
        </div>
      )}
    </span>
  );
}

/** Small ⓘ help button with a popover. */
export function InfoTip({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Popover
      label={`What is ${title}?`}
      className={className}
      buttonClassName="focus-ring inline-grid h-5 w-5 place-items-center rounded-full border border-bark-700/50 bg-parchment-50 text-[11px] font-black leading-none text-bark-700 hover:bg-white"
      trigger={<span aria-hidden>i</span>}
    >
      <div className="mb-1 font-display font-black">{title}</div>
      <div className="space-y-1 text-[13px] leading-snug">{children}</div>
    </Popover>
  );
}

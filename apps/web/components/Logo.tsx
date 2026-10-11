export function Logo({ small = false }: { small?: boolean }) {
  const size = small ? "text-2xl" : "text-5xl md:text-6xl";
  return (
    <div className="flex items-center gap-3 select-none">
      <svg viewBox="0 0 64 64" className={small ? "h-8 w-8" : "h-14 w-14 md:h-16 md:w-16"} aria-hidden>
        <path d="M8 54V22l8-6 8 6v-8l8-8 8 8v8l8-6 8 6v32z" fill="#f2b51b" stroke="#3d2514" strokeWidth="4" strokeLinejoin="round" />
        <rect x="26" y="38" width="12" height="16" rx="6" fill="#3d2514" />
        <path d="M32 6V0l10 3-10 3" fill="#f26a2e" stroke="#3d2514" strokeWidth="2" />
      </svg>
      <h1
        className={`${size} font-display font-black tracking-tight text-gold-400`}
        style={{ textShadow: "0 3px 0 #3d2514, 0 6px 12px rgba(0,0,0,0.35)" }}
      >
        Clan <span className="text-ember-400">Chaos</span>
      </h1>
    </div>
  );
}

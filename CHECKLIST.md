# Implementation Checklist

- [x] M1 Foundation: pnpm monorepo, strict TypeScript, Next.js 14 + Tailwind, Socket.IO server, Prisma + PostgreSQL, `/health`, docs
- [x] M2 Lobby & identity: 6-character codes, guest names (duplicates renamed), clan selection, ready status, host start/kick, 2–8 players, hashed reconnect tokens, host handover
- [x] M3 Map & economy: SVG map, parties (idle/traveling/gathering/returning/intercepted), stock and regeneration, recall, storage caps, all economy actions, upkeep, market, trades
- [x] M4 Cards & combat: all 22 cards working and tested, hidden raid orders and defenses, deterministic sequential resolution, ambushes, scouting, all 4 clan abilities
- [x] M5 Match loop: 8 rounds × 3 phases, events after rounds 3/5/7, elimination and spectators, scoring and tie-breakers, results screen, rematch, results saved to PostgreSQL
- [x] M6 Hardening: simulations (2/3/5/8 players), privacy checks, idempotency, reconnect during a match, a full browser playthrough (desktop + mobile) with no console errors

## Known limitations
- Live matches are in memory only. A server restart abandons running matches (they are marked `abandoned` in the database). No crash recovery.
- No HTTPS. Intended for a trusted LAN.
- The browser playthrough was automated in headless Chromium. It was not tested on physical iOS or Android devices.
- Balance values are first guesses (see `docs/balance_decisions.md`) and haven't been tuned through real play.
- Accessibility is basic: keyboard use works for forms and buttons, but the SVG map relies on pointer or touch.
- Rate limits are in-memory and apply to each server process.

import type { MatchConfig } from "@clan-chaos/game-content";

export interface ServerConfig {
  host: string;
  port: number;
  corsOrigins: string[] | "*";
  persistence: boolean;
  match: Partial<MatchConfig>;
}

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const origins = (env.CORS_ORIGINS ?? "*").trim();
  return {
    host: env.SERVER_HOST ?? "0.0.0.0",
    port: num(env.SERVER_PORT, 4000),
    corsOrigins: origins === "*" ? "*" : origins.split(",").map((s) => s.trim()).filter(Boolean),
    persistence: (env.PERSISTENCE ?? "on").toLowerCase() !== "off",
    match: {
      buildMs: num(env.BUILD_SECONDS, 30) * 1000,
      schemeMs: num(env.SCHEME_SECONDS, 30) * 1000,
      resolutionMs: num(env.RESOLUTION_SECONDS, 15) * 1000,
    },
  };
}

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const pkg = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@clan-chaos/shared": pkg("./packages/shared/src/index.ts"),
      "@clan-chaos/game-content": pkg("./packages/game-content/src/index.ts"),
      "@clan-chaos/game-engine": pkg("./packages/game-engine/src/index.ts"),
      "@clan-chaos/server": pkg("./apps/server/src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
  },
});

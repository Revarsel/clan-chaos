import { networkInterfaces } from "node:os";
import { loadConfig } from "./config.js";
import { startGameServer } from "./index.js";

const config = loadConfig();

startGameServer(config)
  .then((server) => {
    console.log(`Clan Chaos server listening on ${config.host}:${server.port}`);
    console.log(`Persistence: ${server.persistence.enabled ? "PostgreSQL" : "DISABLED (PERSISTENCE=off) - results are not stored"}`);
    for (const list of Object.values(networkInterfaces())) {
      for (const n of list ?? []) {
        if (n.family === "IPv4" && !n.internal) console.log(`  LAN address: http://${n.address}:${server.port}`);
      }
    }
    const shutdown = () => {
      console.log("Shutting down...");
      void server.close().then(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  })
  .catch((err: unknown) => {
    console.error("Failed to start the game server.");
    console.error(err instanceof Error ? err.message : err);
    console.error(
      "If PostgreSQL is not reachable, check DATABASE_URL in .env and run `pnpm db:migrate` (see docs/setup.md).\n" +
        "To run without storing results, set PERSISTENCE=off explicitly.",
    );
    process.exit(1);
  });

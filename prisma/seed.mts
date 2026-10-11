// The game needs no seed data: guest sessions and matches are created during play.
// This script checks the database connection and prints a short summary.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const [matches, finished, sessions] = await Promise.all([
  db.match.count(),
  db.match.count({ where: { status: "finished" } }),
  db.guestSession.count(),
]);
console.log(`Database OK: ${matches} matches (${finished} finished), ${sessions} guest sessions.`);
await db.$disconnect();

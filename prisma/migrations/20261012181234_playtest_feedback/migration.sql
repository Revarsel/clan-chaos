-- CreateTable
CREATE TABLE "PlaytestFeedback" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clan" TEXT NOT NULL,
    "confusing" TEXT NOT NULL,
    "hardest" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "helped" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaytestFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaytestFeedback_matchId_playerId_key" ON "PlaytestFeedback"("matchId", "playerId");

-- AddForeignKey
ALTER TABLE "PlaytestFeedback" ADD CONSTRAINT "PlaytestFeedback_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

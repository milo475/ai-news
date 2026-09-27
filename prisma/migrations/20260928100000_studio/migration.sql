-- Промпт студи (/prompt/studio)
CREATE TYPE "StudioFormat" AS ENUM ('IMAGE', 'VIDEO', 'TEXT', 'AUDIO', 'SLIDES');

CREATE TABLE "StudioSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonId" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "format" "StudioFormat" NOT NULL,
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "placement" TEXT,
    "questions" JSONB,
    "answers" JSONB,
    "brief" JSONB,
    "directions" JSONB,
    "direction" INTEGER DEFAULT 0,
    "outputs" JSONB,
    "model" TEXT,
    "costUsd" DECIMAL(10,6),
    "feedback" BOOLEAN,
    "rejected" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioSession_userId_createdAt_idx" ON "StudioSession"("userId", "createdAt");
CREATE INDEX "StudioSession_anonId_createdAt_idx" ON "StudioSession"("anonId", "createdAt");
CREATE INDEX "StudioSession_createdAt_idx" ON "StudioSession"("createdAt");

ALTER TABLE "StudioSession" ADD CONSTRAINT "StudioSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Өдрийн хязгаар
CREATE TABLE "StudioUsage" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,

    CONSTRAINT "StudioUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioUsage_day_subject_key" ON "StudioUsage"("day", "subject");
CREATE INDEX "StudioUsage_day_idx" ON "StudioUsage"("day");

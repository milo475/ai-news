-- Ажлын түгжээ: нэг ажлыг нэг л процесс ажиллуулна
CREATE TABLE "JobLock" (
  "name" TEXT NOT NULL,
  "lockedBy" TEXT NOT NULL,
  "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobLock_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "JobLock_heartbeatAt_idx" ON "JobLock"("heartbeatAt");

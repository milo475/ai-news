-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "improvedAt" TIMESTAMP(3),
ADD COLUMN     "readyAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "JobRun" ADD COLUMN     "mode" TEXT;

-- CreateIndex
CREATE INDEX "Article_status_readyAt_idx" ON "Article"("status", "readyAt");

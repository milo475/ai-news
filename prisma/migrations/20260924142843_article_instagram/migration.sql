-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "igAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "igError" TEXT,
ADD COLUMN     "igMediaId" TEXT,
ADD COLUMN     "igPostedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Article_status_igPostedAt_idx" ON "Article"("status", "igPostedAt");

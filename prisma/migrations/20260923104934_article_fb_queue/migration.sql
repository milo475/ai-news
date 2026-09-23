-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "fbAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fbError" TEXT,
ADD COLUMN     "fbPostedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Article_status_fbPostedAt_idx" ON "Article"("status", "fbPostedAt");

-- Хуучин постуудыг дараалалд буцаж орохоос сэргийлж fbPostedAt-ыг нөхөж бөглөнө
UPDATE "Article"
SET "fbPostedAt" = COALESCE("publishedAt", "updatedAt")
WHERE "fbPostId" IS NOT NULL AND "fbPostedAt" IS NULL;

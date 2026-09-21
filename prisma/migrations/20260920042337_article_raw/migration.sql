-- AlterEnum
ALTER TYPE "ArticleStatus" ADD VALUE 'RAW';

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "sourceAuthor" TEXT,
ADD COLUMN     "sourceExcerpt" TEXT,
ALTER COLUMN "titleMn" DROP NOT NULL,
ALTER COLUMN "summaryMn" DROP NOT NULL,
ALTER COLUMN "bodyMn" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Article_status_createdAt_idx" ON "Article"("status", "createdAt");

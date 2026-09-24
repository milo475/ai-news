-- CreateEnum
CREATE TYPE "ArticleCategory" AS ENUM ('NEWS', 'PROJECT', 'BUSINESS', 'FACT', 'RISK', 'HOWTO');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "category" "ArticleCategory" NOT NULL DEFAULT 'NEWS',
ADD COLUMN     "fbHookType" TEXT,
ADD COLUMN     "fbImageData" BYTEA,
ADD COLUMN     "fbImageKind" TEXT,
ADD COLUMN     "fbImagePrompt" TEXT,
ADD COLUMN     "fbImageUrl" TEXT,
ADD COLUMN     "fbText" TEXT,
ADD COLUMN     "fbTextAlt" TEXT,
ADD COLUMN     "sourceImageUrl" TEXT;

-- AlterTable
ALTER TABLE "JobRun" ADD COLUMN     "costUsd" DECIMAL(10,6);

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "defaultCategory" "ArticleCategory" NOT NULL DEFAULT 'NEWS';

-- CreateTable
CREATE TABLE "FbRankingPost" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "fbPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FbRankingPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FbRankingPost_day_key" ON "FbRankingPost"("day");

-- CreateIndex
CREATE INDEX "Article_status_category_publishedAt_idx" ON "Article"("status", "category", "publishedAt");

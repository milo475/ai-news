-- FB: холбоосыг комментод, уншигчид хандсан асуулт, hashtag-ийн сан, хүрэлтийн тоо
ALTER TABLE "Article" ADD COLUMN "fbQuestion" TEXT;
ALTER TABLE "Article" ADD COLUMN "fbTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Article" ADD COLUMN "fbLinkCommentId" TEXT;
ALTER TABLE "Article" ADD COLUMN "fbComments" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Article" ADD COLUMN "fbReach" INTEGER NOT NULL DEFAULT 0;

-- IG: hashtag-ийн коммент, media insights
ALTER TABLE "Article" ADD COLUMN "igCommentId" TEXT;
ALTER TABLE "Article" ADD COLUMN "igReach" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Article" ADD COLUMN "igLikes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Article" ADD COLUMN "igComments" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Article" ADD COLUMN "igStatsAt" TIMESTAMP(3);

-- 7 хоногийн тайлан нь fbPostedAt-аар шүүдэг
CREATE INDEX "Article_fbPostedAt_idx" ON "Article"("fbPostedAt");

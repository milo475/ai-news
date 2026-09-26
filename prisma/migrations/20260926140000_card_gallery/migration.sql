-- «Өдрийн баримт» галерей (/barimt): FB-ийн reaction/share синк + картын татсан тоо.

ALTER TABLE "Article" ADD COLUMN "fbLikes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Article" ADD COLUMN "fbShares" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Article" ADD COLUMN "fbStatsAt" TIMESTAMP(3);
ALTER TABLE "Article" ADD COLUMN "cardCopies" INTEGER NOT NULL DEFAULT 0;

-- Галерейн cursor pagination нь (fbImageAt DESC, id DESC)-ээр явна
CREATE INDEX "Article_status_fbImageAt_idx" ON "Article"("status", "fbImageAt");

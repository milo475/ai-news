-- CreateEnum
CREATE TYPE "ArticleKind" AS ENUM ('NEWS', 'DIGEST');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "kind" "ArticleKind" NOT NULL DEFAULT 'NEWS';

-- CreateTable
CREATE TABLE "DigestItem" (
    "digestId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "DigestItem_pkey" PRIMARY KEY ("digestId","articleId")
);

-- CreateIndex
CREATE INDEX "DigestItem_digestId_order_idx" ON "DigestItem"("digestId", "order");

-- CreateIndex
CREATE INDEX "Article_kind_status_publishedAt_idx" ON "Article"("kind", "status", "publishedAt");

-- AddForeignKey
ALTER TABLE "DigestItem" ADD CONSTRAINT "DigestItem_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigestItem" ADD CONSTRAINT "DigestItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

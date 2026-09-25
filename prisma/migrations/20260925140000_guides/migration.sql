-- HOWTO гарын авлага (/zaavar) — мөнхийн контент, Google-ээс урт хугацааны траффик.

-- CreateEnum
CREATE TYPE "GuideLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
CREATE TYPE "GuideStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Guide" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lead" TEXT NOT NULL,
    "bodyMd" TEXT NOT NULL,
    "level" "GuideLevel" NOT NULL DEFAULT 'BEGINNER',
    "audience" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usecaseSlug" TEXT,
    "readMinutes" INTEGER NOT NULL DEFAULT 5,
    "heroImageData" BYTEA,
    "heroImagePrompt" TEXT,
    "heroImageAt" TIMESTAMP(3),
    "faq" JSONB NOT NULL DEFAULT '[]',
    "status" "GuideStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "authorUserId" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Guide_pkey" PRIMARY KEY ("id")
);

-- Хайлтын индекс — мэдээтэй ижил 'simple' + unaccent схем.
-- tools нь bodyMd дотор нэрээрээ дурдагддаг тул тусад нь индекслэх шаардлагагүй
-- (array_to_string нь STABLE учир generated column-д ч орохгүй).
ALTER TABLE "Guide" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("title", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("lead", ''))), 'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("bodyMd", ''))), 'C')
  ) STORED;

-- CreateIndex
CREATE UNIQUE INDEX "Guide_slug_key" ON "Guide"("slug");
CREATE INDEX "Guide_status_publishedAt_idx" ON "Guide"("status", "publishedAt");
CREATE INDEX "Guide_level_idx" ON "Guide"("level");
CREATE INDEX "Guide_usecaseSlug_idx" ON "Guide"("usecaseSlug");
CREATE INDEX "Guide_searchVector_idx" ON "Guide" USING GIN ("searchVector");

-- AddForeignKey
ALTER TABLE "Guide" ADD CONSTRAINT "Guide_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bookmark: нийтлэл эсвэл заавар. Хуучин мөрүүд бүгд articleId-тай тул NULL зөвшөөрөхөд аюулгүй.
ALTER TABLE "Bookmark" ALTER COLUMN "articleId" DROP NOT NULL;
ALTER TABLE "Bookmark" ADD COLUMN "guideId" TEXT;

-- Яг нэг нь бөглөгдөнө (Prisma-д илэрхийлэгддэггүй тул гараар)
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_target_check"
  CHECK (num_nonnulls("articleId", "guideId") = 1);

CREATE UNIQUE INDEX "Bookmark_userId_guideId_key" ON "Bookmark"("userId", "guideId");
CREATE INDEX "Bookmark_guideId_idx" ON "Bookmark"("guideId");

ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

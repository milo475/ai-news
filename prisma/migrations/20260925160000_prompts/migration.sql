-- Prompt сан (/prompt) — монгол хэлний prompt-уудын каталог.

-- CreateEnum
CREATE TYPE "PromptCategory" AS ENUM ('AJIL', 'SURGALT', 'BIZNES', 'BICHIH', 'CODE', 'ZURAG', 'ORCHUULGA', 'AMIDRAL', 'BUSAD');
CREATE TYPE "PromptLanguage" AS ENUM ('MN', 'EN', 'MIXED');
CREATE TYPE "PromptSource" AS ENUM ('SITE', 'USER');
CREATE TYPE "PromptStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');

-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "PromptCategory" NOT NULL DEFAULT 'BUSAD',
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" "PromptLanguage" NOT NULL DEFAULT 'MN',
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorUserId" TEXT,
    "source" "PromptSource" NOT NULL DEFAULT 'USER',
    "status" "PromptStatus" NOT NULL DEFAULT 'PENDING',
    "copies" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "topic" TEXT,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromptLike" (
    "userId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptLike_pkey" PRIMARY KEY ("userId", "promptId")
);

CREATE TABLE "PromptReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptReport_pkey" PRIMARY KEY ("id")
);

-- Хайлтын индекс — заавар/мэдээтэй ижил 'simple' + unaccent схем
ALTER TABLE "Prompt" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("title", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("description", ''))), 'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("body", ''))), 'C')
  ) STORED;

-- CreateIndex
CREATE UNIQUE INDEX "Prompt_slug_key" ON "Prompt"("slug");
CREATE INDEX "Prompt_status_publishedAt_idx" ON "Prompt"("status", "publishedAt");
CREATE INDEX "Prompt_category_idx" ON "Prompt"("category");
CREATE INDEX "Prompt_authorUserId_createdAt_idx" ON "Prompt"("authorUserId", "createdAt");
CREATE INDEX "Prompt_topic_idx" ON "Prompt"("topic");
CREATE INDEX "Prompt_searchVector_idx" ON "Prompt" USING GIN ("searchVector");
CREATE INDEX "PromptLike_promptId_idx" ON "PromptLike"("promptId");
CREATE INDEX "PromptReport_promptId_idx" ON "PromptReport"("promptId");
CREATE INDEX "PromptReport_userId_idx" ON "PromptReport"("userId");

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromptLike" ADD CONSTRAINT "PromptLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptLike" ADD CONSTRAINT "PromptLike_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptReport" ADD CONSTRAINT "PromptReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptReport" ADD CONSTRAINT "PromptReport_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bookmark: нийтлэл, заавар эсвэл prompt — яг нэг нь
ALTER TABLE "Bookmark" ADD COLUMN "promptId" TEXT;
ALTER TABLE "Bookmark" DROP CONSTRAINT "Bookmark_target_check";
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_target_check"
  CHECK (num_nonnulls("articleId", "guideId", "promptId") = 1);

CREATE UNIQUE INDEX "Bookmark_userId_promptId_key" ON "Bookmark"("userId", "promptId");
CREATE INDEX "Bookmark_promptId_idx" ON "Bookmark"("promptId");
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

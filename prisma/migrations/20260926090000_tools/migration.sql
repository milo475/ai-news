-- AI хэрэгслийн каталог (/hereglel). Хуучин "AiTool" (жижиг жагсаалт) хэвээр үлдэнэ.

-- CreateEnum
CREATE TYPE "ToolCategory" AS ENUM (
  'CHAT', 'BICHIH', 'ZURAG', 'VIDEO', 'AUDIO', 'CODE', 'OFFICE', 'SURGALT',
  'MARKETING', 'BIZNES', 'ORCHUULGA', 'HAILT', 'AGENT', 'BUSAD'
);
CREATE TYPE "ToolPlan" AS ENUM ('FREE', 'FREEMIUM', 'PAID', 'TRIAL');
CREATE TYPE "MongolianSupport" AS ENUM ('NONE', 'PARTIAL', 'GOOD');
CREATE TYPE "ToolStatus" AS ENUM ('PENDING', 'PUBLISHED');
CREATE TYPE "ToolSource" AS ENUM ('SITE', 'USER');

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "descriptionMd" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "logoData" BYTEA,
    "logoType" TEXT,
    "logoAt" TIMESTAMP(3),
    "categories" "ToolCategory"[] DEFAULT ARRAY[]::"ToolCategory"[],
    "pricing" "ToolPlan" NOT NULL DEFAULT 'FREEMIUM',
    "priceFrom" DOUBLE PRECISION,
    "mongolianSupport" "MongolianSupport" NOT NULL DEFAULT 'PARTIAL',
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mnNoteMd" TEXT,
    "affiliateUrl" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "status" "ToolStatus" NOT NULL DEFAULT 'PENDING',
    "source" "ToolSource" NOT NULL DEFAULT 'USER',
    "submittedByUserId" TEXT,
    "topic" TEXT,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToolReview" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "text" TEXT,
    "status" "ToolStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToolClick" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ToolClick_pkey" PRIMARY KEY ("id")
);

-- Хувилбарууд — тэгш холбоос (Prisma-ийн implicit m2m)
CREATE TABLE "_ToolAlternatives" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE TABLE "_GuideTools" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE TABLE "_PromptTools" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Хайлтын индекс — мэдээ/заавар/prompt-той ижил 'simple' + unaccent схем
ALTER TABLE "Tool" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("tagline", ''))), 'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("descriptionMd", ''))), 'C')
  ) STORED;

-- CreateIndex
CREATE UNIQUE INDEX "Tool_slug_key" ON "Tool"("slug");
CREATE INDEX "Tool_status_publishedAt_idx" ON "Tool"("status", "publishedAt");
CREATE INDEX "Tool_status_upvotes_idx" ON "Tool"("status", "upvotes");
CREATE INDEX "Tool_pricing_idx" ON "Tool"("pricing");
CREATE INDEX "Tool_mongolianSupport_idx" ON "Tool"("mongolianSupport");
CREATE INDEX "Tool_topic_idx" ON "Tool"("topic");
CREATE INDEX "Tool_searchVector_idx" ON "Tool" USING GIN ("searchVector");

CREATE UNIQUE INDEX "ToolReview_toolId_userId_key" ON "ToolReview"("toolId", "userId");
CREATE INDEX "ToolReview_toolId_status_idx" ON "ToolReview"("toolId", "status");
CREATE INDEX "ToolReview_userId_idx" ON "ToolReview"("userId");

CREATE UNIQUE INDEX "ToolClick_toolId_day_key" ON "ToolClick"("toolId", "day");
CREATE INDEX "ToolClick_day_idx" ON "ToolClick"("day");

CREATE UNIQUE INDEX "_ToolAlternatives_AB_unique" ON "_ToolAlternatives"("A", "B");
CREATE INDEX "_ToolAlternatives_B_index" ON "_ToolAlternatives"("B");
CREATE UNIQUE INDEX "_GuideTools_AB_unique" ON "_GuideTools"("A", "B");
CREATE INDEX "_GuideTools_B_index" ON "_GuideTools"("B");
CREATE UNIQUE INDEX "_PromptTools_AB_unique" ON "_PromptTools"("A", "B");
CREATE INDEX "_PromptTools_B_index" ON "_PromptTools"("B");

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ToolReview" ADD CONSTRAINT "ToolReview_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolReview" ADD CONSTRAINT "ToolReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolClick" ADD CONSTRAINT "ToolClick_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_ToolAlternatives" ADD CONSTRAINT "_ToolAlternatives_A_fkey" FOREIGN KEY ("A") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ToolAlternatives" ADD CONSTRAINT "_ToolAlternatives_B_fkey" FOREIGN KEY ("B") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_GuideTools" ADD CONSTRAINT "_GuideTools_A_fkey" FOREIGN KEY ("A") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_GuideTools" ADD CONSTRAINT "_GuideTools_B_fkey" FOREIGN KEY ("B") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PromptTools" ADD CONSTRAINT "_PromptTools_A_fkey" FOREIGN KEY ("A") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PromptTools" ADD CONSTRAINT "_PromptTools_B_fkey" FOREIGN KEY ("B") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bookmark: нийтлэл, заавар, prompt эсвэл хэрэгсэл — яг нэг нь
ALTER TABLE "Bookmark" ADD COLUMN "toolId" TEXT;
ALTER TABLE "Bookmark" DROP CONSTRAINT "Bookmark_target_check";
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_target_check"
  CHECK (num_nonnulls("articleId", "guideId", "promptId", "toolId") = 1);

CREATE UNIQUE INDEX "Bookmark_userId_toolId_key" ON "Bookmark"("userId", "toolId");
CREATE INDEX "Bookmark_toolId_idx" ON "Bookmark"("toolId");
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "RankSource" AS ENUM ('OPENROUTER_USAGE', 'ARENA_ELO', 'AA_INTELLIGENCE');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'REJECTED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameMn" TEXT,
    "website" TEXT,
    "country" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "orPermaslug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameMn" TEXT,
    "descriptionEn" TEXT,
    "descriptionMn" TEXT,
    "companyId" TEXT NOT NULL,
    "isOpenWeights" BOOLEAN NOT NULL DEFAULT false,
    "contextLength" INTEGER,
    "modality" TEXT,
    "releasedAt" TIMESTAMP(3),
    "inputPricePerM" DECIMAL(12,6),
    "outputPricePerM" DECIMAL(12,6),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingSnapshot" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "source" "RankSource" NOT NULL,
    "date" DATE NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(20,4) NOT NULL,
    "rankDelta" INTEGER,
    "scoreDelta" DECIMAL(20,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "feedUrl" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "weight" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "publishedAtSource" TIMESTAMP(3),
    "titleMn" TEXT NOT NULL,
    "summaryMn" TEXT NOT NULL,
    "bodyMn" TEXT NOT NULL,
    "relevance" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "fbPostId" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN,
    "itemsIn" INTEGER NOT NULL DEFAULT 0,
    "itemsOut" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ArticleModels" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleModels_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ArticleCompanies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleCompanies_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_slug_key" ON "AiModel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_orPermaslug_key" ON "AiModel"("orPermaslug");

-- CreateIndex
CREATE INDEX "AiModel_companyId_idx" ON "AiModel"("companyId");

-- CreateIndex
CREATE INDEX "AiModel_isActive_idx" ON "AiModel"("isActive");

-- CreateIndex
CREATE INDEX "RankingSnapshot_source_date_rank_idx" ON "RankingSnapshot"("source", "date", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "RankingSnapshot_modelId_source_date_key" ON "RankingSnapshot"("modelId", "source", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Source_url_key" ON "Source"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Source_feedUrl_key" ON "Source"("feedUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Article_sourceUrl_key" ON "Article"("sourceUrl");

-- CreateIndex
CREATE INDEX "Article_status_publishedAt_idx" ON "Article"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_sourceHash_idx" ON "Article"("sourceHash");

-- CreateIndex
CREATE INDEX "JobRun_job_startedAt_idx" ON "JobRun"("job", "startedAt");

-- CreateIndex
CREATE INDEX "_ArticleModels_B_index" ON "_ArticleModels"("B");

-- CreateIndex
CREATE INDEX "_ArticleCompanies_B_index" ON "_ArticleCompanies"("B");

-- AddForeignKey
ALTER TABLE "AiModel" ADD CONSTRAINT "AiModel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleModels" ADD CONSTRAINT "_ArticleModels_A_fkey" FOREIGN KEY ("A") REFERENCES "AiModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleModels" ADD CONSTRAINT "_ArticleModels_B_fkey" FOREIGN KEY ("B") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleCompanies" ADD CONSTRAINT "_ArticleCompanies_A_fkey" FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleCompanies" ADD CONSTRAINT "_ArticleCompanies_B_fkey" FOREIGN KEY ("B") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Монгол хэлний бенчмарк (/benchmark) — сар бүр топ моделиудыг бодит даалгавраар тестлэнэ.

-- CreateEnum
CREATE TYPE "BenchCategory" AS ENUM (
  'ORCHUULGA_MN_EN', 'ORCHUULGA_EN_MN', 'TOVCHLOL', 'NAIRUULGA', 'ALBAN_BICHIG',
  'OILGOLT', 'BODLOGO', 'SOYOL', 'ZAAVAR_DAGAH', 'JSON_GARGAH'
);
CREATE TYPE "BenchStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED', 'BUDGET');

-- CreateTable
CREATE TABLE "BenchTask" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "BenchCategory" NOT NULL,
    "prompt" TEXT NOT NULL,
    "reference" TEXT,
    "rubric" JSONB NOT NULL DEFAULT '[]',
    "checker" JSONB,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenchTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BenchRun" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "judgeModel" TEXT NOT NULL,
    "judgeModel2" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "BenchStatus" NOT NULL DEFAULT 'RUNNING',
    "note" TEXT,
    "articleId" TEXT,

    CONSTRAINT "BenchRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BenchResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "modelSlug" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputWords" INTEGER NOT NULL DEFAULT 0,
    "judgeScore" DOUBLE PRECISION,
    "judgeNotes" TEXT,
    "judgeScore2" DOUBLE PRECISION,
    "checkerPass" BOOLEAN,
    "humanScore" DOUBLE PRECISION,
    "humanNote" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BenchModelSummary" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "modelSlug" TEXT NOT NULL,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "scoreByCategory" JSONB NOT NULL DEFAULT '{}',
    "avgLatency" INTEGER NOT NULL DEFAULT 0,
    "costPer1kMn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "BenchModelSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BenchTask_slug_key" ON "BenchTask"("slug");
CREATE INDEX "BenchTask_isActive_category_idx" ON "BenchTask"("isActive", "category");
CREATE UNIQUE INDEX "BenchRun_month_key" ON "BenchRun"("month");
CREATE INDEX "BenchRun_status_startedAt_idx" ON "BenchRun"("status", "startedAt");
CREATE UNIQUE INDEX "BenchResult_runId_modelSlug_taskId_key" ON "BenchResult"("runId", "modelSlug", "taskId");
CREATE INDEX "BenchResult_runId_modelSlug_idx" ON "BenchResult"("runId", "modelSlug");
CREATE INDEX "BenchResult_taskId_idx" ON "BenchResult"("taskId");
CREATE UNIQUE INDEX "BenchModelSummary_runId_modelSlug_key" ON "BenchModelSummary"("runId", "modelSlug");
CREATE INDEX "BenchModelSummary_runId_rank_idx" ON "BenchModelSummary"("runId", "rank");

-- AddForeignKey
ALTER TABLE "BenchResult" ADD CONSTRAINT "BenchResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BenchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenchResult" ADD CONSTRAINT "BenchResult_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "BenchTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenchModelSummary" ADD CONSTRAINT "BenchModelSummary_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BenchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Моделийн харьцуулалт (/harits): OpenRouter-ийн нэмэлт талбарууд + дүгнэлтийн кэш.

-- AlterTable — /api/v1/models-ийн бүрэн бус татагдаж байсан талбарууд
ALTER TABLE "AiModel" ADD COLUMN "cachedInputPricePerM" DECIMAL(12,6);
ALTER TABLE "AiModel" ADD COLUMN "inputModalities" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AiModel" ADD COLUMN "outputModalities" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AiModel" ADD COLUMN "tokenizer" TEXT;
ALTER TABLE "AiModel" ADD COLUMN "maxOutputTokens" INTEGER;
ALTER TABLE "AiModel" ADD COLUMN "isModerated" BOOLEAN;

-- CreateTable
CREATE TABLE "AiModelComparison" (
    "id" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "summaryMn" TEXT,
    "generatedAt" TIMESTAMP(3),
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModelComparison_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiModelComparison_pairKey_key" ON "AiModelComparison"("pairKey");
CREATE INDEX "AiModelComparison_views_idx" ON "AiModelComparison"("views");
CREATE INDEX "AiModelComparison_generatedAt_idx" ON "AiModelComparison"("generatedAt");

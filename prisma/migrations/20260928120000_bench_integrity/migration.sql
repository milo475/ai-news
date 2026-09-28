-- Бенчмаркийн бүрэн бүтэн байдал: дэд бүтцийн алдааг моделийн алдаанаас ялгах
ALTER TABLE "BenchResult" ADD COLUMN "errorKind" TEXT;
ALTER TABLE "BenchResult" ADD COLUMN "finishReason" TEXT;
ALTER TABLE "BenchResult" ADD COLUMN "reasoningTokens" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "BenchModelSummary" ADD COLUMN "scored" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BenchModelSummary" ADD COLUMN "infra" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BenchModelSummary" ADD COLUMN "incomplete" BOOLEAN NOT NULL DEFAULT false;

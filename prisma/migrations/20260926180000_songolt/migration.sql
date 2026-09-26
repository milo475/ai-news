-- «Надад ямар AI тохирох вэ?» асуулга (/songolt) — статистик.

CREATE TABLE "QuizDaily" (
    "day" TEXT NOT NULL,
    "starts" INTEGER NOT NULL DEFAULT 0,
    "finishes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuizDaily_pkey" PRIMARY KEY ("day")
);

CREATE TABLE "QuizResult" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "toolSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuizResult_createdAt_idx" ON "QuizResult"("createdAt");
CREATE INDEX "QuizResult_code_idx" ON "QuizResult"("code");

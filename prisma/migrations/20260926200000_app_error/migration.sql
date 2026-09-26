-- Санамсаргүй алдааны бүртгэл (/admin/aldaa)
CREATE TABLE "AppError" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "path" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "fingerprint" TEXT NOT NULL,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppError_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppError_fingerprint_key" ON "AppError"("fingerprint");
CREATE INDEX "AppError_lastAt_idx" ON "AppError"("lastAt");

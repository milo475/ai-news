-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "scoreModel" TEXT,
ADD COLUMN     "scoreReason" TEXT,
ADD COLUMN     "tokensUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "writeModel" TEXT;

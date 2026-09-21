-- CreateEnum
CREATE TYPE "ToolPricing" AS ENUM ('FREE', 'FREEMIUM', 'PAID');

-- CreateTable
CREATE TABLE "UseCase" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameMn" TEXT NOT NULL,
    "descriptionMn" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UseCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTool" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "descriptionMn" TEXT NOT NULL,
    "pricing" "ToolPricing" NOT NULL DEFAULT 'FREEMIUM',
    "worksInMongolian" BOOLEAN NOT NULL DEFAULT true,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UseCaseTool" (
    "useCaseId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "noteMn" TEXT,

    CONSTRAINT "UseCaseTool_pkey" PRIMARY KEY ("useCaseId","toolId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UseCase_slug_key" ON "UseCase"("slug");

-- CreateIndex
CREATE INDEX "UseCase_isActive_order_idx" ON "UseCase"("isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "AiTool_slug_key" ON "AiTool"("slug");

-- CreateIndex
CREATE INDEX "UseCaseTool_useCaseId_rank_idx" ON "UseCaseTool"("useCaseId", "rank");

-- AddForeignKey
ALTER TABLE "UseCaseTool" ADD CONSTRAINT "UseCaseTool_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UseCaseTool" ADD CONSTRAINT "UseCaseTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "AiTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Монголын AI мэдээ (/mongol): region, HTML fetcher-ийн тохиргоо, дотоодын төслүүд.

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('MN', 'GLOBAL');

-- AlterTable — одоо байгаа бүх эх сурвалж GLOBAL
ALTER TABLE "Source" ADD COLUMN "region" "Region" NOT NULL DEFAULT 'GLOBAL';
ALTER TABLE "Source" ADD COLUMN "listUrl" TEXT;
ALTER TABLE "Source" ADD COLUMN "linkSelector" TEXT;

ALTER TABLE "Article" ADD COLUMN "region" "Region" NOT NULL DEFAULT 'GLOBAL';
ALTER TABLE "Article" ADD COLUMN "isLocal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Article_region_status_publishedAt_idx" ON "Article"("region", "status", "publishedAt");

-- CreateTable
CREATE TABLE "MongolProject" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "logoData" BYTEA,
    "logoType" TEXT,
    "logoAt" TIMESTAMP(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MongolProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MongolProject_slug_key" ON "MongolProject"("slug");
CREATE INDEX "MongolProject_isActive_order_idx" ON "MongolProject"("isActive", "order");

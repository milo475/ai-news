-- Студийн хурд, засах давталт, тоо баримтын хяналт
ALTER TABLE "StudioSession" ADD COLUMN "timings" JSONB;
ALTER TABLE "StudioSession" ADD COLUMN "revisions" JSONB;
ALTER TABLE "StudioSession" ADD COLUMN "revisionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StudioSession" ADD COLUMN "strippedNumbers" INTEGER NOT NULL DEFAULT 0;

-- Студийн хэмжилт: эх сурвалж, мэргэжил, дуусгалт, хуулалт
ALTER TABLE "StudioSession" ADD COLUMN "source" TEXT;
ALTER TABLE "StudioSession" ADD COLUMN "campaign" TEXT;
ALTER TABLE "StudioSession" ADD COLUMN "persona" TEXT;
ALTER TABLE "StudioSession" ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudioSession" ADD COLUMN "copied" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "StudioSession_createdAt_source_idx" ON "StudioSession"("createdAt", "source");
CREATE INDEX "StudioSession_createdAt_persona_idx" ON "StudioSession"("createdAt", "persona");

-- Postgres-ийн өөрийн full-text search. Монгол кирилл үсэгт stemmer байхгүй тул
-- 'simple' тохиргоо (үгийг хэвээр нь индекслэнэ) + unaccent (латин үсгийн аяг арилгана).

CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() нь STABLE тул generated column-д шууд орохгүй. Толь бичиг нь
-- өөрчлөгддөггүй учир IMMUTABLE гэж боож өгнө (баримтжуулсан стандарт арга).
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;

-- Нийтлэл: монгол гарчиг A, хураангуй + эх гарчиг B, бие C
ALTER TABLE "Article" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("titleMn", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("summaryMn", ''))), 'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("sourceTitle", ''))), 'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("bodyMn", ''))), 'C')
  ) STORED;

-- Модель: нэр A, slug B. slug дахь "/" ба "-" нь нэг токен болдог тул салгана
-- ("anthropic/claude-opus-5" → anthropic claude opus 5).
ALTER TABLE "AiModel" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("nameMn", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(replace(replace(coalesce("slug", ''), '/', ' '), '-', ' '))), 'B')
  ) STORED;

-- Хэрэгсэл: нэр A, гаргагч B, тайлбар C
ALTER TABLE "AiTool" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("vendor", ''))), 'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("descriptionMn", ''))), 'C')
  ) STORED;

-- Ангилал: хэрэгслийг ангиллынх нь нэрээр ч олдог болгоход хэрэглэнэ ("код бичих")
ALTER TABLE "UseCase" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("nameMn", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("descriptionMn", ''))), 'B')
  ) STORED;

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL,
    "q" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");
CREATE INDEX "AiModel_searchVector_idx" ON "AiModel" USING GIN ("searchVector");
CREATE INDEX "AiTool_searchVector_idx" ON "AiTool" USING GIN ("searchVector");
CREATE INDEX "Article_searchVector_idx" ON "Article" USING GIN ("searchVector");
CREATE INDEX "UseCase_searchVector_idx" ON "UseCase" USING GIN ("searchVector");

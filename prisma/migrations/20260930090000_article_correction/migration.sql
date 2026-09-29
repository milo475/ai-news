-- Нийтлэгдсэний дараа хийсэн засвар: уншигчид ил харагдах тэмдэглэл.
-- «Засвар (2026-09-30): дамжуулсан эх сурвалжийг сэргээв» гэж нийтлэлийн доор гарна.
ALTER TABLE "Article" ADD COLUMN "correctionNote" TEXT;
ALTER TABLE "Article" ADD COLUMN "correctedAt" TIMESTAMP(3);

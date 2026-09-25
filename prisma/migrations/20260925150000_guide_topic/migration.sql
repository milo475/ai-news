-- Захиалсан сэдэв. LLM гарчгийг өөрөө бичдэг тул slug-аас сэдвийг таних боломжгүй —
-- seed давтан ажиллахад давхардахгүй байхад хэрэгтэй.
ALTER TABLE "Guide" ADD COLUMN "topic" TEXT;
CREATE INDEX "Guide_topic_idx" ON "Guide"("topic");

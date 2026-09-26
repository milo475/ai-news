import assert from "node:assert/strict";
import { test } from "node:test";

// DB-гүй орчинд (CI, build) алгасна — бусад .db.test.ts-тэй ижил дүрэм
const hasDb = Boolean(process.env.DATABASE_URL);

test("/api/health — DB ажиллаж байвал 200 ба бүрэн бүтэц", { skip: !hasDb }, async () => {
  const { GET } = await import("../app/api/health/route");
  const { prisma } = await import("../db");

  const res = await GET();
  assert.equal(res.status, 200);

  const body = (await res.json()) as Record<string, any>;
  assert.equal(body.ok, true);
  assert.equal(body.db.ok, true);
  assert.equal(typeof body.db.ms, "number");

  // Дараалалд юу байгаа
  assert.equal(typeof body.queue.raw, "number");
  assert.equal(typeof body.queue.readyDrafts, "number");
  assert.equal(typeof body.errors, "number");

  // Сүүлийн ажиллалтууд — байхгүй ажил бол null
  for (const job of ["openrouter", "rss", "agent", "publish", "pipeline"]) {
    assert.ok(job in body.lastRuns, job);
  }

  await prisma.$disconnect();
});

test("/api/health — кэшлэгдэхгүй (dynamic)", { skip: !hasDb }, async () => {
  const { dynamic } = await import("../app/api/health/route");
  assert.equal(dynamic, "force-dynamic");
});

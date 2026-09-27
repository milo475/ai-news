import { test } from "node:test";
import assert from "node:assert/strict";
import type { DigestSource } from "./digest.api";

// digest.ts нь prisma-г ачаалдаг тул DATABASE_URL шаардана
const hasDb = Boolean(process.env.DATABASE_URL);

const items: DigestSource[] = [
  { slug: "a", titleMn: "Нэгдүгээр мэдээ", summaryMn: "Хураангуй A", relevance: 9, sourceName: "S1" },
  { slug: "b", titleMn: "Хоёрдугаар мэдээ", summaryMn: "Хураангуй B", relevance: 8, sourceName: "S2" },
  { slug: "c", titleMn: "Гуравдугаар мэдээ", summaryMn: "Хураангуй C", relevance: 7, sourceName: "S3" },
];

function truncationError(): Error {
  const e = new Error("OpenRouter chat: хариу таслагдсан (max_tokens=8000 хүрэлцэхгүй)") as Error & {
    truncated?: boolean;
  };
  e.truncated = true;
  return e;
}

test("writeDigest: нэг дуудлага бүтвэл хэсэгчлэхгүй", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const { writeDigest } = await import("./digest");
  let calls = 0;

  const chat = (async () => {
    calls++;
    return {
      data: {
        titleMn: "AI-ийн долоо хоног", leadMn: "Тойм.",
        sections: [{ heading: "Нэг", body: "Бие." }, { heading: "Хоёр", body: "Бие 2." }],
        nextWeek: ["1", "2", "3"],
      },
      tokens: 100, costUsd: 0.01,
    };
  }) as never;

  const r = await writeDigest("9/21–9/27", items, chat);
  assert.equal(calls, 1, "нэг л дуудлага");
  assert.equal(r.data.sections.length, 2);
  assert.equal(r.tokens, 100);
});

test("writeDigest: тасарвал бүтэц + хэсэг тус бүрээр бичүүлнэ", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const { writeDigest } = await import("./digest");
  const seen: { maxTokens: number; system: string }[] = [];
  let calls = 0;

  const chat = (async (opts: { maxTokens: number; system: string }) => {
    calls++;
    seen.push({ maxTokens: opts.maxTokens, system: opts.system });

    // 1-р дуудлага: бүтэн тойм — тасарна
    if (calls === 1) throw truncationError();
    // 2-р дуудлага: бүтэц
    if (calls === 2) {
      return {
        data: {
          titleMn: "AI-ийн долоо хоног: 9/21–9/27",
          leadMn: "Долоо хоногийн тойм.",
          sections: [
            { heading: "Моделиуд", slugs: ["a", "зохиомол"] },
            { heading: "Бизнес", slugs: ["b"] },
          ],
          nextWeek: ["1", "2", "3"],
        },
        tokens: 200, costUsd: 0.002,
      };
    }
    // Дараагийнх нь хэсгийн бие
    return { data: { body: `Хэсгийн бие ${calls - 2}.` }, tokens: 300, costUsd: 0.003 };
  }) as never;

  const r = await writeDigest("9/21–9/27", items, chat);

  // 1 (тасарсан) + 1 (бүтэц) + 2 (хэсэг)
  assert.equal(calls, 4);
  assert.equal(r.data.titleMn, "AI-ийн долоо хоног: 9/21–9/27");
  assert.deepEqual(r.data.sections.map((s) => s.heading), ["Моделиуд", "Бизнес"]);
  assert.deepEqual(r.data.sections.map((s) => s.body), ["Хэсгийн бие 1.", "Хэсгийн бие 2."]);
  assert.equal(r.tokens, 200 + 300 + 300, "тасарсан дуудлагын токен тоологдохгүй");

  // Хэсэгчилсэн дуудлагууд нь жижиг хязгаартай
  assert.ok(seen[1]!.maxTokens < seen[0]!.maxTokens, "бүтцийн дуудлага бага байх ёстой");
  assert.ok(seen[2]!.maxTokens < seen[0]!.maxTokens);
  assert.match(seen[1]!.system, /зөвхөн БҮТЦИЙГ/);
  assert.match(seen[2]!.system, /зөвхөн НЭГ хэсгийн/);
});

test("writeDigest: тасралтаас БУСАД алдааг дамжуулна", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const { writeDigest } = await import("./digest");
  let calls = 0;
  const chat = (async () => {
    calls++;
    throw new Error("сүлжээ тасарлаа");
  }) as never;

  await assert.rejects(() => writeDigest("9/21–9/27", items, chat), /сүлжээ тасарлаа/);
  assert.equal(calls, 1, "хэсэгчилсэн горимд шилжих ёсгүй");
});

import { test } from "node:test";
import assert from "node:assert/strict";

// card.ts нь prisma-г ачаалдаг
const hasDb = Boolean(process.env.DATABASE_URL);

/** Буудалцааны жишээ — эх мэдээ нь буруутгал */
const ARTICLE = {
  id: "test-article-1",
  titleMn: "Муж ChatGPT-ийг буудалцаанд хүргэсэн гэж үзэн OpenAI-г шүүхэд өгчээ",
  summaryMn:
    "Нэгэн мужийн прокурор ChatGPT-тэй хийсэн харилцан яриа сургууль дээрх буудалцаанд " +
    "нөлөөлсөн гэж үзэн OpenAI компанийг шүүхэд өгсөн байна.",
  bodyMn: "Прокурорын мэдэгдлээр 40 хуудас нотлох баримт бүрдүүлжээ.",
  category: "RISK" as const,
};

const hook = (text: string, n = 9) => ({ text, surprise: n, relevance: n, clarity: n });

test(
  "writeHeadline: үнэн зөв биш хувилбарыг алгасаж дараагийнхыг авна",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const { writeHeadline } = await import("./card");
    const BAD = "Сургууль дээрх халдлагад хүүхдийн ашигладаг чатбот 40 хувь нөлөөлжээ.";
    const GOOD = "Чатботын яриа халдлагад хүргэсэн гэж үзэн муж 40 хуудас нотлох баримт бүрдүүлжээ.";

    const chat = (async (o: { schema: { properties: Record<string, unknown> } }) => {
      // Гарчиг үүсгэх дуудлага
      if ("hooks" in o.schema.properties) {
        return { data: { hooks: [hook(BAD, 10), hook(GOOD, 7)] }, tokens: 0, costUsd: 0 };
      }
      // Fidelity шүүгч — хоёр дахь дуудлагад ирнэ
      return { data: { faithful: true, issues: [] }, tokens: 0, costUsd: 0 };
    }) as never;

    const r = await writeHeadline(ARTICLE, { chat });
    // BAD нь оноо өндөр ч «хүүхдийн ашигладаг» гэж нэмсэн, ишлэлгүй → механикаар унана
    assert.equal(r.headline, GOOD, "оноо нь үнэн зөвөөс давуу байж болохгүй");
  },
);

test(
  "writeHeadline: бүх хувилбар унавал нийтлэлийн гарчгийг ашиглана",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const { writeHeadline } = await import("./card");
    let hookCalls = 0;

    const chat = (async (o: { schema: { properties: Record<string, unknown> } }) => {
      if ("hooks" in o.schema.properties) {
        hookCalls++;
        // Бүгд ишлэлгүй — механик шалгалт бүгдийг хаана
        return {
          data: { hooks: [hook("Чатбот 40 хувь нөлөөлжээ."), hook("Чатбот 50 хувь нөлөөлжээ.")] },
          tokens: 0, costUsd: 0,
        };
      }
      return { data: { faithful: true, issues: [] }, tokens: 0, costUsd: 0 };
    }) as never;

    const r = await writeHeadline(ARTICLE, { chat });
    assert.equal(hookCalls, 2, "нэг удаа санал авч дахин оролдоно");
    // Нийтлэлийн өөрийн гарчиг (урт нь картад багтахаар таслагдсан)
    assert.ok(ARTICLE.titleMn.startsWith(r.headline.replace(/…$/, "").trim()));
    assert.ok(r.headline.length <= 110);
  },
);

test(
  "writeHeadline: тоогүй нийтлэлд тоо шаардахгүй (Dario-гийн карт)",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const { writeHeadline } = await import("./card");
    const OPINION = {
      id: "test-article-2",
      titleMn: "Dario Amodei зохицуулалтын талаар байр сууриа илэрхийлэв",
      summaryMn: "Anthropic-ийн тэргүүн хиймэл оюуны зохицуулалт хэрэгтэй гэж үзэж байгаагаа хэлэв.",
      bodyMn: null,
      category: "NEWS" as const,
    };
    const H = "Зохицуулалтгүй бол эрсдэл нэмэгдэнэ гэж Anthropic-ийн тэргүүн анхааруулав.";

    const chat = (async (o: { schema: { properties: Record<string, unknown> }; user: string }) => {
      if ("hooks" in o.schema.properties) {
        assert.match(o.user, /тоо БҮҮ зохио/, "тоогүй нийтлэлд заавар өгөх ёстой");
        return { data: { hooks: [hook(H)] }, tokens: 0, costUsd: 0 };
      }
      return { data: { faithful: true, issues: [] }, tokens: 0, costUsd: 0 };
    }) as never;

    const r = await writeHeadline(OPINION, { chat });
    assert.equal(r.headline, H, "тоогүй ч гарчиг давах ёстой");
  },
);

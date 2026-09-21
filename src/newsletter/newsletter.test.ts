import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, resetRateLimit } from "./rate-limit";
import { extractSections, renderDigestEmail, stripMarkdown } from "./template";

const BODY = `## Шинэ моделиуд

[Эхний мэдээ](/medee/a) гарлаа. **Чухал** үйл явдал.

Хоёр дахь догол мөр.

## Зохицуулалт

Гурав дахь мэдээ.

## Жагсаалтын өөрчлөлт

- Топ 10-д шинээр орсон: GLM

## Энэ digest-д орсон мэдээ

- [Эхний мэдээ](/medee/a) — TechCrunch`;

test("stripMarkdown: холбоос, тодруулгыг энгийн текст болгоно", () => {
  assert.equal(stripMarkdown("[Гарчиг](/medee/a) нь **чухал**."), "Гарчиг нь чухал.");
  assert.equal(stripMarkdown("- нэг\n- хоёр"), "нэг хоёр");
});

test("extractSections: автомат хэсгүүдийг имэйлд оруулахгүй", () => {
  const s = extractSections(BODY);
  assert.deepEqual(s.map((x) => x.heading), ["Шинэ моделиуд", "Зохицуулалт"]);
  assert.equal(s[0]!.text, "Эхний мэдээ гарлаа. Чухал үйл явдал.");
  assert.equal(extractSections(BODY, 1).length, 1);
  assert.deepEqual(extractSections(""), []);
});

test("template: unsubscribe холбоос заавал байна", () => {
  const mail = renderDigestEmail({
    title: "AI-ийн долоо хоног: 9/15–9/21",
    lead: "Энэ долоо хоногт хоёр том модель гарлаа.",
    sections: extractSections(BODY),
    url: "https://ainews.mn/medee/digest-1",
    unsubscribeUrl: "https://ainews.mn/api/newsletter/unsubscribe?token=abc123",
  });
  assert.equal(mail.subject, "AI-ийн долоо хоног: 9/15–9/21");
  for (const part of [mail.html, mail.text]) {
    assert.ok(part.includes("https://ainews.mn/api/newsletter/unsubscribe?token=abc123"), "unsubscribe холбоосгүй");
    assert.ok(part.includes("https://ainews.mn/medee/digest-1"), "нийтлэлийн холбоосгүй");
    assert.ok(part.includes("Шинэ моделиуд"), "сэдэв алга");
  }
  assert.ok(mail.html.includes("ainews.mn"), "footer алга");
  assert.ok(!mail.html.includes("<script"), "script орсон байна");
});

test("template: HTML тэмдэгтийг escape хийнэ", () => {
  const mail = renderDigestEmail({
    title: '<script>alert(1)</script> & "тест"',
    lead: "", sections: [], url: "https://x/y", unsubscribeUrl: "https://x/u",
  });
  assert.ok(!mail.html.includes("<script>alert"), "escape хийгдээгүй");
  assert.ok(mail.html.includes("&lt;script&gt;"), "escape буруу");
});

test("rateLimit: цагт 5 удаа", () => {
  resetRateLimit();
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) assert.equal(rateLimit("ip-a", 5, 3_600_000, t0 + i), true, `${i}-р оролдлого`);
  assert.equal(rateLimit("ip-a", 5, 3_600_000, t0 + 5), false, "6 дахь нь хаагдах ёстой");
  // Өөр IP хамаарахгүй
  assert.equal(rateLimit("ip-b", 5, 3_600_000, t0 + 6), true);
  // Цонх өнгөрвөл дахин боломжтой
  assert.equal(rateLimit("ip-a", 5, 3_600_000, t0 + 3_600_001), true);
});

// ---- DB-тэй интеграц (DATABASE_URL байхгүй бол алгасна) ----
const dbTest = { skip: process.env.DATABASE_URL ? false : "DATABASE_URL алга" };
const TEST_EMAIL = "newsletter-test@example.invalid";

test("бүртгэл: subscribe → confirm → unsubscribe", dbTest, async () => {
  const { prisma } = await import("../db");
  const { subscribe, confirm, unsubscribe } = await import("./subscribe");
  await prisma.subscriber.deleteMany({ where: { email: TEST_EMAIL } });

  const r1 = await subscribe(TEST_EMAIL);
  assert.equal(r1.ok, true);
  const pending = await prisma.subscriber.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
  assert.equal(pending.status, "PENDING");
  assert.ok(pending.confirmToken, "confirmToken үүсээгүй");
  assert.ok(pending.unsubscribeToken, "unsubscribeToken үүсээгүй");

  assert.equal(await confirm(pending.confirmToken!), true);
  const active = await prisma.subscriber.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
  assert.equal(active.status, "ACTIVE");
  assert.equal(active.confirmToken, null, "токен цэвэрлэгдээгүй");
  assert.ok(active.confirmedAt);

  assert.equal(await unsubscribe(active.unsubscribeToken), true);
  const gone = await prisma.subscriber.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
  assert.equal(gone.status, "UNSUBSCRIBED");

  assert.equal(await confirm("bhgui-token"), false);
  assert.equal(await unsubscribe("bhgui-token"), false);
  await prisma.subscriber.deleteMany({ where: { email: TEST_EMAIL } });
});

test("бүртгэл: давхардсан имэйл алдаа биш, буруу хаяг татгалзана", dbTest, async () => {
  const { prisma } = await import("../db");
  const { subscribe } = await import("./subscribe");
  await prisma.subscriber.deleteMany({ where: { email: TEST_EMAIL } });

  await subscribe(TEST_EMAIL);
  const first = await prisma.subscriber.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
  const again = await subscribe(TEST_EMAIL);
  assert.equal(again.ok, true, "давхардал алдаа болох ёсгүй");
  const second = await prisma.subscriber.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
  assert.notEqual(second.confirmToken, first.confirmToken, "токен шинэчлэгдээгүй");
  assert.equal(await prisma.subscriber.count({ where: { email: TEST_EMAIL } }), 1, "давхар мөр үүссэн");

  assert.equal((await subscribe("mail")).ok, false);
  assert.equal((await subscribe("")).ok, false);
  await prisma.subscriber.deleteMany({ where: { email: TEST_EMAIL } });
});

test("илгээлт: dry-run илгээхгүй, Resend-ийг mock-оор солино", dbTest, async () => {
  const { prisma } = await import("../db");
  const { runNewsletter } = await import("./send");

  // Тестийн өөрийн digest ба бүртгэл — дараа нь цэвэрлэнэ
  const source = await prisma.source.findFirstOrThrow({ select: { id: true } });
  const slug = `test-digest-${Date.now()}`;
  const digest = await prisma.article.create({
    data: {
      kind: "DIGEST", status: "PUBLISHED", publishedAt: new Date(), slug,
      sourceId: source.id, sourceUrl: `internal:test:${slug}`,
      sourceTitle: "test", sourceHash: slug,
      titleMn: "Тестийн тойм", summaryMn: "Тестийн lead.", bodyMn: BODY,
    },
    select: { id: true },
  });
  const sub = await prisma.subscriber.create({
    data: { email: TEST_EMAIL, status: "ACTIVE", unsubscribeToken: `t-${Date.now()}`, confirmedAt: new Date() },
  });

  try {
    const dry = await runNewsletter({ dryRun: true });
    assert.equal(dry.reason, "dry-run");
    assert.equal(dry.sent, 0, "dry-run илгээсэн байна");
    assert.ok(dry.recipients >= 1, "хүлээн авагч олдсонгүй");
    assert.equal(await prisma.newsletterSend.count({ where: { digestArticleId: digest.id } }), 0,
      "dry-run бүртгэл үүсгэсэн байна");

    // Mock илгээгч — сүлжээ хэрэггүй
    const seen: { to: string; html: string }[] = [];
    const r = await runNewsletter({
      sender: async (mails) => {
        seen.push(...mails.map((m) => ({ to: m.to, html: m.html })));
        return { sent: mails.length, failed: 0 };
      },
    });
    assert.equal(r.skipped, false);
    assert.ok(seen.some((m) => m.to === TEST_EMAIL), "тест хаяг руу яваагүй");
    assert.ok(seen[0]!.html.includes(sub.unsubscribeToken), "unsubscribe токен имэйлд алга");

    // Хоёр дахь удаа — давхар илгээхгүй
    const again = await runNewsletter({ sender: async () => ({ sent: 99, failed: 0 }) });
    assert.equal(again.skipped, true);
    assert.equal(again.reason, "аль хэдийн илгээсэн");
  } finally {
    await prisma.newsletterSend.deleteMany({ where: { digestArticleId: digest.id } });
    await prisma.article.delete({ where: { id: digest.id } });
    await prisma.subscriber.deleteMany({ where: { email: TEST_EMAIL } });
  }
});

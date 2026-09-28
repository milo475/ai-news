import { test } from "node:test";
import assert from "node:assert/strict";
import {
  altTextFor, BIO_LINE, buildCaption, buildHashtags, checkCaption, checkHashtags,
  hashtagComment, IG_BROAD_HASHTAGS, IG_NICHE_HASHTAGS, igUserId, MAX_ALT_CHARS,
  MAX_CAPTION_CHARS, MAX_HASHTAGS, MAX_IG_ATTEMPTS, MAX_TOPIC_HASHTAGS, MIN_HASHTAGS,
  publicImageUrl,
  breakdown, IG_MAX_AGE_HOURS, queueLabel, tooOldForIg,
} from "./instagram.api";
import { postToInstagram } from "./instagram";

const FB_TEXT = [
  "Хуулийн фирмүүдийн 40 хувь нь ажлынхаа хэсгийг машинд даалгаж эхэлжээ.",
  "Шинэ шийдэл нь байгууллагын нууц мэдээллийг гадагш гаргалгүй ажиллах боломж олгож байна. " +
    "Энэ нь өмнө нь үнэтэй мэргэжилтэн шаарддаг байсан ажлыг хямдруулна.",
  "Та ажилдаа AI ашигладаг уу?",
  "Холбоос коммент дээр.",
  "#AI #ХиймэлОюун #хууль",
].join("\n\n");

test("igUserId / publicImageUrl", () => {
  assert.equal(igUserId({}), null);
  assert.equal(igUserId({ IG_USER_ID: "  " }), null);
  assert.equal(igUserId({ IG_USER_ID: "17841400000000000" }), "17841400000000000");

  assert.equal(publicImageUrl("abc123", "https://ainews.mn/"), "https://ainews.mn/api/fb-image/abc123");
  assert.equal(publicImageUrl("abc123", undefined), "http://localhost:3000/api/fb-image/abc123");
});

test("buildCaption: холбоосын мөрийг bio-гийн мөрөөр солино, hashtag орохгүй", () => {
  const caption = buildCaption(FB_TEXT);
  assert.ok(!caption.includes("https://"), "холбоос үлдсэн");
  assert.ok(!caption.includes("Дэлгэрэнгүй: "), "хуучин мөр үлдсэн");
  assert.ok(!caption.includes("Холбоос коммент дээр"), "FB-ийн мөр үлдсэн");
  assert.ok(!caption.includes("#"), "hashtag нь эхний комментод явна");
  assert.ok(caption.includes(BIO_LINE));
  // Биет ба уншигчид хандсан асуулт хэвээр
  assert.ok(caption.startsWith("Хуулийн фирмүүдийн 40 хувь"));
  assert.ok(caption.includes("нууц мэдээллийг гадагш гаргалгүй"));
  assert.ok(caption.includes("Та ажилдаа AI ашигладаг уу?"));
});

test("buildHashtags: 12–15 ширхэг, гурван давхарга, сэдвийнх нь эхэлнэ", () => {
  const tags = buildHashtags(["#хууль", "#зохицуулалт", "OpenAI", "GPT-6 Astra", "илүү"]);

  assert.ok(tags.length >= MIN_HASHTAGS && tags.length <= MAX_HASHTAGS, `${tags.length} hashtag`);
  // (в) сэдвийн — дээд тал нь 4, эхэнд
  assert.deepEqual(tags.slice(0, MAX_TOPIC_HASHTAGS), ["#хууль", "#зохицуулалт", "#OpenAI", "#GPT6Astra"]);
  // (б) niche ба (а) өргөн хоёулаа орсон
  assert.ok(IG_NICHE_HASHTAGS.every((t) => tags.some((x) => x.toLowerCase() === t)), "niche дутуу");
  assert.ok(tags.some((t) => IG_BROAD_HASHTAGS.includes(t.toLowerCase())), "өргөн давхарга дутуу");
  // Кирилл ба латин хоёулаа
  assert.ok(tags.some((t) => /[а-яөү]/i.test(t)), "кирилл алга");
  assert.ok(tags.some((t) => /^#[a-z]/i.test(t)), "латин алга");
  assert.equal(new Set(tags.map((t) => t.toLowerCase())).size, tags.length, "давхардсан");
});

test("buildHashtags: сэдвийн шошго байхгүй ч 12-т хүрнэ", () => {
  const tags = buildHashtags([]);
  assert.ok(tags.length >= MIN_HASHTAGS, `${tags.length} hashtag`);
  assert.deepEqual(checkHashtags(tags), []);
});

test("buildHashtags: давхардсан сэдвийн шошго niche-тэй нэгдэхгүй", () => {
  const tags = buildHashtags(["#ai", "#AI", "#Chatgpt"]);
  assert.equal(tags.filter((t) => t.toLowerCase() === "#ai").length, 1);
  assert.equal(tags.filter((t) => t.toLowerCase() === "#chatgpt").length, 1);
});

test("hashtagComment: зөвхөн hashtag, зайгаар", () => {
  assert.equal(hashtagComment(["#a", "#b"]), "#a #b");
});

test("altTextFor: headline-аас, урт бол таслана", () => {
  assert.equal(
    altTextFor("Хиймэл оюун 5 хүн тутмын 1-ийн цагийг хэмжиж байна"),
    "AI News картын зураг. Хиймэл оюун 5 хүн тутмын 1-ийн цагийг хэмжиж байна",
  );
  assert.equal(altTextFor(null, "Нөөц гарчиг"), "AI News картын зураг. Нөөц гарчиг");
  assert.equal(altTextFor(null, null), null);
  assert.equal(altTextFor("  "), null);
  assert.equal(altTextFor("Гарчиг 🚀"), "AI News картын зураг. Гарчиг");
  assert.equal(altTextFor("х".repeat(MAX_ALT_CHARS + 50))!.length, MAX_ALT_CHARS);
});

test("buildCaption: emoji хасагдана, 2200 тэмдэгтэд багтана", () => {
  const withEmoji = buildCaption("Гарчиг 🚀\n\nБиет 😀 текст.\n\nДэлгэрэнгүй: https://a.mn/b\n\n#тест");
  assert.ok(!/[\p{Extended_Pictographic}]/u.test(withEmoji));

  const long = buildCaption(
    [`Гарчиг`, "Урт ".repeat(900), "Дэлгэрэнгүй: https://a.mn/b", "#тест"].join("\n\n"),
  );
  assert.ok(long.length <= MAX_CAPTION_CHARS, `${long.length} тэмдэгт`);
  assert.ok(long.includes(BIO_LINE), "bio мөр үлдэнэ");
});

test("checkCaption: зөрчлийг барина", () => {
  assert.deepEqual(checkCaption(buildCaption(FB_TEXT)), []);

  const codes = (c: string) => checkCaption(c).map((p) => p.code);
  assert.ok(codes("Текст 🚀").includes("emoji"));
  assert.ok(codes("Текст #AI #Монгол").includes("has-hashtag"), "hashtag caption-д байх ёсгүй");
  assert.ok(codes("Текст https://a.mn").includes("has-link"));
  assert.ok(codes("у".repeat(2_300)).includes("too-long"));
});

test("checkHashtags: 12–15-ийн хүрээ", () => {
  assert.deepEqual(checkHashtags(buildHashtags(["#a", "#b", "#c"])), []);
  assert.deepEqual(checkHashtags(["#a", "#b"]).map((p) => p.code), ["few-hashtags"]);
  assert.deepEqual(
    checkHashtags(Array.from({ length: 20 }, (_, i) => `#t${i}`)).map((p) => p.code),
    ["many-hashtags"],
  );
});

// ---------- HTTP mock: 2 алхамт нийтлэлт ----------

interface Call { url: string; body?: Record<string, string> }

/** Graph API-г дуурайх fetch: media → status (2 удаа IN_PROGRESS) → media_publish */
function fakeGraph(statuses: string[], opts: { failAt?: string } = {}) {
  const calls: Call[] = [];
  const queue = [...statuses];
  const fetchImpl = (async (url: string, init?: { body?: URLSearchParams }) => {
    const body = init?.body ? Object.fromEntries(init.body as unknown as URLSearchParams) : undefined;
    calls.push({ url, body });

    if (opts.failAt && url.includes(opts.failAt)) {
      return { ok: false, status: 400, json: async () => ({ error: { message: "Тестийн алдаа" } }) };
    }
    if (url.includes("/media_publish")) return { ok: true, status: 200, json: async () => ({ id: "IG_MEDIA_1" }) };
    if (url.includes("/comments")) return { ok: true, status: 200, json: async () => ({ id: "IG_COMMENT_1" }) };
    if (url.includes("/media")) return { ok: true, status: 200, json: async () => ({ id: "CREATION_1" }) };
    return { ok: true, status: 200, json: async () => ({ status_code: queue.shift() ?? "FINISHED" }) };
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}

test("postToInstagram: media → status poll → media_publish", async () => {
  process.env.IG_USER_ID = "17841400000000000";
  process.env.FB_PAGE_ACCESS_TOKEN = "TOKEN";
  const slept: number[] = [];
  const { fetchImpl, calls } = fakeGraph(["IN_PROGRESS", "IN_PROGRESS", "FINISHED"]);

  const r = await postToInstagram(
    "https://ainews.mn/api/fb-image/a1",
    "caption",
    { fetchImpl, sleep: async (ms) => { slept.push(ms); } },
    { altText: "alt текст", hashtags: ["#a", "#b"] },
  );

  assert.equal(r.igMediaId, "IG_MEDIA_1");
  assert.equal(r.commentId, "IG_COMMENT_1");
  assert.ok(calls[0]!.url.endsWith("/17841400000000000/media"));
  assert.equal(calls[0]!.body?.image_url, "https://ainews.mn/api/fb-image/a1");
  assert.equal(calls[0]!.body?.caption, "caption");
  assert.equal(calls[0]!.body?.alt_text, "alt текст", "alt_text дамжаагүй");

  const polls = calls.filter((c) => c.url.includes("fields=status_code"));
  assert.equal(polls.length, 3, "FINISHED болтол шалгана");
  assert.deepEqual(slept, [3000, 3000], "3 сек тутам");

  const publish = calls.find((c) => c.url.endsWith("/media_publish"))!;
  assert.equal(publish.body?.creation_id, "CREATION_1");

  // Hashtag нь ПОСТЛОСНЫ ДАРАА коммент болж явна
  const comment = calls.at(-1)!;
  assert.ok(comment.url.includes("/IG_MEDIA_1/comments"));
  assert.equal(comment.body?.message, "#a #b");
});

test("postToInstagram: hashtag-ийн коммент унасан ч пост үлдэнэ", async () => {
  process.env.IG_USER_ID = "17841400000000000";
  process.env.FB_PAGE_ACCESS_TOKEN = "TOKEN";
  const { fetchImpl } = fakeGraph(["FINISHED"], { failAt: "/comments" });

  const r = await postToInstagram(
    "https://a.mn/i.jpg", "caption",
    { fetchImpl, sleep: async () => {} },
    { hashtags: ["#a"] },
  );
  assert.equal(r.igMediaId, "IG_MEDIA_1");
  assert.equal(r.commentId, null);
});

test("postToInstagram: контейнер ERROR бол алдаа шидэнэ", async () => {
  process.env.IG_USER_ID = "17841400000000000";
  process.env.FB_PAGE_ACCESS_TOKEN = "TOKEN";
  const { fetchImpl, calls } = fakeGraph(["ERROR"]);

  await assert.rejects(
    postToInstagram("https://a.mn/i.jpg", "caption", { fetchImpl, sleep: async () => {} }),
    /контейнер ERROR/,
  );
  assert.ok(!calls.some((c) => c.url.includes("/media_publish")), "нийтлэх алхам хүрэхгүй");
});

test("postToInstagram: Graph алдааны текстийг дамжуулна", async () => {
  process.env.IG_USER_ID = "17841400000000000";
  process.env.FB_PAGE_ACCESS_TOKEN = "TOKEN";
  const { fetchImpl } = fakeGraph(["FINISHED"], { failAt: "/media" });

  await assert.rejects(
    postToInstagram("https://a.mn/i.jpg", "caption", { fetchImpl, sleep: async () => {} }),
    /Instagram 400: Тестийн алдаа/,
  );
});

test("postToInstagram: IG_USER_ID байхгүй бол алдаа", async () => {
  delete process.env.IG_USER_ID;
  await assert.rejects(postToInstagram("https://a.mn/i.jpg", "c", { fetchImpl: fetch }), /IG_USER_ID/);
  assert.equal(MAX_IG_ATTEMPTS, 3);
});

// ---------- Дараалал (2026-09-27: «0 постлосон, алдаа 0, дараалалд 6») ----------

const NOW = new Date("2026-09-27T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

test("36 цагаас хуучин мэдээг IG-д тавихгүй", () => {
  assert.equal(tooOldForIg(hoursAgo(1), NOW), false);
  assert.equal(tooOldForIg(hoursAgo(35), NOW), false);
  assert.equal(tooOldForIg(hoursAgo(37), NOW), true);
  // Огноогүй бол хасахгүй — мэдэхгүй гэдэг нь хуучин гэсэн үг биш
  assert.equal(tooOldForIg(null, NOW), false);
  assert.equal(IG_MAX_AGE_HOURS, 36);
});

test("дараалал яагаад постлогдохгүй байгааг ангилна", () => {
  const b = breakdown(
    [
      { hasImage: true, hasText: true, publishedAt: hoursAgo(2) },   // бэлэн
      { hasImage: true, hasText: false, publishedAt: hoursAgo(3) },  // текстгүй
      { hasImage: true, hasText: true, publishedAt: hoursAgo(50) },  // хуучин
      { hasImage: true, hasText: false, publishedAt: hoursAgo(80) }, // хуучин (нас түрүүлнэ)
      { hasImage: false, hasText: true, publishedAt: hoursAgo(1) },  // зураггүй
    ],
    NOW,
  );
  assert.deepEqual(b, { eligible: 1, noText: 1, tooOld: 2, noImage: 1 });
});

test("логийн мөр нь нийт ба задаргааг хоёуланг харуулна", () => {
  const label = queueLabel({ eligible: 0, noText: 4, tooOld: 2, noImage: 0 });
  assert.match(label, /^6 \(/, "нийт тоо эхэлнэ");
  assert.match(label, /бэлэн 0/);
  assert.match(label, /текстгүй 4/);
  assert.match(label, /36ц-аас хуучин 2/);
  // Тэг ангиллыг бичихгүй
  assert.ok(!label.includes("зураггүй"));
});

test("бүгд бэлэн бол задаргаа товч", () => {
  assert.equal(queueLabel({ eligible: 3, noText: 0, tooOld: 0, noImage: 0 }), "3 (бэлэн 3)");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BIO_LINE, buildCaption, checkCaption, IG_BASE_HASHTAGS, igUserId, MAX_CAPTION_CHARS,
  MAX_HASHTAGS, MAX_IG_ATTEMPTS, MIN_HASHTAGS, publicImageUrl,
} from "./instagram.api";
import { postToInstagram } from "./instagram";

const FB_TEXT = [
  "Хуулийн фирмүүдийн 40 хувь нь ажлынхаа хэсгийг машинд даалгаж эхэлжээ.",
  "Шинэ шийдэл нь байгууллагын нууц мэдээллийг гадагш гаргалгүй ажиллах боломж олгож байна. " +
    "Энэ нь өмнө нь үнэтэй мэргэжилтэн шаарддаг байсан ажлыг хямдруулна.",
  "Дэлгэрэнгүй: https://ainews.mn/medee/test-nijtlel",
  "#AI #ХиймэлОюун #хууль",
].join("\n\n");

test("igUserId / publicImageUrl", () => {
  assert.equal(igUserId({}), null);
  assert.equal(igUserId({ IG_USER_ID: "  " }), null);
  assert.equal(igUserId({ IG_USER_ID: "17841400000000000" }), "17841400000000000");

  assert.equal(publicImageUrl("abc123", "https://ainews.mn/"), "https://ainews.mn/api/fb-image/abc123");
  assert.equal(publicImageUrl("abc123", undefined), "http://localhost:3000/api/fb-image/abc123");
});

test("buildCaption: холбоосын мөрийг bio-гийн мөрөөр солино", () => {
  const caption = buildCaption(FB_TEXT, ["OpenAI"]);
  assert.ok(!caption.includes("https://"), "холбоос үлдсэн");
  assert.ok(!caption.includes("Дэлгэрэнгүй: "), "хуучин мөр үлдсэн");
  assert.ok(caption.includes(BIO_LINE));
  // Биет хэвээр
  assert.ok(caption.startsWith("Хуулийн фирмүүдийн 40 хувь"));
  assert.ok(caption.includes("нууц мэдээллийг гадагш гаргалгүй"));
});

test("buildCaption: hashtag 5–8, суурь нь үргэлж эхэлнэ, давхардахгүй", () => {
  const caption = buildCaption(FB_TEXT, ["OpenAI", "GPT-6 Astra", "хууль", "зохицуулалт"]);
  const tags: string[] = caption.match(/#\S+/g) ?? [];

  assert.ok(tags.length >= MIN_HASHTAGS && tags.length <= MAX_HASHTAGS, `${tags.length} hashtag`);
  assert.deepEqual(tags.slice(0, IG_BASE_HASHTAGS.length), IG_BASE_HASHTAGS);
  assert.equal(new Set(tags.map((t) => t.toLowerCase())).size, tags.length, "давхардсан hashtag");
  assert.ok(tags.includes("#OpenAI"));

  // FB текстэд байсан #AI давхар орохгүй
  assert.equal(tags.filter((t) => t.toLowerCase() === "#ai").length, 1);

  // Сэдвийн шошго байхгүй ч суурь 4 нь хүрэлцэнэ гэвч доод хязгаарт тулна
  const bare = buildCaption("Гарчиг\n\nБиет.\n\nДэлгэрэнгүй: https://a.mn/b", []);
  assert.deepEqual(bare.match(/#\S+/g), IG_BASE_HASHTAGS);
});

test("buildCaption: emoji хасагдана, 2200 тэмдэгтэд багтана", () => {
  const withEmoji = buildCaption("Гарчиг 🚀\n\nБиет 😀 текст.\n\nДэлгэрэнгүй: https://a.mn/b\n\n#тест", []);
  assert.ok(!/[\p{Extended_Pictographic}]/u.test(withEmoji));

  const long = buildCaption(
    [`Гарчиг`, "Урт ".repeat(900), "Дэлгэрэнгүй: https://a.mn/b", "#тест"].join("\n\n"),
    ["OpenAI"],
  );
  assert.ok(long.length <= MAX_CAPTION_CHARS, `${long.length} тэмдэгт`);
  assert.ok(long.endsWith(IG_BASE_HASHTAGS.join(" ") + " #тест") || long.includes(BIO_LINE));
  assert.ok(long.includes(BIO_LINE), "bio мөр үлдэнэ");
});

test("checkCaption: зөрчлийг барина", () => {
  assert.deepEqual(checkCaption(buildCaption(FB_TEXT, ["OpenAI"])), []);

  const codes = (c: string) => checkCaption(c).map((p) => p.code);
  assert.ok(codes("Текст 🚀\n\n#AI #ХиймэлОюун #Монгол #технологи #тест").includes("emoji"));
  assert.ok(codes("Текст\n\n#AI #ХиймэлОюун").includes("few-hashtags"));
  assert.ok(codes(`Текст https://a.mn\n\n${IG_BASE_HASHTAGS.join(" ")} #тест`).includes("has-link"));
  assert.ok(codes(`${"у".repeat(2300)}\n\n${IG_BASE_HASHTAGS.join(" ")} #тест`).includes("too-long"));
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

  const id = await postToInstagram("https://ainews.mn/api/fb-image/a1", "caption", {
    fetchImpl,
    sleep: async (ms) => { slept.push(ms); },
  });

  assert.equal(id, "IG_MEDIA_1");
  assert.ok(calls[0]!.url.endsWith("/17841400000000000/media"));
  assert.equal(calls[0]!.body?.image_url, "https://ainews.mn/api/fb-image/a1");
  assert.equal(calls[0]!.body?.caption, "caption");

  const polls = calls.filter((c) => c.url.includes("fields=status_code"));
  assert.equal(polls.length, 3, "FINISHED болтол шалгана");
  assert.deepEqual(slept, [3000, 3000], "3 сек тутам");

  const publish = calls.at(-1)!;
  assert.ok(publish.url.endsWith("/media_publish"));
  assert.equal(publish.body?.creation_id, "CREATION_1");
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

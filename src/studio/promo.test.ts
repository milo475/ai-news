import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CARD_FOOTER, CTA, DEFAULT_PROMO_SLOTS, EXAMPLE_LABEL, exampleIndex, hasFakeProof, hasUrl,
  isPromoSlot, nextSlots, promoBody, promoLink, promoSlots, slotLabel, snippetWords, ubWeekday,
} from "./promo.api";
import { fitBlock, promoOverlaySvg } from "./promo-card.api";
import { personas } from "./personas";
import { exampleCount, pickExample, personaBySlug } from "./personas.api";

const env = (v?: string) => ({ ...(v === undefined ? {} : { STUDIO_PROMO_SLOTS: v }) }) as NodeJS.ProcessEnv;

test("анхдагч нь мягмар, баасан 19:30", () => {
  assert.equal(DEFAULT_PROMO_SLOTS, "2@19:30,5@19:30");
  assert.deepEqual(promoSlots(env()), [
    { weekday: 2, time: { hour: 19, minute: 30 } },
    { weekday: 5, time: { hour: 19, minute: 30 } },
  ]);
});

test("хоосон утга нь сурталчилгааг УНТРААНА", () => {
  assert.deepEqual(promoSlots(env("")), []);
  assert.deepEqual(promoSlots(env("   ")), []);
});

test("тохируулсан slot", () => {
  assert.deepEqual(promoSlots(env("1@12:30")), [{ weekday: 1, time: { hour: 12, minute: 30 } }]);
  // Буруу мөрийг алгасна
  assert.deepEqual(promoSlots(env("9@12:30,1@25:00,3@07:30")), [
    { weekday: 3, time: { hour: 7, minute: 30 } },
  ]);
});

test("УБ гарагийг зөв тоолно (1 = даваа, 7 = ням)", () => {
  // 2026-10-06 бол мягмар. УБ 19:30 = UTC 11:30
  assert.equal(ubWeekday(new Date("2026-10-06T11:30:00Z")), 2);
  // Ням: 2026-10-04
  assert.equal(ubWeekday(new Date("2026-10-04T11:30:00Z")), 7);
});

test("сурталчилгааны slot-ыг таана", () => {
  const slots = promoSlots(env());
  // Мягмар 19:30 УБ
  assert.equal(isPromoSlot(new Date("2026-10-06T11:30:00Z"), slots), true);
  // Мягмар 12:30 — өөр slot
  assert.equal(isPromoSlot(new Date("2026-10-06T04:30:00Z"), slots), false);
  // Лхагва 19:30 — өөр гараг
  assert.equal(isPromoSlot(new Date("2026-10-07T11:30:00Z"), slots), false);
  // Унтраалттай бол хэзээ ч үгүй
  assert.equal(isPromoSlot(new Date("2026-10-06T11:30:00Z"), promoSlots(env(""))), false);
});

test("жишээ долоо хоног бүр ээлжилнэ", () => {
  const slots = promoSlots(env());
  const tue = exampleIndex(new Date("2026-10-06T11:30:00Z"), slots);
  const fri = exampleIndex(new Date("2026-10-09T11:30:00Z"), slots);
  const nextTue = exampleIndex(new Date("2026-10-13T11:30:00Z"), slots);
  assert.notEqual(tue, fri, "нэг долоо хоногийн хоёр пост өөр жишээтэй");
  assert.notEqual(fri, nextTue, "дараагийн долоо хоног шинэ жишээтэй");
});

test("24 жишээ бүгд эргэлтэд орно", () => {
  const list = personas();
  assert.equal(exampleCount(list), 24);
  const seen = new Set<string>();
  for (let i = 0; i < 24; i++) seen.add(pickExample(list, i)!.key);
  assert.equal(seen.size, 24, "зарим жишээ давтагдаж байна");
  // Эргэлт хаагдана
  assert.equal(pickExample(list, 0)!.key, pickExample(list, 24)!.key);
});

// ---------- Үнэн байдал ----------

test("зохиомол нийгмийн баталгааг барина", () => {
  assert.equal(hasFakeProof("Манай хэрэглэгч ингэж хэлсэн"), "манай хэрэглэгч");
  assert.equal(hasFakeProof("Олон хүн үүнийг ашиглаж байна"), "олон хүн");
  assert.equal(hasFakeProof("Жишээ: багш — «слайд бэлдэх»"), null);
});

const BODY = {
  personaName: "Багш",
  hook: "Фотосинтезийг 30 хүүхдэд ойлгуулах слайдыг шөнө бэлддэг үү?",
  request: "Хичээлийн слайд бэлдэх",
  promptSnippet: "A bright classroom…",
  toolNames: ["Gemini (Nano Banana)", "Canva"],
};

test("пост hook-оос эхэлж, эргэлт → жишээ → CTA дарааллаар", () => {
  const body = promoBody({ ...BODY, network: "facebook" });
  assert.ok(body.startsWith(BODY.hook), body.slice(0, 60));
  // Эргэлт: «өөрөө хийж үзээгүй ч болно»
  assert.match(body, /Өөрөө хийж үзээгүй ч болно/);
  assert.match(body, new RegExp(`${EXAMPLE_LABEL} — Багш`));
  assert.match(body, /Жишээ промптын эхлэл:/);
  assert.equal(hasFakeProof(body), null);
});

test("CTA нь сүлжээнээс хамаарна — IG-д коммент дарагддаг", () => {
  assert.match(promoBody({ ...BODY, network: "facebook" }), /холбоос коммент дээр/);
  assert.match(promoBody({ ...BODY, network: "instagram" }), /холбоос bio-д/);
  assert.equal(CTA.instagram.includes("коммент"), false);
});

test("IG текстэд URL БАЙЖ БОЛОХГҮЙ", () => {
  const ig = promoBody({ ...BODY, network: "instagram" });
  assert.equal(hasUrl(ig), false, ig);
  assert.equal(hasUrl("Дэлгэрэнгүй ainews.mn дээр"), true);
  assert.equal(hasUrl("https://ainews.mn/ig"), true);
  assert.equal(hasUrl("Холбоос bio-д"), false);
});

test("картын доод мөр сүлжээнээс хамаарна", () => {
  assert.match(CARD_FOOTER.facebook, /коммент дээр/);
  assert.match(CARD_FOOTER.instagram, /bio-д/);
  const ig = promoOverlaySvg({ request: "х", outcome: "ю", footer: CARD_FOOTER.instagram });
  assert.match(ig, /bio-д/);
  assert.ok(!ig.includes("коммент"), "IG картад коммент дурдагдах ёсгүй");
  assert.equal(hasUrl(ig.replace(/xmlns="[^"]*"/, "")), false, "картад URL байх ёсгүй");
});

test("промптын хэсэг 12 үгээр хязгаарлагдана", () => {
  const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
  const s = snippetWords(long);
  // «…» нь сүүлийн үгэнд наалддаг тул 12 хэсэг
  assert.equal(s.split(" ").length, 12, s);
  assert.ok(s.endsWith("…"));
  assert.equal(snippetWords("богино промпт"), "богино промпт");
});

// ---------- Дараагийн slot ----------

test("өнгөрсөн slot-ыг тоохгүй — дараагийнхаас эхэлнэ", () => {
  const slots = promoSlots(env());
  // Мягмар 20:04 УБ = 12:04 UTC. 19:30 өнгөрсөн тул баасан эхэлнэ.
  const now = new Date("2026-09-29T12:04:00Z");
  const next = nextSlots(now, slots, 3);
  assert.equal(next.length, 3);
  assert.equal(slotLabel(next[0]!.at), "10/02 баасан 19:30");
  assert.equal(slotLabel(next[1]!.at), "10/06 мягмар 19:30");
  assert.equal(slotLabel(next[2]!.at), "10/09 баасан 19:30");
});

test("slot-оос өмнө бол тэр slot өөрөө дараагийнх", () => {
  // Мягмар 18:00 УБ — тэр өдрийн 19:30 хараахан болоогүй
  const next = nextSlots(new Date("2026-09-29T10:00:00Z"), promoSlots(env()), 1);
  assert.equal(slotLabel(next[0]!.at), "09/29 мягмар 19:30");
});

test("унтраалттай бол дараагийн slot алга", () => {
  assert.deepEqual(nextSlots(new Date(), promoSlots(env("")), 3), []);
});

test("жишээ бүрт ГАРААР бичсэн hook бий", () => {
  for (const p of personas()) {
    for (const e of p.examples) {
      assert.ok(e.hook.length > 15, `${p.slug}: ${e.hook}`);
      assert.ok(/[?]$/.test(e.hook), `${p.slug}: hook асуулт байх ёстой — ${e.hook}`);
      // Бүтээгдэхүүнээс биш, ХҮНЭЭС эхэлнэ
      assert.ok(!e.hook.startsWith("Промпт студи"), p.slug);
    }
  }
  const all = personas().flatMap((p) => p.examples.map((e) => e.hook));
  assert.equal(new Set(all).size, 24, "hook давтагдаж байна");
});

test("холбоос utm-тэй, мэргэжлийн хуудас руу", () => {
  const fb = promoLink("https://ainews.mn", "bagsh", "facebook");
  assert.equal(fb, "https://ainews.mn/prompt/studio/m/bagsh?utm_source=facebook&utm_campaign=weekly_prompt");
  assert.match(promoLink("https://ainews.mn/", "bagsh", "instagram"), /utm_source=instagram/);
  // Давхар зураас үүсэхгүй
  assert.ok(!promoLink("https://ainews.mn/", "bagsh", "facebook").includes("mn//"));
});



// ---------- Карт ----------

test("карт хоёр блоктой, «Жишээ» гэж бичсэн", () => {
  const svg = promoOverlaySvg({
    request: "Хурлын илтгэлээ видео болгох", outcome: "Бэлэн промпт",
    footer: CARD_FOOTER.facebook,
  });
  assert.match(svg, /ХҮСЭЛТ/);
  assert.match(svg, /ЮУ ГАРАХ/);
  assert.match(svg, /Промпт студи/);
  assert.match(svg, new RegExp(EXAMPLE_LABEL));
  assert.match(svg, /width="1080" height="1350"/);
});

test("урт текстийг тайрч багтаана", () => {
  const b = fitBlock("ХҮСЭЛТ", "маш ".repeat(120));
  assert.ok(b.lines.length <= 4, `${b.lines.length} мөр`);
  assert.ok(b.lines[b.lines.length - 1]!.endsWith("…"));
});

test("мэргэжлийн загварууд бүрэн", () => {
  const list = personas();
  assert.equal(list.length, 8);
  assert.deepEqual(
    list.map((p) => p.slug),
    ["ofis-ajiltan", "bagsh", "nyagtlan-bodogch", "marketer", "borluulagch", "hunii-noots", "oyutan", "jijig-biznes"],
  );
  for (const p of list) {
    assert.equal(p.examples.length, 3, p.slug);
    assert.ok(p.title.length > 5, p.slug);
    assert.ok(p.intro.length > 20, p.slug);
    for (const e of p.examples) {
      assert.ok(e.request.length > 10, `${p.slug}: ${e.request}`);
      assert.ok(Object.keys(e.answers).length >= 3, `${p.slug}: урьдчилсан хариулт цөөн`);
    }
  }
  assert.equal(new Set(list.map((p) => p.slug)).size, 8);
  assert.ok(personaBySlug("bagsh", list));
  assert.equal(personaBySlug("байхгүй", list), null);
});

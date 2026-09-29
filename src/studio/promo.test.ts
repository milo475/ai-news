import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROMO_SLOTS, EXAMPLE_LABEL, exampleIndex, hasFakeProof, isPromoSlot, promoBody,
  promoLink, promoSlots, promptSnippet, ubWeekday,
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

test("постын бие «Жишээ» гэж тодорхой хэлнэ, зохиомол баталгаагүй", () => {
  const body = promoBody({
    personaName: "Багш",
    request: "Хичээлийн слайд бэлдэх",
    promptSnippet: "A bright classroom…",
    toolNames: ["Gemini (Nano Banana)", "Canva"],
  });
  assert.ok(body.startsWith(`${EXAMPLE_LABEL}:`), body.slice(0, 40));
  assert.equal(hasFakeProof(body), null);
  assert.match(body, /Багш/);
  assert.match(body, /Gemini \(Nano Banana\) \+ Canva/);
});

test("холбоос utm-тэй, мэргэжлийн хуудас руу", () => {
  const fb = promoLink("https://ainews.mn", "bagsh", "facebook");
  assert.equal(fb, "https://ainews.mn/prompt/studio/m/bagsh?utm_source=facebook&utm_campaign=weekly_prompt");
  assert.match(promoLink("https://ainews.mn/", "bagsh", "instagram"), /utm_source=instagram/);
  // Давхар зураас үүсэхгүй
  assert.ok(!promoLink("https://ainews.mn/", "bagsh", "facebook").includes("mn//"));
});

test("промптын хэсгийг үгээр таслана", () => {
  const long = "a".repeat(50) + " " + "b".repeat(200);
  const s = promptSnippet(long, 100);
  assert.ok(s.length <= 101, `${s.length}`);
  assert.ok(s.endsWith("…"));
  assert.equal(promptSnippet("богино промпт", 100), "богино промпт");
});

// ---------- Карт ----------

test("карт хоёр блоктой, «Жишээ» гэж бичсэн", () => {
  const svg = promoOverlaySvg({ request: "Хурлын илтгэлээ видео болгох", outcome: "Бэлэн промпт" });
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

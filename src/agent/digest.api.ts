/**
 * Долоо хоногийн digest-ийн цэвэр хэсэг (DB-гүй, LLM-гүй, тесттэй).
 */
import { jaccard, sharedCount, titleTokens } from "../lib/text.api";

export { jaccard, titleTokens };

/** Digest-д орох нэг мэдээ */
export interface DigestSource {
  slug: string;
  titleMn: string;
  summaryMn: string;
  relevance: number;
  sourceName: string;
}

/** Жагсаалтын 7 хоногийн өөрчлөлт — LLM-гүйгээр бэлтгэнэ */
export interface RankingChange {
  enteredTop10: { name: string; slug: string; rank: number }[];
  leftTop10: { name: string; slug: string }[];
  biggestRise: { name: string; slug: string; delta: number } | null;
  biggestFall: { name: string; slug: string; delta: number } | null;
  arenaNew: { name: string; slug: string; rank: number }[];
}

/** LLM-ийн буцаах бүтэц */
export interface DigestSection {
  heading: string;
  /** Холбоосгүй, бүтэн өгүүлбэрүүд */
  body: string;
  /** Энэ хэсэгт хамаарах мэдээнүүд — холбоос нь хэсгийн ДООР жагсаалтаар гарна */
  slugs: string[];
}

export interface DigestOut {
  titleMn: string;
  leadMn: string;
  sections: DigestSection[];
  nextWeek: string[];
}

/** Үүнээс цөөн мэдээтэй бол digest гаргахгүй */
export const MIN_ARTICLES = 3;

/**
 * Нэг дуудлагаар бичүүлэх оролдлогын токены хязгаар.
 *
 * Монгол кирилл нь токен идэмхий (нэг үг ≈ 2–3 токен): 4 хэсэг × 3 догол мөр нь
 * 4000-д багтахгүй байсан (2026-09-27-ны production алдаа). 8000 бол бүтэн тоймд
 * хүрэлцдэг; хүрэхгүй бол `writeInParts` хэсэгчилсэн горимд шилжинэ.
 */
export const DIGEST_MAX_TOKENS = 8_000;

/** Хэсэгчилсэн горимын нэг дуудлагын хязгаар */
export const OUTLINE_MAX_TOKENS = 2_000;
export const SECTION_MAX_TOKENS = 2_500;

/** Digest гаргах өдөр — Ням гараг (UTC) */
export function isDigestDay(d: Date): boolean {
  return d.getUTCDay() === 0;
}

/** "9/15–9/21" */
export function weekLabel(from: Date, to: Date): string {
  const f = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `${f(from)}–${f(to)}`;
}

export const DIGEST_SCHEMA = {
  type: "object",
  properties: {
    titleMn: { type: "string", description: 'Гарчиг, "AI-ийн долоо хоног: 9/15–9/21" хэлбэртэй' },
    leadMn: { type: "string", description: "2–3 өгүүлбэр, долоо хоногийн гол агуулга. 250 тэмдэгт хүртэл" },
    sections: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          heading: { type: "string", description: "Сэдвийн гарчиг, 60 тэмдэгт хүртэл" },
          body: {
            type: "string",
            description:
              "2–4 догол мөр энгийн текст. ХОЛБООС ОРУУЛАХГҮЙ, markdown-ийн [...](...) хэлбэр " +
              "хэрэглэхгүй. Нийтлэлийн бүтэн гарчгийг өгүүлбэрт шигтгэхгүй — юу болсныг " +
              "өөрийн үгээр, бүтэн өгүүлбэрээр бич",
          },
          slugs: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
            description: "Энэ хэсэгт хамаарах мэдээнүүдийн slug — зөвхөн өгөгдсөн жагсаалтаас",
          },
        },
        required: ["heading", "body", "slugs"],
        additionalProperties: false,
      },
    },
    nextWeek: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
      description: "Дараагийн долоо хоногт анхаарах 3 зүйл, тус бүр нэг өгүүлбэр",
    },
  },
  required: ["titleMn", "leadMn", "sections", "nextWeek"],
  additionalProperties: false,
};

// ---------- Хэсэгчилсэн горим (нэг дуудлагад багтаагүй үед) ----------

/** Эхний дуудлага: зөвхөн бүтэц — гарчиг, тойм, хэсгүүдийн гарчиг + аль мэдээ орох */
export interface DigestOutline {
  titleMn: string;
  leadMn: string;
  sections: { heading: string; slugs: string[] }[];
  nextWeek: string[];
}

export const DIGEST_OUTLINE_SCHEMA = {
  type: "object",
  properties: {
    titleMn: { type: "string", description: 'Гарчиг, "AI-ийн долоо хоног: 9/15–9/21" хэлбэртэй' },
    leadMn: { type: "string", description: "2–3 өгүүлбэр, долоо хоногийн гол агуулга. 250 тэмдэгт хүртэл" },
    sections: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          heading: { type: "string", description: "Сэдвийн гарчиг, 60 тэмдэгт хүртэл" },
          slugs: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
            description: "Энэ хэсэгт орох мэдээнүүдийн slug — зөвхөн өгөгдсөн жагсаалтаас",
          },
        },
        required: ["heading", "slugs"],
        additionalProperties: false,
      },
    },
    nextWeek: {
      type: "array", minItems: 3, maxItems: 3, items: { type: "string" },
      description: "Дараагийн долоо хоногт анхаарах 3 зүйл, тус бүр нэг өгүүлбэр",
    },
  },
  required: ["titleMn", "leadMn", "sections", "nextWeek"],
  additionalProperties: false,
};

/** Хоёр дахь дуудлага: нэг хэсгийн бие */
export const DIGEST_SECTION_SCHEMA = {
  type: "object",
  properties: {
    body: {
      type: "string",
      description:
        "2–4 догол мөр энгийн текст. ХОЛБООС ОРУУЛАХГҮЙ, markdown-ийн [...](...) хэлбэр " +
        "хэрэглэхгүй. Нийтлэлийн бүтэн гарчгийг өгүүлбэрт шигтгэхгүй",
    },
  },
  required: ["body"],
  additionalProperties: false,
};

/**
 * Зохиосон slug-ийг шүүнэ — LLM жагсаалтад байхгүй мэдээ нэрлэвэл хэсэг хоосон
 * холбоостой болно. Мэдээгүй үлдсэн хэсгийг дуудагч нь алгасна.
 */
export function cleanOutline(outline: DigestOutline, known: string[]): DigestOutline {
  const valid = new Set(known);
  return {
    ...outline,
    sections: outline.sections
      .map((s) => ({ ...s, slugs: [...new Set(s.slugs.filter((x) => valid.has(x)))] }))
      .filter((s) => s.slugs.length > 0),
  };
}

/** Аль ч хэсэгт ороогүй мэдээг эхний хэсэгт нэмнэ — digest-ээс мэдээ унахгүй */
export function fillUnused(outline: DigestOutline, known: string[]): DigestOutline {
  if (outline.sections.length === 0) return outline;
  const used = new Set(outline.sections.flatMap((s) => s.slugs));
  const missing = known.filter((s) => !used.has(s));
  if (missing.length === 0) return outline;

  const sections = outline.sections.map((s, i) =>
    i === outline.sections.length - 1 ? { ...s, slugs: [...s.slugs, ...missing] } : s,
  );
  return { ...outline, sections };
}

/**
 * Бүтцийг ашиглахад бэлэн болгоно.
 *
 * 1. Зохиосон slug-ийг шүүнэ.
 * 2. Аль ч хэсэгт ороогүй мэдээг сүүлийн хэсэгт нэмнэ.
 * 3. **Бүх slug зохиомол байсан** бол гарчгуудыг нь үлдээгээд мэдээг тэнцүү хуваана —
 *    LLM slug-аа буруу бичсэнээс болж долоо хоногийн тойм бүхэлдээ унах ёсгүй.
 */
export function resolveOutline(outline: DigestOutline, known: string[]): DigestOutline {
  if (known.length === 0) return { ...outline, sections: [] };

  const cleaned = cleanOutline(outline, known);
  if (cleaned.sections.length > 0) return fillUnused(cleaned, known);

  const headings = outline.sections.map((s) => s.heading).filter((h) => h.trim());
  if (headings.length === 0) return { ...outline, sections: [] };

  const sections = headings.map((heading) => ({ heading, slugs: [] as string[] }));
  known.forEach((slug, i) => sections[i % sections.length]!.slugs.push(slug));
  return { ...outline, sections: sections.filter((s) => s.slugs.length > 0) };
}

/** Жагсаалтын өөрчлөлтийг markdown болгоно — LLM оролцохгүй, тоо нь баталгаатай */
export function rankingSection(changes: RankingChange): string {
  const lines: string[] = [];
  const link = (m: { name: string; slug: string }) => `[${m.name}](/model/${m.slug})`;

  if (changes.enteredTop10.length) {
    lines.push(
      `- **Топ 10-д шинээр орсон:** ${changes.enteredTop10.map((m) => `${link(m)} (#${m.rank})`).join(", ")}`,
    );
  }
  if (changes.leftTop10.length) {
    lines.push(`- **Топ 10-оос гарсан:** ${changes.leftTop10.map(link).join(", ")}`);
  }
  if (changes.biggestRise) {
    lines.push(`- **Хамгийн их өссөн:** ${link(changes.biggestRise)} — ${changes.biggestRise.delta} байр дээшилсэн`);
  }
  if (changes.biggestFall) {
    lines.push(
      `- **Хамгийн их унасан:** ${link(changes.biggestFall)} — ${Math.abs(changes.biggestFall.delta)} байр буурсан`,
    );
  }
  if (changes.arenaNew.length) {
    lines.push(
      `- **Чанарын жагсаалтад шинээр:** ${changes.arenaNew.map((m) => `${link(m)} (#${m.rank})`).join(", ")}`,
    );
  }

  if (!lines.length) return "## Жагсаалтын өөрчлөлт\n\nЭнэ долоо хоногт жагсаалтад томоохон өөрчлөлт гараагүй.";
  return `## Жагсаалтын өөрчлөлт\n\n${lines.join("\n")}`;
}

/** LLM-ийн гаргалт + жагсаалтын өөрчлөлт + орсон мэдээний жагсаалтыг нэг markdown болгоно */
/**
 * Дотоодын мэдээний хэсэг. Мэдээ байхгүй бол хэсгийг огт бичихгүй —
 * хоосон гарчиг тоймыг эвдэнэ.
 */
export function localSection(items: DigestSource[]): string {
  if (items.length === 0) return "";
  return [
    "## Монголд",
    "",
    ...items.map((a) => `- [${a.titleMn}](/medee/${a.slug}) — ${a.sourceName}`),
  ].join("\n");
}

/** Хэсгийн доорх мэдээний жагсаалтын гарчиг */
export const SECTION_LINKS_LABEL = "**Энэ хэсгийн мэдээ:**";

/**
 * Нэг хэсгийг markdown болгоно.
 *
 * Өгүүлбэр дотор холбоос БАЙХГҮЙ: 2026-09-27-ны тоймд нийтлэлийн бүтэн гарчгийг
 * өгүүлбэр дундуур шигтгэснээс «…50 хувиар бууруулсан [OpenAI зардлыг 50% бууруулсан
 * GPT-6 Sol, Luna-г танилцууллаа] мөн […] мэдэгдлийг гаргав» гэх мэт уншигдахгүй
 * өгүүлбэрүүд үүссэн. Одоо холбоосууд хэсгийн ДООР тусдаа жагсаалтаар гарна.
 */
export function sectionMarkdown(s: DigestSection, bySlug: Map<string, DigestSource>): string {
  const links = s.slugs
    .map((slug) => bySlug.get(slug))
    .filter((a): a is DigestSource => Boolean(a))
    .map((a) => `- [${a.titleMn}](/medee/${a.slug})`);

  const parts = [`## ${s.heading}`, "", s.body.trim()];
  if (links.length) parts.push("", SECTION_LINKS_LABEL, "", ...links);
  return parts.join("\n");
}

export function assembleBody(
  out: DigestOut,
  changes: RankingChange,
  items: DigestSource[],
  /** Долоо хоногийн дотоодын мэдээ (/mongol) */
  local: DigestSource[] = [],
): string {
  const bySlug = new Map(items.map((a) => [a.slug, a]));
  const parts: string[] = [];
  for (const s of out.sections) parts.push(sectionMarkdown(s, bySlug));
  const mongol = localSection(local);
  if (mongol) parts.push(mongol);
  parts.push(rankingSection(changes));
  if (out.nextWeek.length) {
    parts.push(`## Дараагийн долоо хоногт анхаарах\n\n${out.nextWeek.map((x) => `- ${x}`).join("\n")}`);
  }
  parts.push(
    `## Энэ digest-д орсон мэдээ\n\n${items
      .map((a) => `- [${a.titleMn}](/medee/${a.slug}) — ${a.sourceName}`)
      .join("\n")}`,
  );
  return parts.join("\n\n");
}


// ---------- Ижил сэдвийн давхардлыг арилгах ----------

/** Ижил сэдэв гэж үзэх босго */
export const SAME_TOPIC_JACCARD = 0.45;
/** Энэ тооны үг давхцвал босгоос үл хамааран ижил сэдэв */
export const SAME_TOPIC_SHARED = 4;

export function sameTopic(a: string, b: string): boolean {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  return sharedCount(ta, tb) >= SAME_TOPIC_SHARED || jaccard(ta, tb) >= SAME_TOPIC_JACCARD;
}

/**
 * Нэг мэдээний тухай хэд хэдэн нийтлэлээс ХАМГИЙН ӨНДӨР ОНООТОЙГ нь үлдээнэ.
 *
 * 2026-09-27-ны тоймд GPT-6 Sol/Luna-гийн тухай хоёр нийтлэл давхар орсон.
 * Жагсаалт нь оноогоор эрэмбэлэгдсэн ирдэг тул эхнийхийг нь үлдээхэд хангалттай.
 */
export function dedupeItems(items: DigestSource[]): { kept: DigestSource[]; dropped: DigestSource[] } {
  const kept: DigestSource[] = [];
  const dropped: DigestSource[] = [];
  for (const a of items) {
    if (kept.some((k) => sameTopic(k.titleMn, a.titleMn))) dropped.push(a);
    else kept.push(a);
  }
  return { kept, dropped };
}

// ---------- Нийтлэхийн өмнөх механик шалгалт ----------

export type DigestProblem =
  | "үнэн зөв биш"
  | "өгүүлбэрт бүтэн гарчиг"
  | "өгүүлбэрт холбоос"
  | "давхардсан мэдээ"
  | "slug үлдэгдэл"
  | "хоосон хэсэг"
  | "хэсэггүй";

export interface DigestIssue {
  problem: DigestProblem;
  detail: string;
}

/** Хэсгийн бие хамгийн багадаа ийм урттай байна */
export const MIN_SECTION_CHARS = 120;

/** Markdown холбоос — хэсгийн биед байх ёсгүй */
const INLINE_LINK = /\[[^\]]*\]\([^)]*\)/u;
/** «[...]», «[ ]», «[гарчиг]» гэх мэт үлдэгдэл */
const BARE_BRACKET = /\[[^\]]*\]/u;
/** Биед үлдсэн slug: «-tur-zogsooloo», «/medee/xyz» */
const SLUG_RESIDUE = /\/medee\/[a-z0-9-]+|(?:^|\s)[a-z0-9]+(?:-[a-z0-9]+){3,}(?=\s|$)/u;

/**
 * Тоймыг нийтлэхээс ӨМНӨ шалгана.
 *
 * Алдаа олдвол дуудагч нь DRAFT болгож /admin-д мэдэгдэнэ — эвдэрсэн тойм
 * автоматаар нийтлэгдэхээс сэргийлнэ.
 */
export function checkDigest(out: DigestOut, items: DigestSource[]): DigestIssue[] {
  const issues: DigestIssue[] = [];
  if (out.sections.length === 0) {
    return [{ problem: "хэсэггүй", detail: "тоймд нэг ч хэсэг алга" }];
  }

  const seen = new Set<string>();
  for (const s of out.sections) {
    const body = s.body.trim();
    if (body.length < MIN_SECTION_CHARS) {
      issues.push({ problem: "хоосон хэсэг", detail: `«${s.heading}» — ${body.length} тэмдэгт` });
    }
    if (INLINE_LINK.test(body)) {
      issues.push({ problem: "өгүүлбэрт холбоос", detail: `«${s.heading}» — ${body.match(INLINE_LINK)![0].slice(0, 60)}` });
    } else if (BARE_BRACKET.test(body)) {
      issues.push({ problem: "slug үлдэгдэл", detail: `«${s.heading}» — ${body.match(BARE_BRACKET)![0].slice(0, 60)}` });
    }
    if (SLUG_RESIDUE.test(body)) {
      issues.push({ problem: "slug үлдэгдэл", detail: `«${s.heading}» — ${body.match(SLUG_RESIDUE)![0].trim().slice(0, 60)}` });
    }
    // Нийтлэлийн бүтэн гарчгийг өгүүлбэрт шигтгэсэн эсэх
    for (const a of items) {
      const t = a.titleMn.trim();
      if (t.length >= 25 && body.includes(t)) {
        issues.push({ problem: "өгүүлбэрт бүтэн гарчиг", detail: `«${s.heading}» — «${t.slice(0, 60)}»` });
        break;
      }
    }
    for (const slug of s.slugs) {
      if (seen.has(slug)) issues.push({ problem: "давхардсан мэдээ", detail: slug });
      seen.add(slug);
    }
  }
  return issues;
}


/**
 * Шүүгчид өгөх эх сурвалж: тухайн хэсэгт хамаарах мэдээнүүдийн гарчиг ба
 * хураангуйн эхний өгүүлбэрүүд. Бүтэн биетийг өгвөл токен үрнэ, ач холбогдол бага.
 */
export const SECTION_SOURCE_CHARS = 1_600;

export function sectionSource(s: DigestSection, bySlug: Map<string, DigestSource>): string {
  const lines = s.slugs
    .map((slug) => bySlug.get(slug))
    .filter((a): a is DigestSource => Boolean(a))
    .map((a) => `${a.titleMn}. ${a.summaryMn}`);
  return lines.join("\n").slice(0, SECTION_SOURCE_CHARS);
}

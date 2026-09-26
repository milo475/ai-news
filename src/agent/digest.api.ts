/**
 * Долоо хоногийн digest-ийн цэвэр хэсэг (DB-гүй, LLM-гүй, тесттэй).
 */

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
export interface DigestOut {
  titleMn: string;
  leadMn: string;
  sections: { heading: string; body: string }[];
  nextWeek: string[];
}

/** Үүнээс цөөн мэдээтэй бол digest гаргахгүй */
export const MIN_ARTICLES = 3;

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
              "2–4 догол мөр markdown. Мэдээ дурдах бүрдээ [гарчиг](/medee/<slug>) хэлбэрээр холбоос тавина",
          },
        },
        required: ["heading", "body"],
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

export function assembleBody(
  out: DigestOut,
  changes: RankingChange,
  items: DigestSource[],
  /** Долоо хоногийн дотоодын мэдээ (/mongol) */
  local: DigestSource[] = [],
): string {
  const parts: string[] = [];
  for (const s of out.sections) parts.push(`## ${s.heading}\n\n${s.body.trim()}`);
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

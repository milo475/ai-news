/**
 * Монголын AI/технологийн төслүүд — гараар хөтөлдөг жагсаалт.
 *
 *   npm run seed:mongol
 *
 * ЗАРЧИМ: LLM-ээр таамаглахгүй. Зөвхөн **бодитоор мэдэгдэж байгаа**, вэбсайт нь
 * ажилладаг төслүүдийг оруулна. Тайлбарыг ч гараар бичсэн — LLM бичвэл байхгүй
 * бүтээгдэхүүн зохиох эрсдэлтэй.
 *
 * Idempotent: slug-аар upsert. Гараар зассан тайлбарыг дарж бичихгүй (зөвхөн
 * шинээр үүсгэхэд хэрэглэнэ).
 */
import "dotenv/config";
import { prisma } from "../db";
import { userAgent } from "../lib/site";
import { runCli } from "../lib/cli";

export interface SeedProject {
  slug: string;
  name: string;
  description: string;
  website: string;
  category: string;
  isFeatured?: boolean;
  order?: number;
}

/**
 * 2026-09-26: вэбсайт бүрийг HTTP-ээр шалгасан (200 буцаасан).
 *
 * Жагсаалт зориудаар богино: баталгаажаагүй компанийн нэр бичихээс зайлсхийв.
 * Нэмэлтийг /admin/mongol-оос гараар оруулна.
 */
export const PROJECTS: SeedProject[] = [
  {
    slug: "chimege",
    name: "Chimege",
    description:
      "Монгол хэлний хэлний технологи: дуу хоолойг текст болгох, текстийг уншуулах, " +
      "монгол хэлний гар. Монголын хамгийн танигдсан хэлний технологийн бүтээгдэхүүн.",
    website: "https://chimege.com",
    category: "Хэлний технологи",
    isFeatured: true,
    order: 1,
  },
  {
    slug: "bolorsoft",
    name: "Bolorsoft",
    description:
      "Bolor Dictionary болон монгол хэлний зөв бичгийн хяналтыг хөгжүүлдэг компани. " +
      "Орчуулга, толь бичиг, дүрмийн шалгуурын хэрэгслүүд.",
    website: "https://bolorsoft.com",
    category: "Хэлний технологи",
    isFeatured: true,
    order: 2,
  },
  {
    slug: "e-mongolia",
    name: "E-Mongolia",
    description:
      "Төрийн үйлчилгээний нэгдсэн цахим платформ. Монголын дижитал шилжилтийн гол " +
      "бүтээн байгуулалт — олон зуун үйлчилгээг онлайнаар авах боломж.",
    website: "https://e-mongolia.mn",
    category: "Төрийн үйлчилгээ",
    isFeatured: true,
    order: 3,
  },
  {
    slug: "ondo",
    name: "Ondo",
    description: "Монголын технологийн бүтээгдэхүүн хөгжүүлэгч. Дижитал шийдэл, платформууд.",
    website: "https://ondo.mn",
    category: "Технологийн компани",
    order: 4,
  },
  {
    slug: "gerege",
    name: "Gerege Systems",
    description:
      "Төрийн болон хувийн хэвшлийн цахим үйлчилгээний системүүдийг хөгжүүлдэг компани. " +
      "E-Mongolia-гийн технологийн хөгжүүлэгч.",
    website: "https://gerege.mn",
    category: "Технологийн компани",
    order: 5,
  },
];

const TIMEOUT_MS = 12_000;

/** Вэбсайт ажиллаж байгаа эсэх — 200 биш бол seed-д оруулахгүй */
export async function websiteOk(url: string): Promise<{ ok: boolean; status: number | null }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": userAgent() },
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: null };
  }
}

export interface SeedResult {
  created: string[];
  updated: string[];
  skipped: { name: string; status: number | null }[];
}

export async function seedProjects(opts: { check?: boolean } = {}): Promise<SeedResult> {
  const r: SeedResult = { created: [], updated: [], skipped: [] };

  for (const p of PROJECTS) {
    if (opts.check !== false) {
      const alive = await websiteOk(p.website);
      if (!alive.ok) {
        r.skipped.push({ name: p.name, status: alive.status });
        console.warn(`✗ ${p.name}: ${p.website} → ${alive.status ?? "холбогдсонгүй"} — оруулсангүй`);
        continue;
      }
    }

    const existing = await prisma.mongolProject.findUnique({
      where: { slug: p.slug },
      select: { id: true },
    });
    await prisma.mongolProject.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug, name: p.name, description: p.description, website: p.website,
        category: p.category, isFeatured: p.isFeatured ?? false, order: p.order ?? 0,
      },
      // Гараар зассан тайлбарыг дарж бичихгүй — зөвхөн хаяг, ангиллыг шинэчилнэ
      update: { website: p.website, category: p.category },
    });
    if (existing) r.updated.push(p.name);
    else r.created.push(p.name);
    console.log(`${existing ? " " : "+"} ✓ ${p.name} — ${p.category}`);
  }
  return r;
}

if (process.argv[1]?.endsWith("projects.seed.ts")) {
  await runCli(async () => {
    const r = await seedProjects({ check: !process.argv.includes("--no-check") });
    console.log(
      `\n${r.created.length} шинэ, ${r.updated.length} шинэчилсэн, ${r.skipped.length} оруулаагүй`,
    );
  });
}

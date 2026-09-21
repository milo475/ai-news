/**
 * Брэндийн зургуудыг үүсгэнэ — нэг удаа ажиллуулаад үр дүнг нь commit хийнэ.
 *
 *   npx tsx scripts/brand.ts
 *
 * public/brand/ дотор бэлэн PNG байвал түүнийг ашиглана, үгүй бол тэмдгийн SVG-ээс зурна.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const ACCENT = "#4f46e5";
const PAPER = "#f7f6f2";
const INK = "#1b1b23";
const APP = join(process.cwd(), "src/app");
const BRAND = join(process.cwd(), "public/brand");

/** Тэмдэг — icon.svg-тэй ижил, өнгө нь тогтмол (зураг дотор CSS хувьсагч ажиллахгүй) */
function markSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  <rect width="64" height="64" rx="16" fill="${ACCENT}"/>
  <rect x="13" y="38" width="9" height="13" rx="2" fill="#fff" fill-opacity="0.55"/>
  <rect x="27.5" y="28" width="9" height="23" rx="2" fill="#fff" fill-opacity="0.8"/>
  <rect x="42" y="18" width="9" height="33" rx="2" fill="#fff"/>
  <path d="M46.5 8 L52.5 15 L40.5 15 Z" fill="#fff"/>
</svg>`;
}

/** public/brand доторх бэлэн файлаас, үгүй бол SVG-ээс */
async function markPng(size: number): Promise<Buffer> {
  for (const name of ["mark.png", "logo-mark.png", "icon.png"]) {
    const file = join(BRAND, name);
    if (existsSync(file)) {
      return sharp(file).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    }
  }
  return sharp(Buffer.from(markSvg(size))).png().toBuffer();
}

async function main() {
  await mkdir(APP, { recursive: true });

  // 1. Apple touch icon — 180×180
  await writeFile(join(APP, "apple-icon.png"), await markPng(180));
  console.log("✓ src/app/apple-icon.png (180×180)");

  // 2. OpenGraph — 1200×630, цайвар дэвсгэр дээр тэмдэг + нэр
  const MARK = 150;
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${PAPER}"/>
  <text x="600" y="430" text-anchor="middle" font-family="DejaVu Sans, Liberation Sans, sans-serif"
        font-size="86" font-weight="bold" letter-spacing="-3">
    <tspan fill="${INK}">AI</tspan><tspan fill="${ACCENT}" dx="26">News</tspan>
  </text>
  <text x="600" y="492" text-anchor="middle" font-family="DejaVu Sans, Liberation Sans, sans-serif"
        font-size="30" fill="#6b6b76">Дэлхийн AI-ийн жагсаалт, мэдээ — монголоор</text>
</svg>`;
  await sharp(Buffer.from(og))
    .composite([{ input: await markPng(MARK), top: 150, left: (1200 - MARK) / 2 }])
    .png()
    .toFile(join(APP, "opengraph-image.png"));
  console.log("✓ src/app/opengraph-image.png (1200×630)");
}

main().catch((e) => { console.error(e); process.exit(1); });

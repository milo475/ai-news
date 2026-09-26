/**
 * Хэрэгслийн лого — сайтын favicon-оос татна.
 *
 * Дараалал: сайтын HTML дахь <link rel="icon"> → /favicon.ico → Google s2 favicons.
 * Бүгд бүтэхгүй бол null — вэб дээр үсгэн avatar зурагдана.
 */
import sharp from "sharp";
import { faviconFallbackUrl, isLogoType } from "./tool.api";
import { userAgent } from "../lib/site";

export const LOGO_SIZE = 64;
const TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;

export interface LogoResult {
  data: Buffer;
  contentType: string;
  /** Хаанаас авсан — логд тэмдэглэхэд */
  from: string;
}

async function fetchBinary(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": userAgent() },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!isLogoType(contentType)) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;
    return { buffer, contentType: contentType.split(";")[0]!.trim().toLowerCase() };
  } catch {
    return null;
  }
}

/** Сайтын HTML-ээс icon-ийн хаягуудыг гаргана (том нь эхэлнэ) */
export async function iconLinksFrom(website: string): Promise<string[]> {
  try {
    const res = await fetch(website, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": userAgent() },
    });
    if (!res.ok) return [];
    const html = (await res.text()).slice(0, 200_000);
    const links: { href: string; size: number }[] = [];

    for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
      const tag = m[0]!;
      if (!/rel\s*=\s*["'][^"']*icon/i.test(tag)) continue;
      const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      if (!href) continue;
      const sizes = /sizes\s*=\s*["'](\d+)x\d+["']/i.exec(tag)?.[1];
      links.push({ href: new URL(href, website).toString(), size: sizes ? Number(sizes) : 0 });
    }
    // 64-д хамгийн ойрхон том хэмжээ нь дээгүүр
    links.sort((a, b) => b.size - a.size);
    return [...new Set(links.map((l) => l.href))];
  } catch {
    return [];
  }
}

/** 64×64 PNG болгож жижигрүүлнэ. SVG-ийг хөрвүүлэхгүй — хэвээр хадгална. */
async function toLogo(buffer: Buffer, contentType: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (contentType === "image/svg+xml") {
    // SVG дотор script байвал вэб дээр аюултай — хатуу шүүнэ
    const text = buffer.toString("utf8");
    if (/<script|onload\s*=|javascript:/i.test(text)) return null;
    return { data: buffer, contentType };
  }
  try {
    const data = await sharp(buffer)
      .resize(LOGO_SIZE, LOGO_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return { data, contentType: "image/png" };
  } catch {
    return null;
  }
}

/** Логыг татаж 64×64 болгоно. Олдохгүй бол null. */
export async function fetchLogo(website: string): Promise<LogoResult | null> {
  const candidates = [
    ...(await iconLinksFrom(website)),
    new URL("/favicon.ico", website).toString(),
    faviconFallbackUrl(website, LOGO_SIZE),
  ];

  for (const url of candidates) {
    const got = await fetchBinary(url);
    if (!got) continue;
    const logo = await toLogo(got.buffer, got.contentType);
    if (logo) return { ...logo, from: url };
  }
  return null;
}

export interface AliveResult {
  ok: boolean;
  status: number | null;
  /** Сайт хариу өгсөн ч ботыг хориглосон (Cloudflare гэх мэт) — эвдэрсэн гэсэн үг биш */
  blocked: boolean;
}

/**
 * Вэбсайт хүртээмжтэй эсэх — seed-ийн логд тэмдэглэхэд.
 *
 * 403/405/429 нь «ботыг хориглов» гэсэн үг — сайт өөрөө ажиллаж байна. Үнэхээр
 * эвдэрсэн нь: холболт бүтэхгүй, 404, эсвэл 5xx.
 */
export async function websiteAlive(website: string): Promise<AliveResult> {
  let lastStatus: number | null = null;

  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(website, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": userAgent() },
      });
      if (res.ok) return { ok: true, status: res.status, blocked: false };
      lastStatus = res.status;
      // Зарим сайт HEAD-ийг хориглодог — GET-ээр дахин оролдоно
      if (res.status === 405 || res.status === 403 || res.status === 429) continue;
      return { ok: false, status: res.status, blocked: false };
    } catch {
      // сүлжээний алдаа — дараагийн аргаар
    }
  }

  const blocked = lastStatus === 403 || lastStatus === 405 || lastStatus === 429;
  return { ok: blocked, status: lastStatus, blocked };
}

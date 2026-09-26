#!/usr/bin/env node
/**
 * SEO аудит: ажиллаж буй сайтын бүх хуудсыг татаж, metadata дутууг жагсаана.
 *
 * Хэрэглээ:
 *   npm run audit:seo                    # http://localhost:3000
 *   npm run audit:seo -- --base=http://localhost:3099
 *   npm run audit:seo -- --json          # CI-д зориулсан гаралт
 *
 * Route-уудыг build-ийн manifest-ээс (.next/app-path-routes-manifest.json) уншина.
 * Динамик хаягуудыг ([slug]) сайтын sitemap.xml-ээс жинхэнэ жишээгээр сольж,
 * хэсэг тус бүрээс нэгийг шалгана — өгөгдлийн сан руу шууд хандахгүй.
 */
import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import {
  MAX_DESC, MAX_TITLE, MIN_DESC, NOINDEX_OK, patternToRegex, resolve, SKIP,
} from "./audit-seo.lib.mjs";

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const BASE = (arg("base", process.env.AUDIT_BASE ?? "http://localhost:3000")).replace(/\/+$/, "");
const AS_JSON = args.includes("--json");

async function routes() {
  const raw = JSON.parse(await readFile(".next/app-path-routes-manifest.json", "utf8"));
  return [...new Set(Object.values(raw))].filter((p) => !SKIP.some((re) => re.test(p))).sort();
}

/** sitemap.xml-ээс жинхэнэ хаягууд */
async function sitemapUrls() {
  const res = await fetch(`${BASE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(/&amp;/g, "&"))
    .map((u) => {
      try { return new URL(u).pathname; } catch { return null; }
    })
    .filter(Boolean);
}

function textOf(doc, sel, attr = "content") {
  const el = doc.querySelector(sel);
  return el ? (attr === "text" ? el.textContent.trim() : (el.getAttribute(attr) ?? "").trim()) : "";
}

async function check(route, url) {
  const res = await fetch(`${BASE}${url}`, { redirect: "follow" });
  const html = await res.text();
  const { document: doc } = parseHTML(html);

  const title = textOf(doc, "title", "text");
  const desc = textOf(doc, 'meta[name="description"]');
  const canonical = textOf(doc, 'link[rel="canonical"]', "href");
  const ogTitle = textOf(doc, 'meta[property="og:title"]');
  const ogDesc = textOf(doc, 'meta[property="og:description"]');
  const ogImage = textOf(doc, 'meta[property="og:image"]');
  const twitter = textOf(doc, 'meta[name="twitter:card"]');
  const robots = textOf(doc, 'meta[name="robots"]');
  const lang = doc.documentElement.getAttribute("lang") ?? "";
  const h1 = doc.querySelectorAll("h1").length;

  const lds = [...doc.querySelectorAll('script[type="application/ld+json"]')];
  const ldTypes = [];
  let ldBroken = false;
  for (const s of lds) {
    try {
      const parsed = JSON.parse(s.textContent);
      for (const one of Array.isArray(parsed) ? parsed : [parsed]) {
        if (one?.["@type"]) ldTypes.push(one["@type"]);
      }
    } catch {
      ldBroken = true;
    }
  }

  const noindexOk = NOINDEX_OK.some((re) => re.test(route));
  const problems = [];
  if (res.status !== 200) problems.push(`HTTP ${res.status}`);
  if (!title) problems.push("title алга");
  else if (title.length > MAX_TITLE + 20) problems.push(`title урт (${title.length})`);
  if (!desc) problems.push("description алга");
  else if (desc.length > MAX_DESC) problems.push(`description урт (${desc.length})`);
  else if (desc.length < MIN_DESC) problems.push(`description богино (${desc.length})`);
  if (!canonical && !noindexOk) problems.push("canonical алга");
  if (!ogTitle) problems.push("og:title алга");
  if (!ogDesc) problems.push("og:description алга");
  if (!ogImage) problems.push("og:image алга");
  if (!twitter) problems.push("twitter:card алга");
  if (lang !== "mn") problems.push(`lang="${lang}"`);
  if (h1 === 0) problems.push("h1 алга");
  else if (h1 > 1) problems.push(`h1 ${h1} ширхэг`);
  if (ldBroken) problems.push("JSON-LD задрахгүй");
  if (!noindexOk && ldTypes.length === 0) problems.push("JSON-LD алга");
  if (noindexOk && !/noindex/.test(robots)) problems.push("noindex дутуу");

  return { route, url, status: res.status, title, descLen: desc.length, canonical, ldTypes, problems };
}

const all = await routes();
let paths = [];
try {
  paths = await sitemapUrls();
} catch (e) {
  console.error(`⚠ sitemap.xml уншигдсангүй (${e.message}) — динамик хуудсууд алгасагдана\n`);
}

const rows = [];
const skipped = [];
for (const route of all) {
  const url = resolve(route, paths);
  if (!url) { skipped.push(route); continue; }
  try {
    rows.push(await check(route, url));
  } catch (e) {
    rows.push({ route, url, status: 0, problems: [`татагдсангүй: ${e.message}`], ldTypes: [] });
  }
}

const bad = rows.filter((r) => r.problems.length > 0);

if (AS_JSON) {
  console.log(JSON.stringify({ base: BASE, checked: rows.length, skipped, rows }, null, 2));
} else {
  console.log(`SEO аудит · ${BASE} · ${rows.length} хуудас шалгав\n`);
  for (const r of rows) {
    const mark = r.problems.length === 0 ? "✓" : "✗";
    const types = r.ldTypes.length ? ` [${r.ldTypes.join(", ")}]` : "";
    console.log(`${mark} ${r.url}${types}`);
    for (const p of r.problems) console.log(`    · ${p}`);
  }
  if (skipped.length) console.log(`\nЖишээ хаяг олдоогүй (sitemap-д алга): ${skipped.join(", ")}`);
  console.log(`\n${rows.length - bad.length}/${rows.length} хуудас цэвэр.`);
}

process.exit(bad.length > 0 ? 1 : 0);

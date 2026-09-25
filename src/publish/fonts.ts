/**
 * Картын фонт — Roboto (кирилл дэмжсэн) `fonts/` дотор.
 *
 * sharp нь SVG-г librsvg-ээр зурдаг бөгөөд фонтоо fontconfig-оос хайдаг. Системд Roboto
 * байхгүй байж болзошгүй (Docker image-д DejaVu л байдаг) тул төслийн `fonts/` хавтсыг
 * заасан түр fontconfig тохиргоо үүсгээд `FONTCONFIG_FILE`-аар зааж өгнө.
 *
 * Энэ модулийг sharp-аар SVG зурахаас **өмнө** import хийх ёстой (fontconfig эхний
 * дуудлагад л уншигддаг).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Картад хэрэглэх фонтын нэр */
export const FONT_FAMILY = "Roboto";

/** Системд байхгүй бол унах нөөц — эдгээр нь Docker image дээр байдаг */
export const FONT_FALLBACK = "DejaVu Sans, Liberation Sans, sans-serif";

function configure(): void {
  if (process.env.FONTCONFIG_FILE) return;           // гаднаас тохируулсан бол хүндэтгэнэ
  const fontsDir = join(process.cwd(), "fonts");
  const dir = join(tmpdir(), "ai-medee-fontconfig");
  try {
    mkdirSync(join(dir, "cache"), { recursive: true });
    const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${join(dir, "cache")}</cachedir>
  <include ignore_missing="yes">/etc/fonts/conf.d</include>
</fontconfig>`;
    const file = join(dir, "fonts.conf");
    writeFileSync(file, conf);
    process.env.FONTCONFIG_FILE = file;
  } catch {
    // Бичиж чадахгүй орчинд системийн фонтоор (DejaVu) зурагдана
  }
}

configure();

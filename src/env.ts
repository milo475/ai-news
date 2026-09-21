/**
 * Шаардлагатай env хувьсагчдыг эхлэхэд шалгана — дутуу бол ойлгомжгүй алдаа гарахын оронд
 * юу дутсаныг шууд хэлнэ.
 */

/** next build үед DB байхгүй (хуудсууд зөвхөн request үед DB-д ханддаг) */
const isBuild = process.env.NEXT_PHASE === "phase-production-build";

function required(name: string, hint = ""): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} тохируулаагүй байна${hint ? ` (${hint})` : ""}. ` +
        `.env эсвэл Railway-ийн Variables дээр нэмнэ үү.`,
    );
  }
  return value;
}

/** Үргэлж шаардлагатай */
export function databaseUrl(): string {
  return isBuild ? (process.env.DATABASE_URL ?? "") : required("DATABASE_URL", "Postgres холболт");
}

/** Agent, openrouter fetcher — LLM/Data API дуудлагад */
export function openRouterKey(): string {
  return required("OPENROUTER_API_KEY", "openrouter.ai/settings/keys");
}

/** Web — хоосон бол /admin 503 буцаана, ажиллахад саад болохгүй */
export function warnIfNoAdminPassword(): void {
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("⚠ ADMIN_PASSWORD тохируулаагүй — /admin хаалттай (503) байна.");
  }
}

/**
 * `npm run studio:kb-check` — мэдлэгийн сангийн «сүүлд шалгасан» огноог гаргана.
 *
 * Хэрэгслийн тоо (кредит, хязгаар, үнэ) хуучирвал студи хуучин баримтаар ажиллана.
 * 60 хоногоос хуучин файлыг ⚠ гэж тэмдэглэнэ; /admin дээр мөн харагдана.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isEntry, runCli } from "../lib/cli";
import { checkedDate, daysSince, isStaleDoc, STALE_DAYS } from "./numbers.api";
import { TOOLS } from "./studio.api";

export interface DocStatus {
  id: string;
  name: string;
  file: string;
  checked: string | null;
  days: number | null;
  stale: boolean;
  retired: boolean;
}

function readDoc(file: string): string {
  try {
    return readFileSync(join(process.cwd(), "src", "studio", file), "utf8");
  } catch {
    return "";
  }
}

export function knowledgeStatus(now = new Date()): DocStatus[] {
  const extra = [
    { id: "craft", name: "Промпт бичих лавлах", doc: "craft" },
    { id: "mongol", name: "Монгол орчны лавлах", doc: "mongol" },
    { id: "ideas", name: "Бүтээлч зарчим", doc: "ideas" },
  ];

  const rows: DocStatus[] = TOOLS.map((t) => ({
    id: t.id, name: t.name, file: `tools/${t.doc}.md`, retired: Boolean(t.retired),
  })).concat(extra.map((e) => ({ id: e.id, name: e.name, file: `${e.doc}.md`, retired: false })) as never)
    .map((r) => {
      const checked = checkedDate(readDoc(r.file));
      return {
        ...r,
        checked,
        days: checked ? daysSince(checked, now) : null,
        stale: isStaleDoc(checked, now),
      };
    });

  return rows.sort((a, b) => (b.days ?? 1e9) - (a.days ?? 1e9));
}

/** /admin-д харуулах хураангуй */
export function staleCount(now = new Date()): number {
  return knowledgeStatus(now).filter((r) => r.stale && !r.retired).length;
}

if (isEntry("kb-check.ts")) {
  await runCli(async () => {
    const rows = knowledgeStatus();
    console.log(`Мэдлэгийн сан — ${rows.length} файл (${STALE_DAYS} хоногийн дүрэм)\n`);
    for (const r of rows) {
      const mark = r.retired ? "·" : r.stale ? "⚠" : "✓";
      const age = r.days === null ? "огноогүй" : `${r.days} хоног`;
      console.log(`  ${mark} ${r.file.padEnd(22)} ${(r.checked ?? "—").padEnd(12)} ${age}`);
    }
    const stale = rows.filter((r) => r.stale && !r.retired);
    console.log("");
    if (stale.length === 0) {
      console.log(`✓ бүх файл ${STALE_DAYS} хоногийн дотор шалгагдсан`);
      return;
    }
    console.log(`⚠ ${stale.length} файл хуучирсан: ${stale.map((r) => r.id).join(", ")}`);
    console.log("  Албан ёсны баримтаас шалгаад «Сүүлд шалгасан» огноог шинэчилнэ үү.");
  });
}

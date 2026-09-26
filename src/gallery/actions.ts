"use server";

/**
 * Галерейн server action-ууд.
 */
import { countCopy } from "./queries";
import { cuid, tryParse } from "@/lib/validate";

/** Карт татах/хуулах тоолуур — нэвтрэхгүй ч ажиллана */
export async function countCardCopyAction(articleId: string): Promise<void> {
  // Тоолуур — буруу id ирвэл чимээгүй алгасна (хэрэглэгчид алдаа үзүүлэх шаардлагагүй)
  const id = tryParse(cuid, articleId);
  if (!id) return;
  await countCopy(id);
}

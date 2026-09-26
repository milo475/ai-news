"use server";

/**
 * Галерейн server action-ууд.
 */
import { countCopy } from "./queries";

/** Карт татах/хуулах тоолуур — нэвтрэхгүй ч ажиллана */
export async function countCardCopyAction(articleId: string): Promise<void> {
  await countCopy(articleId);
}

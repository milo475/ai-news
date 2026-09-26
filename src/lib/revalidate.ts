/**
 * Next-ийн route кэш + процессийн доторх TTL кэшийг хамт цэвэрлэдэг `revalidatePath`.
 *
 * Редактор «нийтлэх» дарахад өөрчлөлт сайт дээр шууд гарах ёстой — хоёр кэшийн
 * аль нэгийг мартвал хуучин агуулга үлдэнэ. Тиймээс action файлууд next/cache-ээс
 * биш, эндээс импортолно.
 */
import { revalidatePath as nextRevalidatePath } from "next/cache";
import { clearAllCaches } from "./cache.api";

export function revalidatePath(path: string, type?: "page" | "layout"): void {
  clearAllCaches();
  nextRevalidatePath(path, type);
}

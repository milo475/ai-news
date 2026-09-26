"use server";

import { revalidatePath } from "@/lib/revalidate";
import { clearErrors } from "@/lib/errors";

/** Бүртгэлийг цэвэрлэх — асуудлыг засчихсан бол дарна */
export async function clearErrorLog(): Promise<void> {
  await clearErrors();
  revalidatePath("/admin/aldaa");
  revalidatePath("/admin");
}

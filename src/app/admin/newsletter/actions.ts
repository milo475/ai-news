"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { runNewsletter } from "@/newsletter/send";
import { emailSchema } from "@/newsletter/subscribe";

/** Сүүлийн digest-ийг зөвхөн нэг хаяг руу туршиж илгээнэ */
export async function sendTest(formData: FormData) {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) redirect("/admin/newsletter?msg=" + encodeURIComponent("имэйл буруу"));

  let msg: string;
  try {
    const r = await runNewsletter({ testEmail: parsed.data });
    msg = r.skipped ? (r.reason ?? "алгасав") : `${parsed.data} руу илгээв (алдаа ${r.failed})`;
  } catch (e) {
    msg = (e as Error).message.slice(0, 160);
  }
  revalidatePath("/admin/newsletter");
  redirect(`/admin/newsletter?msg=${encodeURIComponent(msg)}`);
}

/** Бүртгэлийг CSV болгож буцаана (админ өөрөө хуулж авна) */
export async function exportCsv(): Promise<string> {
  const rows = await prisma.subscriber.findMany({
    orderBy: { createdAt: "asc" },
    select: { email: true, status: true, createdAt: true, confirmedAt: true },
  });
  const head = "email,status,createdAt,confirmedAt";
  const body = rows.map((r) =>
    [r.email, r.status, r.createdAt.toISOString(), r.confirmedAt?.toISOString() ?? ""].join(","),
  );
  return [head, ...body].join("\n");
}

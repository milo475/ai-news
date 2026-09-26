"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { parseChecker, parseRubric } from "@/bench/task.api";
import { Prisma } from "@/generated/prisma/client";
import { formId } from "@/lib/validate";

function back(msg: string, open?: string): never {
  const qs = new URLSearchParams({ msg });
  if (open) qs.set("open", open);
  redirect(`/admin/benchmark?${qs}`);
}

function revalidateBench() {
  revalidatePath("/benchmark");
  revalidatePath("/benchmark/[modelSlug]", "page");
  revalidatePath("/benchmark/argachlal");
  revalidatePath("/admin/benchmark");
  revalidatePath("/sitemap.xml");
}

/** Run-ыг ард нь эхлүүлнэ (HTTP timeout-аас сэргийлж тусдаа процесс) */
export async function startBenchAction(form: FormData) {
  const month = String(form.get("month") ?? "").trim() || undefined;
  const { startJob } = await import("@/jobs/runner");
  const r = await startJob("bench");
  revalidatePath("/admin/benchmark");
  back(r.started ? `Бенчмарк эхэллээ${month ? ` (${month})` : ""} — явцыг доороос хараарай.` : (r.reason ?? "Эхлүүлж чадсангүй"));
}

/** Даалгаврыг засах */
export async function saveTaskAction(form: FormData) {
  const id = formId(form);
  const rubricRaw = String(form.get("rubric") ?? "[]");
  const checkerRaw = String(form.get("checker") ?? "").trim();

  let rubric: unknown;
  try {
    rubric = JSON.parse(rubricRaw);
  } catch {
    back("Шалгуур нь JSON биш байна.", id);
  }
  if (parseRubric(rubric).length === 0) back("Шалгуур хоосон эсвэл буруу хэлбэртэй.", id);

  let checker: unknown = null;
  if (checkerRaw) {
    try {
      checker = JSON.parse(checkerRaw);
    } catch {
      back("Тодорхой шалгалт нь JSON биш байна.", id);
    }
    if (!parseChecker(checker)) back("Тодорхой шалгалтын хэлбэр танигдсангүй.", id);
  }

  await prisma.benchTask.update({
    where: { id },
    data: {
      title: String(form.get("title") ?? "").trim(),
      prompt: String(form.get("prompt") ?? "").trim(),
      reference: String(form.get("reference") ?? "").trim() || null,
      rubric: rubric as Prisma.InputJsonValue,
      checker: checkerRaw ? (checker as Prisma.InputJsonValue) : Prisma.DbNull,
      weight: Math.max(1, Number(form.get("weight") ?? 1) || 1),
      isPublic: form.get("isPublic") === "on",
    },
  });
  revalidateBench();
  back("Даалгавар хадгалагдлаа.", id);
}

export async function toggleTaskAction(form: FormData) {
  const id = formId(form);
  const t = await prisma.benchTask.findUniqueOrThrow({ where: { id }, select: { isActive: true } });
  await prisma.benchTask.update({ where: { id }, data: { isActive: !t.isActive } });
  revalidateBench();
  back(t.isActive ? "Даалгавар идэвхгүй боллоо." : "Даалгавар идэвхжлээ.");
}

/**
 * Үр дүнд гараар оноо өгнө. Оноо өөрчлөгдөхөд тухайн run-ийн дүнг дахин бодно —
 * эс тэгвээс эрэмбэ хуучин оноон дээр үлдэнэ.
 */
export async function scoreResultAction(form: FormData) {
  const id = formId(form);
  const raw = String(form.get("humanScore") ?? "").trim();
  const note = String(form.get("humanNote") ?? "").trim();

  let humanScore: number | null = null;
  if (raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 10) back("Оноо 0–10 хооронд байна.", id);
    humanScore = Math.round(n * 10) / 10;
  }

  const r = await prisma.benchResult.update({
    where: { id },
    data: { humanScore, humanNote: note || null },
    select: { runId: true },
  });

  const { recomputeSummaries } = await import("@/bench/recompute");
  await recomputeSummaries(r.runId);
  revalidateBench();
  back(humanScore === null ? "Гар оноог хаслаа, дүн дахин бодогдлоо." : `Оноо ${humanScore} — дүн дахин бодогдлоо.`);
}

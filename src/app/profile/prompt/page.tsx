import Link from "next/link";
import { requireUser } from "@/auth/session";
import { fmtDate } from "@/components/format";
import { myPrompts } from "@/prompts/queries";
import { deleteMyPromptAction } from "@/prompts/actions";
import { PROMPT_CATEGORY_LABEL } from "@/prompts/prompt.api";

export const metadata = { title: "Миний prompt" };

const STATUS_LABEL = {
  PENDING: { text: "хянагдаж байна", cls: "border-line text-muted" },
  PUBLISHED: { text: "нийтлэгдсэн", cls: "border-up/50 text-up" },
  REJECTED: { text: "татгалзсан", cls: "border-down/50 text-down" },
} as const;

export default async function MyPromptsPage() {
  const user = await requireUser();
  const prompts = await myPrompts(user.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">
          Таны нэмсэн prompt-ууд. Нийтлэгдсэн нь Prompt санд бүх хүнд харагдана.
        </p>
        <Link href="/prompt/nemeh" className="text-sm text-accent hover:underline whitespace-nowrap">
          Prompt нэмэх →
        </Link>
      </div>

      {prompts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
          Та одоохондоо prompt нэмээгүй байна.
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {prompts.map((p) => {
            const badge = STATUS_LABEL[p.status];
            return (
              <li key={p.id} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs rounded px-1.5 py-0.5 border ${badge.cls}`}>{badge.text}</span>
                  {p.status === "PUBLISHED" ? (
                    <Link href={`/prompt/${p.slug}`} className="font-medium hover:text-accent">{p.title}</Link>
                  ) : (
                    <span className="font-medium">{p.title}</span>
                  )}
                  <span className="text-xs text-muted">{PROMPT_CATEGORY_LABEL[p.category]}</span>
                  <form action={deleteMyPromptAction} className="ml-auto">
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-xs rounded border border-line px-2 py-1 text-muted hover:text-down">
                      Устгах
                    </button>
                  </form>
                </div>
                {p.description && <p className="text-sm text-muted">{p.description}</p>}
                {p.rejectReason && (
                  <p className="text-xs text-down">Шалтгаан: {p.rejectReason}</p>
                )}
                <p className="text-xs text-muted">
                  {fmtDate(p.createdAt)}
                  {p.status === "PUBLISHED" && ` · ${p.copies} хуулсан · ${p.likes} таалагдсан`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

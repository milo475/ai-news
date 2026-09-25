import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth/session";
import { PromptSubmitForm } from "@/components/PromptSubmitForm";
import { submittedToday } from "@/prompts/mutations";
import { DAILY_SUBMIT_LIMIT, remainingToday } from "@/prompts/prompt.api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prompt нэмэх", robots: { index: false } };

export default async function AddPromptPage() {
  const user = await currentUser();
  if (!user) redirect("/nevtreh?ur=%2Fprompt%2Fnemeh");

  if (!user.verified) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Prompt нэмэх</h1>
        <p className="rounded border border-warn/50 text-sm px-3 py-2">
          Prompt нэмэхийн тулд эхлээд имэйлээ баталгаажуулна уу.
        </p>
        <Link href="/profile" className="text-sm text-accent hover:underline">
          Профайлаас баталгаажуулах холбоос дахин авах →
        </Link>
      </div>
    );
  }

  const used = await submittedToday(user.id);

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-1">
        <Link href="/prompt" className="text-sm text-muted hover:text-ink">← Prompt сан</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Prompt нэмэх</h1>
        <p className="text-sm text-muted">
          Ажилдаа ашигладаг сайн prompt-оо бусадтай хуваалцаарай. Өдөрт {DAILY_SUBMIT_LIMIT} хүртэл.
        </p>
      </div>
      <PromptSubmitForm remaining={remainingToday(used)} />
    </div>
  );
}

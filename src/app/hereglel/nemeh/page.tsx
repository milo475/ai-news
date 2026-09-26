import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth/session";
import { ToolSubmitForm } from "@/components/ToolSubmitForm";
import { submittedToolsToday } from "@/tools/mutations";
import { DAILY_TOOL_LIMIT } from "@/tools/tool.api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Хэрэгсэл нэмэх", robots: { index: false } };

export default async function AddToolPage() {
  const user = await currentUser();
  if (!user) redirect("/nevtreh?ur=%2Fhereglel%2Fnemeh");

  if (!user.verified) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Хэрэгсэл нэмэх</h1>
        <p className="rounded border border-warn/50 text-sm px-3 py-2">
          Хэрэгсэл санал болгохын тулд эхлээд имэйлээ баталгаажуулна уу.
        </p>
        <Link href="/profile" className="text-sm text-accent hover:underline">
          Профайлаас баталгаажуулах холбоос дахин авах →
        </Link>
      </div>
    );
  }

  const used = await submittedToolsToday(user.id);

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-1">
        <Link href="/hereglel" className="text-sm text-muted hover:text-ink">← AI хэрэгсэл</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Хэрэгсэл нэмэх</h1>
        <p className="text-sm text-muted">
          Монгол хэрэглэгчдэд хэрэгтэй AI хэрэгсэл мэдэж байвал санал болгоорой.
        </p>
      </div>
      <ToolSubmitForm remaining={Math.max(0, DAILY_TOOL_LIMIT - used)} />
    </div>
  );
}

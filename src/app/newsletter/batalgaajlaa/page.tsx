import Link from "next/link";
import { TrackEvent } from "@/components/Track";

export const metadata = { title: "Баталгаажлаа", robots: { index: false } };

export default async function Batalgaajlaa({ searchParams }: { searchParams: Promise<{ aldaa?: string }> }) {
  const failed = (await searchParams).aldaa === "1";
  return (
    <div className="max-w-md space-y-3">
      {!failed && <TrackEvent event="newsletter_confirm" />}
      <h1 className="text-2xl font-semibold tracking-tight">
        {failed ? "Холбоос хүчингүй байна" : "Баталгаажлаа 🎉"}
      </h1>
      <p className="text-muted">
        {failed
          ? "Баталгаажуулах холбоос хугацаа нь дууссан эсвэл аль хэдийн ашиглагдсан байна. Дахин бүртгүүлнэ үү."
          : "Долоо хоногт нэг удаа AI-ийн тоймыг таны имэйл рүү илгээнэ. Хүссэн үедээ гарч болно."}
      </p>
      <Link href="/" className="text-sm text-accent hover:underline">← Нүүр хуудас</Link>
    </div>
  );
}

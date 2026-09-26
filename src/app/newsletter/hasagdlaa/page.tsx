import Link from "next/link";

export const metadata = { title: "Бүртгэлээс гарлаа", robots: { index: false } };

export default async function Hasagdlaa({ searchParams }: { searchParams: Promise<{ aldaa?: string }> }) {
  const failed = (await searchParams).aldaa === "1";
  return (
    <div className="max-w-md space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        {failed ? "Холбоос хүчингүй байна" : "Бүртгэлээс гарлаа"}
      </h1>
      <p className="text-muted">
        {failed
          ? "Энэ холбоос ажиллахгүй байна. Аль хэдийн гарсан байж магадгүй."
          : "Цаашид имэйл илгээхгүй. Хүсвэл дахин бүртгүүлж болно."}
      </p>
      <Link href="/" className="text-sm text-accent hover:underline">← Нүүр хуудас</Link>
    </div>
  );
}

import Link from "next/link";
import { verifyEmail } from "@/auth/actions";
import { TrackEvent } from "@/components/Track";

export const metadata = { title: "Имэйл баталгаажуулах", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyEmail(token);

  return (
    <div className="mx-auto max-w-sm space-y-4 text-center">
      {result.ok ? (
        <>
          <TrackEvent event="verify_email" />
          <h1 className="text-2xl font-semibold tracking-tight">Имэйл баталгаажлаа</h1>
          <p className="text-sm text-muted">
            {result.email} хаяг баталгаажлаа. Одоо бүх боломжийг ашиглах боломжтой.
          </p>
          <p>
            <Link href="/nevtreh?batalgaa=1" className="text-accent hover:underline">Нэвтрэх →</Link>
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Холбоос хүчингүй</h1>
          <p className="text-sm text-muted">
            Энэ холбоосын хугацаа дууссан эсвэл аль хэдийн ашиглагдсан байна.
            Профайл хуудсаасаа шинэ холбоос захиалж болно.
          </p>
          <p>
            <Link href="/nevtreh" className="text-accent hover:underline">Нэвтрэх →</Link>
          </p>
        </>
      )}
    </div>
  );
}

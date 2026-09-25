import { requireUser } from "@/auth/session";
import { ActionForm, input, Submit } from "@/components/AuthForm";
import { prisma } from "@/db";
import { deleteAccountAction, signOutEverywhereAction } from "../actions";

export const metadata = { title: "Аюулгүй байдал" };

export default async function SecurityPage() {
  const user = await requireUser();
  const [bookmarks, accounts] = await Promise.all([
    prisma.bookmark.count({ where: { userId: user.id } }),
    prisma.account.findMany({ where: { userId: user.id }, select: { provider: true } }),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line p-4 space-y-3">
        <h2 className="text-sm font-semibold">Бүх төхөөрөмжөөс гарах</h2>
        <p className="text-xs text-muted">
          Өөр компьютер, утсан дээр нээлттэй үлдсэн бүх сешн хаагдана. Та энэ төхөөрөмж дээр ч дахин нэвтэрнэ.
        </p>
        <form action={signOutEverywhereAction}>
          <Submit>Бүгдээс гарах</Submit>
        </form>
      </section>

      <section className="rounded-lg border border-line p-4 space-y-2 text-sm">
        <h2 className="text-sm font-semibold">Холбогдсон бүртгэл</h2>
        {accounts.length === 0 ? (
          <p className="text-muted text-xs">Зөвхөн имэйл + нууц үгээр нэвтэрдэг.</p>
        ) : (
          <ul className="text-xs text-muted">
            {accounts.map((a) => <li key={a.provider}>{a.provider}</li>)}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-down/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-down">Бүртгэл устгах</h2>
        <p className="text-xs text-muted">
          Бүртгэл, хадгалсан {bookmarks} нийтлэл, сонирхлын тохиргоо, имэйлийн бүртгэл бүгд бүрмөсөн устана.
          Энэ үйлдлийг буцаах боломжгүй.
        </p>
        <ActionForm action={deleteAccountAction} className="space-y-2">
          <label className="block space-y-1">
            <span className="text-xs text-muted">Баталгаажуулахын тулд УСТГАХ гэж бичнэ үү</span>
            <input name="confirm" required autoComplete="off" className={input} />
          </label>
          <Submit>Бүртгэлээ устгах</Submit>
        </ActionForm>
      </section>
    </div>
  );
}

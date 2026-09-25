import { requireUser } from "@/auth/session";
import { getPreference } from "@/bookmarks/preferences";
import { CATEGORIES, CATEGORY_HINT, CATEGORY_LABEL } from "@/agent/category";
import { getUseCases } from "@/data";
import { ActionForm, Submit } from "@/components/AuthForm";
import { savePreferencesAction } from "../actions";

export const metadata = { title: "Сонирхол" };

export default async function InterestsPage() {
  const user = await requireUser();
  const [pref, useCases] = await Promise.all([getPreference(user.id), getUseCases()]);
  const chosenCat = new Set<string>(pref.categories);
  const chosenUse = new Set(pref.usecases);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Сонгосон сэдвүүд чинь нүүр хуудсанд «Таны сонирхол» болж харагдана. Юу ч сонгохгүй бол бүх сэдэв харагдана.
      </p>

      <ActionForm action={savePreferencesAction} className="space-y-6">
        <section className="rounded-lg border border-line p-4 space-y-3">
          <h2 className="text-sm font-semibold">Ангилал</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <label key={c} className="flex gap-2 items-start rounded border border-line p-2.5 hover:bg-line/30">
                <input
                  type="checkbox" name="categories" value={c}
                  defaultChecked={chosenCat.has(c)}
                  className="mt-0.5 accent-accent"
                />
                <span className="min-w-0">
                  <span className="text-sm font-medium block">{CATEGORY_LABEL[c]}</span>
                  <span className="text-xs text-muted block">{CATEGORY_HINT[c]}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        {useCases.length > 0 && (
          <section className="rounded-lg border border-line p-4 space-y-3">
            <h2 className="text-sm font-semibold">Хэрэглээ</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {useCases.map((u) => (
                <label key={u.slug} className="flex gap-2 items-center rounded border border-line p-2.5 hover:bg-line/30">
                  <input
                    type="checkbox" name="usecases" value={u.slug}
                    defaultChecked={chosenUse.has(u.slug)}
                    className="accent-accent"
                  />
                  <span className="text-sm">{u.nameMn}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-line p-4 space-y-2">
          <h2 className="text-sm font-semibold">Имэйл</h2>
          <label className="flex gap-2 items-center">
            <input type="checkbox" name="digestEmail" defaultChecked={pref.digestEmail} className="accent-accent" />
            <span className="text-sm">Долоо хоногийн тоймыг имэйлээр авах</span>
          </label>
          <p className="text-xs text-muted">{user.email} хаяг руу долоо хоногт нэг удаа илгээнэ.</p>
        </section>

        <Submit>Хадгалах</Submit>
      </ActionForm>
    </div>
  );
}

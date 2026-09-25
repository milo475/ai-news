"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitPromptAction, type SubmitState } from "@/prompts/actions";
import {
  extractVariables, MAX_DESCRIPTION, MAX_TITLE, MIN_BODY, PROMPT_CATEGORIES,
  PROMPT_CATEGORY_HINT, PROMPT_CATEGORY_LABEL, splitVariables,
} from "@/prompts/prompt.api";
import { track } from "@/lib/analytics";

const input = "w-full rounded border border-line bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-accent";
const TOOLS = ["ChatGPT", "Gemini", "Claude", "Copilot", "Canva", "Perplexity"];

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending || disabled}
      className="w-full rounded bg-accent text-white px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Шалгаж байна…" : "Илгээх"}
    </button>
  );
}

/** Prompt нэмэх форм — бичихийн зэрэгцээ урьдчилан харуулна */
export function PromptSubmitForm({ remaining }: { remaining: number }) {
  const [state, formAction] = useActionState(submitPromptAction, {} as SubmitState);
  const [body, setBody] = useState("");
  const variables = extractVariables(body);
  const segments = splitVariables(body);
  const outOfQuota = remaining <= 0;

  return (
    <form action={formAction} className="space-y-4" onSubmit={() => track("prompt_submit")}>
      {state.error && (
        <p className="rounded border border-down/50 text-down text-sm px-3 py-2">{state.error}</p>
      )}
      {state.rejected && (
        <div className="rounded border border-down/50 text-sm px-3 py-2 space-y-1">
          <p className="text-down font-medium">Автомат шалгалт татгалзлаа</p>
          <p className="text-muted">{state.rejected}</p>
          <p className="text-muted text-xs">
            Алдаатай гэж бодож байвал засаад дахин илгээнэ үү — админ гар аргаар ч хянадаг.
          </p>
        </div>
      )}
      {state.ok && <p className="rounded border border-up/50 text-up text-sm px-3 py-2">{state.ok}</p>}

      <label className="block space-y-1">
        <span className="text-xs text-muted">Гарчиг</span>
        <input name="title" required minLength={5} maxLength={MAX_TITLE} className={input}
          placeholder="Жишээ нь: Долоо хоногийн ажлын тайлан бичих" />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Юунд зориулсан бэ (≤{MAX_DESCRIPTION} тэмдэгт)</span>
        <input name="description" maxLength={MAX_DESCRIPTION} className={input}
          placeholder="Нэг өгүүлбэрээр тайлбарлана уу" />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Ангилал</span>
        <select name="category" required defaultValue="" className={input}>
          <option value="" disabled>— сонгоно уу —</option>
          {PROMPT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{PROMPT_CATEGORY_LABEL[c]} — {PROMPT_CATEGORY_HINT[c]}</option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-1">
        <legend className="text-xs text-muted">Аль хэрэгсэлд тохирох вэ (сонголт)</legend>
        <div className="flex flex-wrap gap-3">
          {TOOLS.map((t) => (
            <label key={t} className="flex gap-1.5 items-center text-sm">
              <input type="checkbox" name="tools" value={t} className="accent-accent" />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Prompt-ын текст ({MIN_BODY}+ тэмдэгт)</span>
        <textarea
          name="body" required minLength={MIN_BODY} rows={10} className={`${input} font-mono`}
          value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={"Чи миний туслах. {компанийн нэр}-ийн энэ долоо хоногийн ажлыг…"}
        />
      </label>

      <p className="text-xs text-muted">
        Бусад хүн өөрийн мэдээллээр солих хэсгийг <code className="rounded bg-line/50 px-1">{"{"}хаалтанд{"}"}</code>{" "}
        бичнэ үү — жишээ нь {"{"}компанийн нэр{"}"}, {"{"}сарын орлого{"}"}. Эдгээр нь бөглөх нүх болж харагдана.
      </p>

      {body.trim().length > 0 && (
        <section className="rounded-lg border border-line p-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs uppercase tracking-widest text-muted">Урьдчилан харах</h2>
            <span className="text-xs text-muted">
              {variables.length > 0 ? `${variables.length} хувьсагч` : "хувьсагчгүй"}
            </span>
          </div>
          <pre className="text-sm whitespace-pre-wrap break-words font-mono">
            {segments.map((s, i) =>
              s.variable ? (
                <span key={i} className="rounded bg-accent/15 text-accent px-1">{`{${s.text}}`}</span>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </pre>
        </section>
      )}

      <Submit disabled={outOfQuota} />
      <p className="text-xs text-muted">
        {outOfQuota
          ? "Өнөөдрийн хязгаар дүүрлээ. Маргааш дахин илгээнэ үү."
          : `Өнөөдөр ${remaining} prompt илгээх боломжтой. Илгээсэн prompt автомат шалгалтаас давсны дараа админ хянаж нийтэлнэ.`}
      </p>
    </form>
  );
}

import Link from "next/link";
import { fmtDate } from "@/components/format";
import { latestBoard, taskCountByCategory } from "@/bench/queries";
import { BENCH_CATEGORIES, BENCH_CATEGORY_HINT, BENCH_CATEGORY_LABEL } from "@/bench/task.api";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Монгол хэлний AI бенчмаркийг хэрхэн хэмждэг вэ: даалгаврын ангилал, шүүгч модель, " +
  "тодорхой шалгалт, хязгаарлалт.";

export const metadata = {
  title: "Бенчмаркийн аргачлал",
  description: clamp(DESCRIPTION, MAX_META_DESCRIPTION),
  alternates: { canonical: `${siteUrl()}/benchmark/argachlal` },
};

export default async function MethodPage() {
  const [board, counts] = await Promise.all([latestBoard(), taskCountByCategory()]);
  const total = Object.values(counts).reduce((n, c) => n + (c ?? 0), 0);

  return (
    <article className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Link href="/benchmark" className="text-sm text-muted hover:text-ink">← Бенчмарк</Link>
        <h1 className="text-3xl font-semibold tracking-tight">Хэрхэн хэмждэг вэ</h1>
        <p className="text-muted">{DESCRIPTION}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Яагаад энэ хэмжилт хэрэгтэй вэ</h2>
        <p className="text-[15px] leading-relaxed">
          Дэлхийн бенчмаркууд англи хэл дээр хэмждэг. Монгол хэл дээр ямар модель сайн ажилладгийг
          хэн ч тогтмол хэмждэггүй. Гэтэл монгол хэрэглэгчийн хувьд энэ бол хамгийн чухал асуулт —
          англиар шилдэг модель монголоор эвгүй бичиж, монгол соёлын талаар буруу баримт хэлж болно.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Даалгаврууд</h2>
        <p className="text-[15px] leading-relaxed">
          Нийт {total || 30} даалгавар, {BENCH_CATEGORIES.length} ангилалд хуваагдана. Даалгавар бүр
          бодит монгол агуулгатай: банкны мэдээ, гэрээний заалт, ХХК-ийн албан бичиг, УБ-ын
          автобусны хуваарь, Наадам, Цагаан сарын баримт гэх мэт.
        </p>
        <ul className="divide-y divide-line rounded-lg border border-line text-sm">
          {BENCH_CATEGORIES.map((c) => (
            <li key={c} className="p-3 flex gap-3">
              <span className="font-medium w-32 shrink-0">{BENCH_CATEGORY_LABEL[c]}</span>
              <span className="text-muted flex-1">{BENCH_CATEGORY_HINT[c]}</span>
              <span className="text-muted tabular-nums">{counts[c] ?? 0}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          <strong>Даалгаврыг нийтэд харуулахгүй.</strong> Хэрэв бүгдийг нээвэл дараагийн үеийн
          моделиуд эдгээрийг сургалтдаа оруулж, оноо нь зохиомлоор өснө (contamination). Ангилал
          бүрийн агуулгыг тайлбарлаж, цөөн жишээ даалгаврыг{" "}
          <Link href="/benchmark" className="text-accent hover:underline">эрэмбийн хуудас</Link> дээр
          нээлттэй тавьсан.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Модель бүрийг ижил нөхцөлд</h2>
        <ul className="space-y-1.5 text-[15px] list-disc pl-5">
          <li>Температур 0 — санамсаргүй байдлыг багасгана.</li>
          <li>Хамгийн ихдээ 1200 токен, 60 секундын хязгаар.</li>
          <li>Алдаа гарвал 2 удаа дахин оролдоно. Гурав дахь удаад тухайн даалгавар 0 оноо.</li>
          <li>Системийн заавар бүгдэд ижил: «зөвхөн хүссэн үр дүнг гарга».</li>
          <li>
            Тестлэх моделиуд: OpenRouter-ийн хэрэглээний топ 15, дээр нь GPT, Claude, Gemini-ийн
            flagship-ууд заавал орно.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Хоёр давхар үнэлгээ</h2>
        <p className="text-[15px] leading-relaxed">
          <strong>Тодорхой шалгалт.</strong> Зарим даалгаварт машинаар хэмжигдэх шаардлага бий:
          JSON хүчинтэй эсэх, үгийн тооны хязгаар, кирилл үсгийн хувь. Энэ шалгалт унавал тухайн
          даалгаврын оноо шууд 0 — LLM шүүгч ямар ч тайлбар хэлсэн хамаагүй.
        </p>
        <p className="text-[15px] leading-relaxed">
          <strong>LLM шүүгч.</strong> Үлдсэнийг нь хүчирхэг модель{" "}
          {board?.judgeModel ? <code className="rounded bg-line/50 px-1">{board.judgeModel}</code> : "шүүгч модель"}{" "}
          даалгавар, лавлах хариулт, 3–4 шалгуурын хамт уншиж 0–10 оноо өгнө. Лавлах хариулт нь
          цорын ганц зөв хувилбар биш — өөр найруулгаар зөв гүйцэтгэсэн бол өндөр оноо авна.
        </p>
        <p className="text-[15px] leading-relaxed">
          <strong>Шүүгч өөрийгөө шүүхээс сэргийлэх.</strong> Шүүгчтэй ижил компанийн моделийг
          (жишээ нь Anthropic-ийн шүүгч Claude-ыг) хоёр дахь, өөр компанийн шүүгчээр давхар
          үнэлүүлж дунджийг авна.
        </p>
        <p className="text-[15px] leading-relaxed">
          <strong>Хүний хяналт.</strong> Редактор аль ч үр дүнг гараар дахин оноож болно. Гараар
          өгсөн оноо LLM шүүгчийнхийг дарна.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Оноо хэрхэн бодогддог</h2>
        <p className="text-[15px] leading-relaxed">
          Нийт оноо нь даалгавруудын <strong>жигнэсэн дундаж</strong>. Заавар дагах, JSON гаргах
          зэрэг хатуу даалгаврууд 2 дахин их жинтэй. Ангилал бүрийн оноо нь тухайн ангиллын
          даалгавруудын дундаж. Оноо тэнцвэл хурдан нь дээгүүр эрэмбэлэгдэнэ.
        </p>
        <p className="text-[15px] leading-relaxed">
          «Монгол 1000 үгийн үнэ» нь зарласан тарифаас биш, <strong>бодит хэмжилтээс</strong>{" "}
          гардаг: тестийн явцад зарцуулсан мөнгийг гаргасан монгол үгийн тоонд хуваана. Монгол
          кирилл үсэг англиас илүү токен иддэг тул энэ тоо нь жинхэнэ зардлыг илүү үнэн харуулна.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Хязгаарлалт — үүнийг мэдэж байгаарай</h2>
        <ul className="space-y-1.5 text-[15px] list-disc pl-5">
          <li>
            {total || 30} даалгавар нь хэл шинжлэлийн бүрэн зураглал биш. Энэ бол хэрэглээний зэрэг
            харуулсан хэмжилт болохоос эрдэм шинжилгээний бенчмарк биш.
          </li>
          <li>
            LLM шүүгч өөрөө алдаж болно. Ялангуяа монгол соёл, дүрмийн нарийн асуудалд. Хүний
            хяналт үүнийг бүрэн арилгахгүй.
          </li>
          <li>
            Үр дүн нь тухайн сарын моделийн хувилбарт хамаарна. Модель чимээгүй шинэчлэгдэж болно.
          </li>
          <li>
            Хурд нь сүлжээ, provider-ийн ачааллаас хамаарна — ойролцоо үзүүлэлт.
          </li>
          <li>Төсөв хэтэрвэл зарим модель тестлэгдэхгүй үлдэж болно. Тэр тохиолдолд ил тэмдэглэнэ.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Давтамж</h2>
        <p className="text-[15px] leading-relaxed">
          Сар бүрийн эхээр автоматаар ажиллана. Үр дүн нь{" "}
          <Link href="/benchmark" className="text-accent hover:underline">/benchmark</Link> хуудсанд
          шинэчлэгдэж, өмнөх сартай харьцуулсан өөрчлөлт харагдана.
          {board?.finishedAt && ` Сүүлийн хэмжилт: ${fmtDate(board.finishedAt)}.`}
        </p>
      </section>
    </article>
  );
}

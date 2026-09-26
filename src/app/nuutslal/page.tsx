import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/jsonld.api";
import { CONTACT_EMAIL, siteUrl } from "@/lib/site";

export const revalidate = 86_400;

export const metadata: Metadata = {
  title: "Нууцлалын бодлого",
  description:
    "AI News ямар мэдээлэл цуглуулдаг, юунд ашигладаг, хэрхэн устгуулах вэ — товч, ойлгомжтой.",
  alternates: { canonical: "/nuutslal" },
};

/** Хамгийн сүүлд шинэчилсэн огноо — агуулга өөрчлөгдөх бүрд гараар шинэчилнэ */
const UPDATED = "2026-09-26";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2 text-[15px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function Nuutslal() {
  return (
    <div className="max-w-2xl space-y-8">
      <JsonLd data={breadcrumbJsonLd(siteUrl(), [{ name: "Нууцлалын бодлого" }])} />

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Нууцлалын бодлого</h1>
        <p className="text-sm text-muted">Сүүлд шинэчилсэн: {UPDATED}</p>
      </div>

      <p className="text-[15px] leading-relaxed">
        AI News нь хэрэглэгчийн мэдээллийг хамгийн бага хэмжээгээр цуглуулдаг. Бид мэдээллийг
        зардаггүй, зар сурталчилгааны сүлжээнд дамжуулдаггүй.
      </p>

      <Section title="1. Аналитик (нэргүй статистик)">
        <p>
          Хуудас хэр их үзэгдэж байгааг{" "}
          <a href="https://umami.is" target="_blank" rel="noopener nofollow" className="text-accent hover:underline">
            Umami
          </a>{" "}
          -гаар хэмждэг. Umami нь cookie ашигладаггүй, IP хаягийг хадгалдаггүй, хэрэглэгчийг сайт
          хооронд дагадаггүй. Бид зөвхөн нэгтгэсэн тоо (хуудасны үзэлт, аль товч дарагдсан, ямар
          төхөөрөмж) харна — хэн болохыг тань таних боломжгүй.
        </p>
        <p>
          Хайлтын үгсийг (хэн хайсныг биш, зөвхөн үгийг) сайт сайжруулах зорилгоор хадгалдаг.
        </p>
      </Section>

      <Section title="2. Бүртгэл">
        <p>
          Бүртгүүлэх нь сайн дурын. Бүртгүүлбэл бид таны <b>имэйл хаяг</b>, <b>харагдах нэр</b>,
          Google-ээр нэвтэрсэн бол профайлын <b>зургийн холбоос</b>-ыг хадгална. Нууц үгийг
          эргүүлэн уншихгүй байдлаар (bcrypt hash) хадгалдаг.
        </p>
        <p>
          Нэвтэрсэн хэрэглэгчийн хувьд хадгалсан зүйлс (bookmark), сонирхлын сэдэв, өгсөн үнэлгээ,
          нэмсэн prompt/хэрэгсэл нь таны данстай холбоотой хадгалагдана.
        </p>
      </Section>

      <Section title="3. Cookie болон хөтчийн санах ой">
        <p>
          Бид зар сурталчилгааны cookie ашигладаггүй. Зөвхөн дараах хоёр зүйл байна:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Нэвтрэлтийн cookie</b> — зөвхөн нэвтэрсэн үед үүснэ, таныг дараагийн айлчлалд танина.
            Гараад гарвал устана.
          </li>
          <li>
            <b>theme</b> — хөтчийн localStorage дахь «бараан/цайвар» сонголт. Сервер рүү илгээгддэггүй.
          </li>
        </ul>
      </Section>

      <Section title="4. Имэйл захиалга">
        <p>
          Долоо хоногийн тоймын захиалга нь сайн дурын. Имэйл хаягийг зөвхөн тухайн захиаг илгээхэд
          ашиглана; илгээх ажлыг{" "}
          <a href="https://resend.com" target="_blank" rel="noopener nofollow" className="text-accent hover:underline">
            Resend
          </a>{" "}
          гүйцэтгэдэг. Захиа бүрийн доор «бүртгэлээс гарах» холбоос байна — нэг дарахад устана.
        </p>
      </Section>

      <Section title="5. Гуравдагч талууд">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Google</b> — «Google-ээр нэвтрэх» сонговол таны имэйл, нэрийг бидэнд дамжуулна.</li>
          <li><b>Resend</b> — имэйл илгээлт.</li>
          <li><b>Railway</b> — сервер болон мэдээллийн сан.</li>
          <li>
            <b>Facebook / Instagram</b> — бид тэнд нийтэлдэг. Сайт дээр тэдний tracking pixel
            байхгүй; «Хуваалцах» товч дарж байж л тэдэнд хүсэлт очно.
          </li>
        </ul>
        <p>
          Мэдээний хураангуйг бэлтгэхэд хэлний модель (OpenRouter) ашигладаг. Тэнд <b>зөвхөн олон
          нийтэд нээлттэй мэдээний текст</b> очдог — хэрэглэгчийн мэдээлэл хэзээ ч илгээгддэггүй.
        </p>
      </Section>

      <Section title="6. Хугацаа ба устгал">
        <p>
          Дансаа устгах бүрэн эрхтэй: <Link href="/profile" className="text-accent hover:underline">профайл</Link>{" "}
          хуудаснаас устгахад таны бүртгэл, хадгалсан зүйлс, сонирхол бүгд шууд, эргэлт буцалтгүй
          устана. Имэйлээр хүсэлт илгээж ч болно.
        </p>
      </Section>

      <Section title="7. Хүүхдийн мэдээлэл">
        <p>13-аас доош насны хүүхдээс зориудаар мэдээлэл цуглуулдаггүй.</p>
      </Section>

      <Section title="8. Өөрчлөлт">
        <p>
          Энэ бодлого өөрчлөгдвөл дээрх «сүүлд шинэчилсэн» огноог шинэчилнэ. Чухал өөрчлөлтийг
          сайт дээр мэдэгдэнэ.
        </p>
      </Section>

      <Section title="9. Холбоо барих">
        <p>
          Асуулт, хүсэлт байвал{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">{CONTACT_EMAIL}</a>{" "}
          руу бичнэ үү.
        </p>
      </Section>
    </div>
  );
}

/**
 * Асуулгын үр дүнгийн og:image — 1200×630.
 *
 *   /api/og/songolt?code=Ab3xY
 *
 * FB-д хуваалцахад «Надад тохирох AI: ChatGPT» гэсэн брэндийн карт харагдана.
 */
import { ImageResponse } from "next/og";
import { resultFor } from "@/songolt/queries";
import { decodeAnswers, TASK_LABEL, WHO_LABEL } from "@/songolt/score.api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCENT = "#4f46e5";
const PAPER = "#f7f6f2";
const INK = "#1b1b23";
const MUTED = "#6b6b76";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  const answers = decodeAnswers(code);
  if (!answers) return new Response("Not found", { status: 404 });

  const result = await resultFor(answers);
  const top = result[0]?.rec.tool;
  if (!top) return new Response("Not found", { status: 404 });

  const others = result.slice(1).map((r) => r.rec.tool.name);
  const context = `${WHO_LABEL[answers.who]} · ${answers.tasks.map((t) => TASK_LABEL[t]).join(", ")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", background: PAPER, padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="16" fill={ACCENT} />
            <rect x="13" y="38" width="9" height="13" rx="2" fill="#fff" fillOpacity="0.55" />
            <rect x="27.5" y="28" width="9" height="23" rx="2" fill="#fff" fillOpacity="0.8" />
            <rect x="42" y="18" width="9" height="33" rx="2" fill="#fff" />
            <path d="M46.5 8 L52.5 15 L40.5 15 Z" fill="#fff" />
          </svg>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            <span style={{ color: INK }}>AI</span>
            <span style={{ color: ACCENT, marginLeft: 12 }}>News</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 30, color: MUTED }}>Надад тохирох AI</div>
          <div
            style={{
              display: "flex", fontSize: top.name.length > 18 ? 76 : 96,
              fontWeight: 700, color: INK, letterSpacing: -2, lineHeight: 1.05,
            }}
          >
            {top.name}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED, marginTop: 6 }}>{context}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 26, color: MUTED }}>
            {others.length > 0 ? `Дараа нь: ${others.join(", ")}` : "ainews.mn/songolt"}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: ACCENT }}>ainews.mn/songolt</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

/** USE_FIXTURES=1 үед DB-гүйгээр UI харахад зориулсан жижиг жагсаалт */
import type { UseCaseCard, UseCaseDetail } from "./index";

export const fixtureUseCases: UseCaseCard[] = [
  {
    slug: "yarilzah", nameMn: "Ярилцах, асуулт асуух", icon: "message-circle",
    descriptionMn: "Асуулт асуух, зөвлөгөө авах, санаа гаргах.",
    topTools: ["ChatGPT", "Claude", "Gemini"],
  },
  {
    slug: "zurag", nameMn: "Зураг үүсгэх", icon: "image",
    descriptionMn: "Үгээр тайлбарлаад зураг, дүрслэл гаргуулах.",
    topTools: ["Midjourney", "ChatGPT Images", "Imagen (Gemini)"],
  },
  {
    slug: "code", nameMn: "Код бичих, программ хийх", icon: "code",
    descriptionMn: "Код бичүүлэх, алдаа заруулах, бүхэл программ хийлгэх.",
    topTools: ["Claude Code", "Cursor", "GitHub Copilot"],
  },
];

export function fixtureUseCase(slug: string): UseCaseDetail | null {
  const card = fixtureUseCases.find((c) => c.slug === slug);
  if (!card) return null;
  return {
    ...card,
    tools: card.topTools.map((name, i) => ({
      rank: i + 1, name, vendor: "—", url: "", descriptionMn: "Жишээ өгөгдөл.",
      noteMn: null, pricing: "FREEMIUM" as const, worksInMongolian: true,
    })),
  };
}

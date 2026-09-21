/**
 * "Ямар ажилд аль AI" ангилал, хэрэгслүүд.
 *
 *   npm run db:seed:usecases
 *
 * Байгаа мөрийг дарж бичихгүй — зөвхөн шинийг нэмнэ. Засварыг /admin/hereglee дээрээс хийнэ.
 */
import "dotenv/config";
import { prisma } from "../db";
import type { ToolPricing } from "../generated/prisma/enums";

interface SeedTool {
  name: string;
  vendor: string;
  url: string;
  descriptionMn: string;
  pricing: ToolPricing;
  /** Монгол хэлээр асууж, монголоор хариу авч чадах эсэх (редакторын үнэлгээ) */
  worksInMongolian?: boolean;
}

interface SeedUseCase {
  nameMn: string;
  descriptionMn: string;
  icon: string;
  /** rank = жагсаалтын дараалал (1 = шилдэг) */
  tools: { slug: string; noteMn?: string }[];
}

export const TOOLS: Record<string, SeedTool> = {
  chatgpt: { name: "ChatGPT", vendor: "OpenAI", url: "https://chatgpt.com", descriptionMn: "Хамгийн олон хүн ашигладаг AI туслах — асуулт хариулт, бичиг баримт, зураг, код бүгд нэг дор.", pricing: "FREEMIUM" },
  claude: { name: "Claude", vendor: "Anthropic", url: "https://claude.ai", descriptionMn: "Урт текст уншиж дүгнэх, найруулга сайтай бичихдээ хүчтэй AI туслах.", pricing: "FREEMIUM" },
  gemini: { name: "Gemini", vendor: "Google", url: "https://gemini.google.com", descriptionMn: "Google-ийн AI туслах — Хайлт, Gmail, Docs-той шууд холбогддог.", pricing: "FREEMIUM" },
  deepseek: { name: "DeepSeek", vendor: "DeepSeek", url: "https://chat.deepseek.com", descriptionMn: "Хятадын нээлттэй загвар — үнэгүй, бодох чадвар сайтай.", pricing: "FREE" },
  grok: { name: "Grok", vendor: "xAI", url: "https://grok.com", descriptionMn: "X (Twitter)-тэй холбогдсон, цаг үеийн мэдээнд хурдан хариулдаг AI.", pricing: "FREEMIUM" },

  "claude-code": { name: "Claude Code", vendor: "Anthropic", url: "https://claude.com/product/claude-code", descriptionMn: "Терминал дээр ажиллаж, төслийн файлуудыг өөрөө уншиж засдаг програмчлалын агент.", pricing: "PAID" },
  cursor: { name: "Cursor", vendor: "Anysphere", url: "https://cursor.com", descriptionMn: "AI суулгасан код бичих орчин — VS Code дээр суурилсан.", pricing: "FREEMIUM" },
  "github-copilot": { name: "GitHub Copilot", vendor: "GitHub", url: "https://github.com/features/copilot", descriptionMn: "Код бичиж байхад дараагийн мөрийг санал болгодог туслах.", pricing: "FREEMIUM" },
  codex: { name: "Codex", vendor: "OpenAI", url: "https://openai.com/codex", descriptionMn: "OpenAI-ийн програмчлалын агент — даалгавар өгөхөд кодыг өөрөө бичиж шалгана.", pricing: "PAID" },
  windsurf: { name: "Windsurf", vendor: "Windsurf", url: "https://windsurf.com", descriptionMn: "Агент горимтой код бичих орчин.", pricing: "FREEMIUM" },

  perplexity: { name: "Perplexity", vendor: "Perplexity", url: "https://www.perplexity.ai", descriptionMn: "Асуултад интернэтээс хайж, эх сурвалжийн холбоостой хариулдаг.", pricing: "FREEMIUM" },
  "chatgpt-search": { name: "ChatGPT Search", vendor: "OpenAI", url: "https://chatgpt.com", descriptionMn: "ChatGPT доторх хайлт — шинэ мэдээллийг эх сурвалжтай нь өгнө.", pricing: "FREEMIUM" },
  "google-ai-mode": { name: "Google AI Mode", vendor: "Google", url: "https://www.google.com/aimode", descriptionMn: "Google Хайлтын AI горим — хариултыг нэгтгэж харуулна.", pricing: "FREE" },
  "gemini-deep-research": { name: "Gemini Deep Research", vendor: "Google", url: "https://gemini.google/overview/deep-research/", descriptionMn: "Хэдэн арван эх сурвалж уншиж, бүтэн тайлан бэлтгэж өгнө.", pricing: "FREEMIUM" },
  notebooklm: { name: "NotebookLM", vendor: "Google", url: "https://notebooklm.google.com", descriptionMn: "Өөрийн PDF, тэмдэглэлээ оруулаад зөвхөн тэндээс нь асууж хариулт авна.", pricing: "FREE" },

  grammarly: { name: "Grammarly", vendor: "Grammarly", url: "https://www.grammarly.com", descriptionMn: "Англи бичвэрийн алдаа, найруулгыг шалгаж засна.", pricing: "FREEMIUM", worksInMongolian: false },
  "notion-ai": { name: "Notion AI", vendor: "Notion", url: "https://www.notion.com/product/ai", descriptionMn: "Notion доторх тэмдэглэл, баримтаа AI-аар бичүүлж, товчлуулна.", pricing: "PAID" },

  deepl: { name: "DeepL", vendor: "DeepL", url: "https://www.deepl.com", descriptionMn: "Европын хэлнүүд дээр чанартай орчуулга өгдөг.", pricing: "FREEMIUM", worksInMongolian: false },
  "google-translate": { name: "Google Translate", vendor: "Google", url: "https://translate.google.com", descriptionMn: "Монгол хэл дэмждэг, хурдан бөгөөд үнэгүй орчуулагч.", pricing: "FREE" },

  midjourney: { name: "Midjourney", vendor: "Midjourney", url: "https://www.midjourney.com", descriptionMn: "Уран сайхны чанар хамгийн өндөр зураг үүсгэгч.", pricing: "PAID", worksInMongolian: false },
  "chatgpt-images": { name: "ChatGPT Images", vendor: "OpenAI", url: "https://chatgpt.com", descriptionMn: "Ярилцаж байгаад шууд зураг гаргуулж, засуулж болно.", pricing: "FREEMIUM" },
  imagen: { name: "Imagen (Gemini)", vendor: "Google", url: "https://gemini.google.com", descriptionMn: "Gemini доторх зураг үүсгэгч.", pricing: "FREEMIUM" },
  ideogram: { name: "Ideogram", vendor: "Ideogram", url: "https://ideogram.ai", descriptionMn: "Зураг дотор бичиг, үсэг зөв гаргадгаараа онцлог.", pricing: "FREEMIUM", worksInMongolian: false },
  flux: { name: "Flux", vendor: "Black Forest Labs", url: "https://blackforestlabs.ai", descriptionMn: "Нээлттэй жинтэй зураг үүсгэгч — компьютер дээрээ ч ажиллуулж болно.", pricing: "FREE", worksInMongolian: false },
  "adobe-firefly": { name: "Adobe Firefly", vendor: "Adobe", url: "https://firefly.adobe.com", descriptionMn: "Adobe-ийн зураг үүсгэгч — арилжааны хэрэглээнд зориулсан.", pricing: "FREEMIUM", worksInMongolian: false },

  veo: { name: "Veo", vendor: "Google", url: "https://deepmind.google/models/veo/", descriptionMn: "Дуу авиатай, бодит байдалд ойр видео гаргадаг.", pricing: "PAID", worksInMongolian: false },
  sora: { name: "Sora", vendor: "OpenAI", url: "https://sora.com", descriptionMn: "Текстээс богино видео үүсгэх OpenAI-ийн үйлчилгээ.", pricing: "PAID", worksInMongolian: false },
  kling: { name: "Kling", vendor: "Kuaishou", url: "https://www.klingai.com", descriptionMn: "Зургаа хөдөлгөөнт видео болгоход тохиромжтой.", pricing: "FREEMIUM", worksInMongolian: false },
  runway: { name: "Runway", vendor: "Runway", url: "https://runwayml.com", descriptionMn: "Видео засварлах, эффект нэмэх мэргэжлийн хэрэгслүүдтэй.", pricing: "FREEMIUM", worksInMongolian: false },
  pika: { name: "Pika", vendor: "Pika", url: "https://pika.art", descriptionMn: "Хялбар, хөгжилтэй богино видео үүсгэгч.", pricing: "FREEMIUM", worksInMongolian: false },

  elevenlabs: { name: "ElevenLabs", vendor: "ElevenLabs", url: "https://elevenlabs.io", descriptionMn: "Хүний дуу хоолойтой адил уншуулах чанараараа тэргүүлдэг.", pricing: "FREEMIUM", worksInMongolian: false },
  "openai-tts": { name: "OpenAI Voice / TTS", vendor: "OpenAI", url: "https://platform.openai.com/docs/guides/text-to-speech", descriptionMn: "Текстийг хоолойгоор уншуулах, ярианы горимоор ярилцах.", pricing: "PAID" },
  "google-cloud-tts": { name: "Google Cloud TTS", vendor: "Google", url: "https://cloud.google.com/text-to-speech", descriptionMn: "Олон хэлний хоолой бүхий, програмд холбоход зориулсан үйлчилгээ.", pricing: "PAID", worksInMongolian: false },
  whisper: { name: "Whisper", vendor: "OpenAI", url: "https://github.com/openai/whisper", descriptionMn: "Дуу бичлэгийг текст болгодог нээлттэй загвар — компьютер дээрээ үнэгүй ажиллуулна.", pricing: "FREE" },
  otter: { name: "Otter.ai", vendor: "Otter.ai", url: "https://otter.ai", descriptionMn: "Уулзалтыг сонсож текст, тэмдэглэл болгож өгдөг.", pricing: "FREEMIUM", worksInMongolian: false },

  suno: { name: "Suno", vendor: "Suno", url: "https://suno.com", descriptionMn: "Үг, хэв маягийг нь хэлэхэд бүтэн дуу зохиож дуулна.", pricing: "FREEMIUM", worksInMongolian: false },
  udio: { name: "Udio", vendor: "Udio", url: "https://www.udio.com", descriptionMn: "Хөгжмийн чанар сайтай дуу үүсгэгч.", pricing: "FREEMIUM", worksInMongolian: false },

  gamma: { name: "Gamma", vendor: "Gamma", url: "https://gamma.app", descriptionMn: "Сэдвээ бичихэд бүтэн илтгэл, слайдыг дизайнтай нь гаргана.", pricing: "FREEMIUM" },
  "canva-ai": { name: "Canva AI", vendor: "Canva", url: "https://www.canva.com/ai", descriptionMn: "Постер, нийгмийн сүлжээний зураг, илтгэлийг хялбар дизайнтай хийнэ.", pricing: "FREEMIUM" },
  "microsoft-copilot": { name: "Microsoft Copilot", vendor: "Microsoft", url: "https://copilot.microsoft.com", descriptionMn: "Word, Excel, PowerPoint дотор шууд ажилладаг туслах.", pricing: "PAID" },
  "figma-ai": { name: "Figma AI", vendor: "Figma", url: "https://www.figma.com/ai", descriptionMn: "Дизайны файл дотор загвар гаргах, засах AI хэрэгслүүд.", pricing: "PAID", worksInMongolian: false },

  khanmigo: { name: "Khanmigo", vendor: "Khan Academy", url: "https://www.khanmigo.ai", descriptionMn: "Хичээлийн хөтөлбөрт тулгуурласан хиймэл багш (англиар).", pricing: "PAID", worksInMongolian: false },
  duolingo: { name: "Duolingo", vendor: "Duolingo", url: "https://www.duolingo.com", descriptionMn: "Гадаад хэл сурах тоглоом маягийн апп, AI ярианы дасгалтай.", pricing: "FREEMIUM", worksInMongolian: false },

  "chatgpt-agent": { name: "ChatGPT Agent", vendor: "OpenAI", url: "https://openai.com/index/introducing-chatgpt-agent/", descriptionMn: "Хөтчөөр орж, хайж, файл бэлтгэж — даалгаврыг эхнээс нь дуустал гүйцэтгэнэ.", pricing: "PAID" },
  manus: { name: "Manus", vendor: "Manus", url: "https://manus.im", descriptionMn: "Олон алхамт ажлыг бие даан гүйцэтгэдэг ерөнхий агент.", pricing: "FREEMIUM" },
  n8n: { name: "n8n", vendor: "n8n", url: "https://n8n.io", descriptionMn: "Програмуудаа холбож, давтагддаг ажлыг автоматжуулна — AI алхам нэмж болно.", pricing: "FREEMIUM" },

  ollama: { name: "Ollama", vendor: "Ollama", url: "https://ollama.com", descriptionMn: "Нээлттэй загваруудыг компьютер дээрээ нэг командаар суулгаж ажиллуулна.", pricing: "FREE" },
  "lm-studio": { name: "LM Studio", vendor: "LM Studio", url: "https://lmstudio.ai", descriptionMn: "Товчлуур дарж загвар татаад ашигладаг, команд бичих шаардлагагүй.", pricing: "FREE" },
  "open-webui": { name: "Open WebUI", vendor: "Open WebUI", url: "https://openwebui.com", descriptionMn: "Өөрийн компьютер дээрх загварт ChatGPT маягийн харагдац өгнө.", pricing: "FREE" },
};

export const USE_CASES: Record<string, SeedUseCase> = {
  yarilzah: {
    nameMn: "Ярилцах, асуулт асуух",
    descriptionMn: "Асуулт асуух, зөвлөгөө авах, санаа гаргах. AI-тай танилцаж эхлэх хамгийн энгийн газар.",
    icon: "message-circle",
    tools: [
      { slug: "chatgpt" }, { slug: "claude" }, { slug: "gemini" },
      { slug: "deepseek" },
      { slug: "grok" },
    ],
  },
  code: {
    nameMn: "Код бичих, программ хийх",
    descriptionMn: "Код бичүүлэх, алдаа заруулах, бүхэл программ хийлгэх. Анхан шатны хүн ч ашиглаж болно.",
    icon: "code",
    tools: [
      { slug: "claude-code", noteMn: "Терминал ашиглана — эхлэгчид арай хүнд." },
      { slug: "cursor" }, { slug: "github-copilot" }, { slug: "codex" }, { slug: "windsurf" },
    ],
  },
  haih: {
    nameMn: "Мэдээлэл хайх, судлах",
    descriptionMn: "Интернэт эсвэл өөрийн файлаас мэдээлэл хайж, эх сурвалжтай нь хариулт авах.",
    icon: "search",
    tools: [
      { slug: "perplexity" },
      { slug: "chatgpt-search" }, { slug: "google-ai-mode" },
      { slug: "gemini-deep-research", noteMn: "Хариулт 5–15 минут хүлээнэ." },
      { slug: "notebooklm", noteMn: "Өөрийн файлаас л хариулах учир зохиомол мэдээлэл өгөх эрсдэл бага." },
    ],
  },
  bichih: {
    nameMn: "Бичих, засварлах",
    descriptionMn: "Захидал, нийтлэл, тайлан бичих, найруулга засах, урт текстийг товчлох.",
    icon: "pen-line",
    tools: [
      { slug: "claude" },
      { slug: "chatgpt" }, { slug: "gemini" },
      { slug: "grammarly" },
      { slug: "notion-ai" },
    ],
  },
  orchuulga: {
    nameMn: "Орчуулга",
    descriptionMn: "Текстийг нэг хэлнээс нөгөө рүү хөрвүүлэх. Монгол хэлний чанар хэрэгслээс хамаарч ихээхэн ялгаатай.",
    icon: "languages",
    tools: [
      { slug: "deepl", noteMn: "Европын хэлнүүд дээр шилдэг, монгол хэл дэмждэггүй." },
      { slug: "google-translate", noteMn: "Богино өгүүлбэрт хурдан, урт албан бичигт утга гажина." },
      { slug: "chatgpt", noteMn: "Монгол орчуулгын чанар машин орчуулгаас дээр, өгүүлбэрийн утгыг хадгална." },
      { slug: "claude", noteMn: "Урт, албан ёсны бичвэрийг монголоор найруулахад сайн." },
    ],
  },
  zurag: {
    nameMn: "Зураг үүсгэх",
    descriptionMn: "Үгээр тайлбарлаад зураг, дүрслэл гаргуулах. Ихэнх нь англиар бичихэд илүү сайн ойлгоно.",
    icon: "image",
    tools: [
      { slug: "midjourney", noteMn: "Үнэгүй хувилбаргүй — сард төлбөр төлнө." },
      { slug: "chatgpt-images", noteMn: "Эхлэхэд хамгийн хялбар — тусдаа бүртгэл хэрэггүй." },
      { slug: "imagen" },
      { slug: "ideogram", noteMn: "Кирилл үсэг гажих магадлалтай — латинаар туршиж үзээрэй." },
      { slug: "flux", noteMn: "Компьютер дээрээ ажиллуулахад хүчтэй видео карт шаардана." },
      { slug: "adobe-firefly", noteMn: "Photoshop дотроос шууд ашиглаж болно." },
    ],
  },
  video: {
    nameMn: "Видео үүсгэх",
    descriptionMn: "Текст эсвэл зургаас богино видео гаргах. Бүгд төлбөртэй буюу хязгаартай.",
    icon: "video",
    tools: [
      { slug: "veo" },
      { slug: "sora" }, { slug: "kling" },
      { slug: "runway" }, { slug: "pika" },
    ],
  },
  "duu-hooloi": {
    nameMn: "Дуу хоолой: унших, бичлэг текст болгох",
    descriptionMn: "Текстийг хүний хоолойгоор уншуулах (TTS), эсвэл дуу бичлэгийг текст болгох.",
    icon: "mic",
    tools: [
      { slug: "elevenlabs", noteMn: "Монгол хэлийг албан ёсоор дэмждэггүй." },
      { slug: "openai-tts" }, { slug: "google-cloud-tts" },
      { slug: "whisper", noteMn: "Монгол хэлийг таних чанар дунд зэрэг." },
      { slug: "otter" },
    ],
  },
  hugjim: {
    nameMn: "Хөгжим үүсгэх",
    descriptionMn: "Үг, хэв маягийг нь хэлээд бүтэн дуу гаргуулах.",
    icon: "music",
    tools: [{ slug: "suno" }, { slug: "udio" }],
  },
  presentation: {
    nameMn: "Илтгэл, дизайн",
    descriptionMn: "Слайд, постер, нийгмийн сүлжээний зураг хурдан бэлтгэх.",
    icon: "presentation",
    tools: [
      { slug: "gamma", noteMn: "Гаргасан слайдаа PowerPoint болгож татаж авна." },
      { slug: "canva-ai" }, { slug: "microsoft-copilot" }, { slug: "figma-ai" },
    ],
  },
  surah: {
    nameMn: "Сурах, багш болгох",
    descriptionMn: "Ойлгомжгүй сэдвийг тайлбарлуулах, дасгал бодуулах, хэл сурах.",
    icon: "graduation-cap",
    tools: [
      { slug: "chatgpt", noteMn: "«Надад 10 настай хүүхдэд тайлбарлах шиг тайлбарла» гэж асуугаарай." },
      { slug: "claude" },
      { slug: "khanmigo" },
      { slug: "notebooklm", noteMn: "Хичээлийн материалаа оруулаад давтлага хийх боломжтой." },
      { slug: "duolingo" },
    ],
  },
  agent: {
    nameMn: "Ажлыг бүхэлд нь даалгах (агент)",
    descriptionMn: "Зөвхөн хариулт биш — олон алхамт ажлыг өөрөө төлөвлөж гүйцэтгүүлэх.",
    icon: "bot",
    tools: [
      { slug: "claude", noteMn: "Агент горимд файл, хэрэгслүүдтэй өөрөө ажиллана." },
      { slug: "chatgpt-agent" }, { slug: "manus" },
      { slug: "n8n" },
    ],
  },
  local: {
    nameMn: "Компьютер дээрээ үнэгүй ажиллуулах",
    descriptionMn: "Интернэтгүйгээр, өгөгдлөө гадагш гаргалгүйгээр өөрийн компьютер дээр AI ажиллуулах.",
    icon: "laptop",
    tools: [
      { slug: "ollama", noteMn: "Интернэтгүй, нууцлалтай — өгөгдөл компьютероос гарахгүй." },
      { slug: "lm-studio" },
      { slug: "open-webui" },
    ],
  },
};

async function main() {
  let newTools = 0;
  const toolIds = new Map<string, string>();
  for (const [slug, t] of Object.entries(TOOLS)) {
    const existing = await prisma.aiTool.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      toolIds.set(slug, existing.id);
      continue;
    }
    const created = await prisma.aiTool.create({
      data: {
        slug, name: t.name, vendor: t.vendor, url: t.url, descriptionMn: t.descriptionMn,
        pricing: t.pricing, worksInMongolian: t.worksInMongolian ?? true,
      },
      select: { id: true },
    });
    toolIds.set(slug, created.id);
    newTools++;
  }

  let newCases = 0;
  let newLinks = 0;
  let order = 0;
  for (const [slug, u] of Object.entries(USE_CASES)) {
    order++;
    let uc = await prisma.useCase.findUnique({ where: { slug }, select: { id: true } });
    if (!uc) {
      uc = await prisma.useCase.create({
        data: { slug, nameMn: u.nameMn, descriptionMn: u.descriptionMn, icon: u.icon, order },
        select: { id: true },
      });
      newCases++;
    }
    for (const [i, link] of u.tools.entries()) {
      const toolId = toolIds.get(link.slug);
      if (!toolId) { console.warn(`⚠ ${slug}: "${link.slug}" хэрэгсэл олдсонгүй`); continue; }
      const has = await prisma.useCaseTool.findUnique({
        where: { useCaseId_toolId: { useCaseId: uc.id, toolId } },
        select: { toolId: true },
      });
      if (has) continue;
      await prisma.useCaseTool.create({
        data: { useCaseId: uc.id, toolId, rank: i + 1, noteMn: link.noteMn ?? null },
      });
      newLinks++;
    }
  }

  console.log(
    `Ангилал ${Object.keys(USE_CASES).length} (шинэ ${newCases}), ` +
      `хэрэгсэл ${Object.keys(TOOLS).length} (шинэ ${newTools}), холбоос шинэ ${newLinks}.`,
  );
  await prisma.$disconnect();
}

if (process.argv[1]?.endsWith("usecases.seed.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

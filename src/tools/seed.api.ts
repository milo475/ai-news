/**
 * Каталогийн 80 суурь хэрэгсэл — ангилал бүрт 5–8.
 *
 * Зөвхөн нэр, вэбсайт, ангилал, хувилбарууд өгнө. Tagline, тайлбар, үнэ, монгол хэлний
 * дэмжлэгийг LLM бөглөнө; логыг favicon-оос татна.
 */
import type { ToolCategory } from "../generated/prisma/enums";

export interface SeedTool {
  name: string;
  website: string;
  categories: ToolCategory[];
  /** Хувилбар болох хэрэгслүүдийн нэр (slug-аар холбогдоно) */
  alternatives?: string[];
}

export const SEED_TOOLS: SeedTool[] = [
  // ——— CHAT (7) ———
  { name: "ChatGPT", website: "https://chatgpt.com", categories: ["CHAT", "BICHIH"], alternatives: ["Claude", "Gemini"] },
  { name: "Claude", website: "https://claude.ai", categories: ["CHAT", "BICHIH", "CODE"], alternatives: ["ChatGPT", "Gemini"] },
  { name: "Gemini", website: "https://gemini.google.com", categories: ["CHAT", "HAILT"], alternatives: ["ChatGPT", "Claude"] },
  { name: "Microsoft Copilot", website: "https://copilot.microsoft.com", categories: ["CHAT", "OFFICE"], alternatives: ["ChatGPT", "Gemini"] },
  { name: "DeepSeek", website: "https://chat.deepseek.com", categories: ["CHAT", "CODE"], alternatives: ["ChatGPT", "Qwen Chat"] },
  { name: "Qwen Chat", website: "https://chat.qwen.ai", categories: ["CHAT"], alternatives: ["DeepSeek", "ChatGPT"] },

  // ——— BICHIH (6) ———
  { name: "Grammarly", website: "https://www.grammarly.com", categories: ["BICHIH"], alternatives: ["QuillBot"] },
  { name: "QuillBot", website: "https://quillbot.com", categories: ["BICHIH", "ORCHUULGA"], alternatives: ["Grammarly"] },
  { name: "Notion AI", website: "https://www.notion.com/product/ai", categories: ["BICHIH", "OFFICE"], alternatives: ["Coda AI"] },
  { name: "Jasper", website: "https://www.jasper.ai", categories: ["BICHIH", "MARKETING"], alternatives: ["Copy.ai"] },
  { name: "Copy.ai", website: "https://www.copy.ai", categories: ["BICHIH", "MARKETING"], alternatives: ["Jasper"] },
  { name: "Sudowrite", website: "https://www.sudowrite.com", categories: ["BICHIH"] },

  // ——— ZURAG (7) ———
  { name: "Midjourney", website: "https://www.midjourney.com", categories: ["ZURAG"], alternatives: ["Ideogram", "Leonardo AI"] },
  { name: "Canva", website: "https://www.canva.com", categories: ["ZURAG", "MARKETING", "OFFICE"], alternatives: ["Adobe Firefly", "Gamma"] },
  { name: "Adobe Firefly", website: "https://www.adobe.com/products/firefly.html", categories: ["ZURAG"], alternatives: ["Midjourney"] },
  { name: "Leonardo AI", website: "https://leonardo.ai", categories: ["ZURAG"], alternatives: ["Midjourney"] },
  { name: "Ideogram", website: "https://ideogram.ai", categories: ["ZURAG"], alternatives: ["Midjourney"] },
  { name: "Remove.bg", website: "https://www.remove.bg", categories: ["ZURAG"], alternatives: ["Canva"] },

  // ——— VIDEO (6) ———
  { name: "CapCut", website: "https://www.capcut.com", categories: ["VIDEO"], alternatives: ["Descript"] },
  { name: "Runway", website: "https://runwayml.com", categories: ["VIDEO", "ZURAG"], alternatives: ["Pika", "Descript"] },
  { name: "HeyGen", website: "https://www.heygen.com", categories: ["VIDEO"], alternatives: ["Synthesia"] },
  { name: "Synthesia", website: "https://www.synthesia.io", categories: ["VIDEO"], alternatives: ["HeyGen"] },
  { name: "Descript", website: "https://www.descript.com", categories: ["VIDEO", "AUDIO"], alternatives: ["CapCut"] },
  { name: "Pika", website: "https://pika.art", categories: ["VIDEO"], alternatives: ["Runway"] },

  // ——— AUDIO (6) ———
  { name: "ElevenLabs", website: "https://elevenlabs.io", categories: ["AUDIO"], alternatives: ["Descript"] },
  { name: "Suno", website: "https://suno.com", categories: ["AUDIO"], alternatives: ["Udio"] },
  { name: "Udio", website: "https://www.udio.com", categories: ["AUDIO"], alternatives: ["Suno"] },
  { name: "Otter.ai", website: "https://otter.ai", categories: ["AUDIO", "OFFICE"], alternatives: ["Fireflies.ai"] },
  { name: "Fireflies.ai", website: "https://fireflies.ai", categories: ["AUDIO", "BIZNES"], alternatives: ["Otter.ai"] },
  { name: "Whisper", website: "https://openai.com/index/whisper", categories: ["AUDIO"], alternatives: ["Otter.ai"] },

  // ——— CODE (7) ———
  { name: "Cursor", website: "https://cursor.com", categories: ["CODE"], alternatives: ["GitHub Copilot", "Windsurf"] },
  { name: "GitHub Copilot", website: "https://github.com/features/copilot", categories: ["CODE"], alternatives: ["Cursor"] },
  { name: "Claude Code", website: "https://claude.com/product/claude-code", categories: ["CODE", "AGENT"], alternatives: ["Cursor"] },
  { name: "Windsurf", website: "https://windsurf.com", categories: ["CODE"], alternatives: ["Cursor"] },
  { name: "v0", website: "https://v0.app", categories: ["CODE"], alternatives: ["Lovable"] },
  { name: "Lovable", website: "https://lovable.dev", categories: ["CODE"], alternatives: ["v0", "Cursor"] },

  // ——— OFFICE (6) ———
  { name: "Gamma", website: "https://gamma.app", categories: ["OFFICE", "MARKETING"], alternatives: ["Tome", "Canva"] },
  { name: "Tome", website: "https://tome.app", categories: ["OFFICE"], alternatives: ["Gamma"] },
  { name: "Microsoft 365 Copilot", website: "https://www.microsoft.com/microsoft-365/copilot", categories: ["OFFICE", "BIZNES"], alternatives: ["Gemini"] },
  { name: "Rows", website: "https://rows.com", categories: ["OFFICE"], alternatives: ["Microsoft 365 Copilot"] },
  { name: "Mem", website: "https://get.mem.ai", categories: ["OFFICE"], alternatives: ["Notion AI"] },
  { name: "Coda AI", website: "https://coda.io", categories: ["OFFICE"], alternatives: ["Notion AI"] },

  // ——— SURGALT (6) ———
  { name: "Khanmigo", website: "https://www.khanmigo.ai", categories: ["SURGALT"], alternatives: ["Duolingo"] },
  { name: "Duolingo", website: "https://www.duolingo.com", categories: ["SURGALT"], alternatives: ["Khanmigo"] },
  { name: "Quizlet", website: "https://quizlet.com", categories: ["SURGALT"], alternatives: ["Anki"] },
  { name: "Anki", website: "https://apps.ankiweb.net", categories: ["SURGALT"], alternatives: ["Quizlet"] },
  { name: "NotebookLM", website: "https://notebooklm.google.com", categories: ["SURGALT", "HAILT"], alternatives: ["Elicit"] },
  { name: "Quizizz", website: "https://quizizz.com", categories: ["SURGALT"], alternatives: ["Quizlet"] },

  // ——— MARKETING (6) ———
  { name: "Buffer", website: "https://buffer.com", categories: ["MARKETING"], alternatives: ["Later"] },
  { name: "Later", website: "https://later.com", categories: ["MARKETING"], alternatives: ["Buffer"] },
  { name: "Predis.ai", website: "https://predis.ai", categories: ["MARKETING", "ZURAG"], alternatives: ["Canva"] },
  { name: "AdCreative.ai", website: "https://www.adcreative.ai", categories: ["MARKETING"], alternatives: ["Predis.ai"] },
  { name: "Opus Clip", website: "https://www.opus.pro", categories: ["MARKETING", "VIDEO"], alternatives: ["CapCut"] },
  { name: "Mailchimp", website: "https://mailchimp.com", categories: ["MARKETING", "BIZNES"] },

  // ——— BIZNES (6) ———
  { name: "Zapier", website: "https://zapier.com", categories: ["BIZNES", "AGENT"], alternatives: ["Make"] },
  { name: "Make", website: "https://www.make.com", categories: ["BIZNES", "AGENT"], alternatives: ["Zapier", "n8n"] },
  { name: "n8n", website: "https://n8n.io", categories: ["BIZNES", "AGENT"], alternatives: ["Make"] },
  { name: "HubSpot", website: "https://www.hubspot.com", categories: ["BIZNES", "MARKETING"] },
  { name: "Intercom Fin", website: "https://www.intercom.com/fin", categories: ["BIZNES"], alternatives: ["Tidio"] },
  { name: "Tidio", website: "https://www.tidio.com", categories: ["BIZNES"], alternatives: ["Intercom Fin"] },

  // ——— ORCHUULGA (5) ———
  { name: "DeepL", website: "https://www.deepl.com", categories: ["ORCHUULGA"], alternatives: ["Google Translate"] },
  { name: "Google Translate", website: "https://translate.google.com", categories: ["ORCHUULGA"], alternatives: ["DeepL"] },
  { name: "Wordvice AI", website: "https://wordvice.ai", categories: ["ORCHUULGA", "BICHIH"], alternatives: ["Grammarly"] },
  { name: "Reverso", website: "https://www.reverso.net", categories: ["ORCHUULGA"], alternatives: ["DeepL"] },
  { name: "Papago", website: "https://papago.naver.com", categories: ["ORCHUULGA"], alternatives: ["Google Translate"] },

  // ——— HAILT (5) ———
  { name: "Perplexity", website: "https://www.perplexity.ai", categories: ["HAILT", "CHAT"], alternatives: ["ChatGPT", "Gemini"] },
  { name: "Elicit", website: "https://elicit.com", categories: ["HAILT", "SURGALT"], alternatives: ["Consensus"] },
  { name: "Consensus", website: "https://consensus.app", categories: ["HAILT"], alternatives: ["Elicit"] },
  { name: "Exa", website: "https://exa.ai", categories: ["HAILT"], alternatives: ["Perplexity"] },
  { name: "Semantic Scholar", website: "https://www.semanticscholar.org", categories: ["HAILT", "SURGALT"], alternatives: ["Elicit"] },

  // ——— AGENT (5) ———
  { name: "Manus", website: "https://manus.im", categories: ["AGENT"], alternatives: ["Devin"] },
  { name: "Devin", website: "https://devin.ai", categories: ["AGENT", "CODE"], alternatives: ["Claude Code"] },
  { name: "OpenAI Operator", website: "https://openai.com/index/introducing-operator", categories: ["AGENT"], alternatives: ["Manus"] },
  { name: "Browser Use", website: "https://browser-use.com", categories: ["AGENT"], alternatives: ["Manus"] },
  { name: "Relevance AI", website: "https://relevanceai.com", categories: ["AGENT", "BIZNES"], alternatives: ["Zapier"] },

  // ——— BUSAD (4) ———
  { name: "Ollama", website: "https://ollama.com", categories: ["BUSAD", "CODE"], alternatives: ["LM Studio"] },
  { name: "LM Studio", website: "https://lmstudio.ai", categories: ["BUSAD"], alternatives: ["Ollama"] },
  { name: "Hugging Face", website: "https://huggingface.co", categories: ["BUSAD", "CODE"] },
  { name: "OpenRouter", website: "https://openrouter.ai", categories: ["BUSAD", "CODE"] },
  { name: "Google AI Studio", website: "https://aistudio.google.com", categories: ["BUSAD", "CODE"], alternatives: ["OpenRouter"] },
];

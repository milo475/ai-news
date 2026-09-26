# AI News — жагсаалт + мэдээний agent

## Суулгах
```bash
npm install
cp .env.example .env      # DATABASE_URL, OPENROUTER_API_KEY бөглөнө
npx prisma migrate dev --name init
npx prisma generate
npx playwright install chromium   # JS-ээр зурагддаг сайтын бүтэн текстэд
```

## Ажиллуулах
```bash
npx tsx src/fetchers/openrouter.ts --days 60   # анх удаа: 60 хоногийн түүх
npx tsx src/fetchers/openrouter.ts             # өдөр бүр (cron): сүүлийн 7 хоног
npm run fetch:arena                            # LMArena Elo (долоо хоног тутам шинэчлэгддэг)
npx tsx --test src/fetchers/openrouter.test.ts # логикийн тест
LIVE=1 npx tsx --test src/fetchers/openrouter.test.ts  # + бодит каталог
```

## Бүтэц
- `prisma/schema.prisma` — Company, AiModel, RankingSnapshot, Source, Article, JobRun, UseCase, AiTool
- `src/fetchers/openrouter.api.ts` — API дуудлага + цэвэр хувиргалт (DB-гүй, тесттэй)
- `src/fetchers/arena.api.ts` — LMArena Elo татах + нэр тааруулах (DB-гүй, тесттэй)
- `src/fetchers/arena.ts` — Arena Elo-г RankingSnapshot-д бичих
- `src/data/model-aliases.ts` — Arena↔OpenRouter нэрийн гар тохируулга
- `src/fetchers/openrouter.ts` — каталог + өдөр тутмын жагсаалтыг DB-д бичих
- `src/queries/leaderboard.ts` — нүүр хуудас/моделийн хуудасны query
- `src/fetchers/sources.seed.ts` — мэдээний RSS эх сурвалжуудын жагсаалт
- `src/fetchers/rss.api.ts` — feed татах + цэвэрлэх цэвэр функцууд (DB-гүй, тесттэй)
- `src/fetchers/rss.ts` — RSS-ээс RAW нийтлэл цуглуулж DB-д бичих
- `src/fetchers/fulltext.api.ts` — эх хуудаснаас бүтэн текст (Readability + linkedom, JS-сайтад Playwright)
- `src/fetchers/fulltext.backfill.ts` — sourceText хоосон нийтлэлүүдэд текст нөхөх
- `src/agent/llm.ts` — OpenRouter chat completions, JSON schema-тай хариу (DB-гүй)
- `src/agent/glossary.md` — нэр томьёоны толь + хэв маягийн дүрэм (prompt-д шууд ордог)
- `src/agent/slug.ts` — монгол гарчиг → URL slug (кирилл→латин, тесттэй)
- `src/agent/process.ts` — RAW → үнэлгээ → монголоор бичих → DRAFT (`processOne` нь нэг нийтлэлд)
- `src/agent/digest.ts` — долоо хоногийн тойм (`digest.api.ts` нь цэвэр хэсэг, тесттэй)
- `src/app/api/og/[slug]/` — нийтлэлийн og:image (1200×630, next/og)
- `src/lib/search.ts` — сайтын хайлт (`search-query.ts` нь цэвэр хэсэг, тесттэй)
- `src/newsletter/` — имэйл бүртгэл ба долоо хоногийн захиа (Resend)
- `src/middleware.ts` — `/admin` замын HTTP Basic auth
- `src/app/admin/` — редакторын самбар, нийтлэл засах, server action-ууд
- `src/app/medee/` — нийтийн мэдээний жагсаалт ба нийтлэлийн хуудас
- `src/app/hereglee/` — «Ямар ажилд аль AI» ангилал, хэрэгслүүд
- `src/seed/usecases.seed.ts` — ангилал, хэрэгслийн эхний өгөгдөл
- `src/components/Logo.tsx` — тэмдэг (`LogoMark`) ба нэртэй лого (`Logo`), inline SVG
- `scripts/brand.ts` — favicon/OG зургийг үүсгэх скрипт (нэг удаа ажиллуулж, үр дүнг commit хийнэ)
- `src/publish/facebook.ts` — нийтлэгдсэн мэдээг Facebook хуудсанд постлох
- `src/pipeline.ts` — бүх шатыг дараалуулан ажиллуулах (cron)
- `src/jobs/runner.ts` — /admin-аас ажлыг ард нь (detached процесс) эхлүүлэх
- `src/env.ts` — шаардлагатай env хувьсагчдын шалгалт
- `src/app/api/health/route.ts` — DB холболт + сүүлийн ажиллалтуудын төлөв
- `Dockerfile` — Playwright суурьтай, web ба cron хоёуланд нь

## Ишлэл (заавал)
OpenRouter-ийн өгөгдөл CC BY 4.0. Сайт дээр:
"Source: OpenRouter (openrouter.ai/rankings), as of {as_of}."

## Вэб сайт (Next.js 15 + Tailwind 4)
```bash
npm run dev                  # http://localhost:3000 — Postgres хэрэгтэй
USE_FIXTURES=1 npm run dev   # DB-гүй, зохиомол өгөгдлөөр UI харах
npm run build && npm start
```
Хуудсууд: `/` нүүр (топ 10, өсөлт/уналт), `/jagsaalt` (топ 50, шүүлтүүр), `/model/<slug>` (30 хоногийн график, үнэ),
`/hereglee` (ямар ажилд аль AI), `/medee`, `/nevtreh`, `/burtguuleh`, `/profile`.

Хуудсууд өгөгдлийг зөвхөн `src/data/index.ts`-ээс авна — DB эсвэл fixture-ийг тэнд сольдог.
Нүүр хуудас request тутам шинэчлэгдэнэ (`force-dynamic`) — build үед DB байдаггүй, мөн deploy хийсэн
даруйд хуучин өгөгдөл харагдахгүйн тулд. Бусад хуудас: `/medee` 10 мин, `/medee/<slug>` болон
`/model/...` 1 цагийн ISR.

## Мэдээний agent — 1-р шат (RSS цуглуулагч)
LLM дуудахгүй: эх сурвалжаас татаж `Article.status = RAW` нийтлэл болгон хадгална.
Монгол гарчиг/хураангуй (`titleMn`, `summaryMn`, `bodyMn`) 2-р шатанд бөглөгдөнө.

```bash
npm run seed:sources      # эх сурвалжуудыг Source хүснэгтэд upsert (idempotent)
npm run fetch:rss         # feed бүрийг дараалан татаж RAW нийтлэл хадгална
npm test                  # src/fetchers/*.test.ts — сүлжээгүй логикийн тест
```

Шинэ нийтлэл бүрт эх хуудсыг нь нээж Readability-ээр бүтэн текст татаж `sourceText`-д бичнэ.
`Source.needsBrowser = true` бол хуудсыг Playwright (chromium)-аар нээж, биет текст зурагдтал хүлээнэ
(OpenAI Blog ийм). Хуудас нээгдэхгүй бол feed-ийн `content:encoded` (эсвэл `content`) нөөцөд орно;
тэр ч байхгүй бол `sourceExcerpt`-ээр л ажиллана. Browser нэг ажиллуулалтад нэг л удаа нээгдэнэ. Хүсэлт хоорондоо 500мс завсартай. Хуучин нийтлэлүүдэд нөхөж татах:
`npx tsx src/fetchers/fulltext.backfill.ts` (Source бүрийн feed-ийг нэг удаа татаж хаягаар тааруулна).

Шүүлтүүр: сүүлийн 7 хоногийн нийтлэл; `sourceUrl` (normalize хийсэн — utm_*/fbclid/ref хассан)
давхардвал алгасна; сүүлийн 3 хоногт ижил `sourceHash` (гарчгийн normalized sha1) байвал алгасна.
Тиймээс хоёр дахь удаа ажиллуулахад "шинэ 0" гарна. Cron: 1–2 цаг тутам.

Эх сурвалж тус бүрийн үр дүн `JobRun` (job: `"rss"`) болон `Source.lastFetchedAt` / `Source.lastError`-т үлдэнэ.

Нийтлэл бүрийн `og:image`-ийг (олдвол feed-ийн `enclosure`/`media:content`) `sourceImageUrl`-д
хадгална — `FB_USE_SOURCE_IMAGE=true` үед FB постын зураг болгож хэрэглэнэ.

### Эх сурвалжууд (20, идэвхтэй 17)
`SOURCES` жагсаалт `src/fetchers/sources.seed.ts` дотор. Бүр дээр `weight` (найдвартай байдал) ба
`defaultCategory` (LLM өөрөөр шийдвэл түүнийг нь авна) байна.

Seed нь **idempotent**: `url`-аар upsert хийж, байгаа мөр дээр зөвхөн `name`, `feedUrl`,
`defaultCategory`, `needsBrowser`-ийг шинэчилнэ. Гараар тохируулсан `isActive`, `weight`-ийг
**хэзээ ч дарж бичихгүй** — /admin-аас унтраасан feed автоматаар асахгүй.

`start:cron` дээр `prisma migrate deploy`-ийн дараа seed автоматаар ажиллана
(`prisma migrate deploy && npm run seed:sources && tsx src/pipeline.ts`), тиймээс шинэ эх сурвалж
нэмэхэд **deploy хийхэд л хангалттай** — гараар seed хийх шаардлагагүй.

| Бүлэг | Эх сурвалж |
|---|---|
| Компанийн албан ёсны | OpenAI Blog, Google DeepMind, Hugging Face (PROJECT), Anthropic News* |
| Хэвлэл | TechCrunch AI, The Verge AI, Ars Technica AI, MIT Tech Review AI, Wired AI, The Guardian AI, VentureBeat AI, Reuters Technology* |
| Бизнес/төсөл/хэрэглээ | Fast Company AI (BUSINESS), Product Hunt AI (PROJECT), TLDR AI (HOWTO), Simon Willison (HOWTO), Hacker News AI* (PROJECT) |
| Баримт/эрсдэл | Futurism (FACT), Rest of World (FACT), AI Incident Database (RISK) |

Feed-ийн төлөв (2026-09-23-нд шалгасан):
- **Anthropic News** — нийтийн RSS/Atom олдсонгүй (`rss.xml`, `feed.xml`, `news/rss.xml` бүгд 404, HTML дотор
  `<link rel="alternate">` байхгүй). `isActive: false` — feed гармагц seed дээр асаана.
- **Reuters Technology** — RSS хаагдсан (`reuters.com/technology/rss` → 401, `reutersagency.com` → 404).
  `isActive: false`.
- **Hacker News AI** — `hnrss.org` бүх хүсэлтэд 502 (үйлчилгээ унасан). `isActive: false`, сэргэвэл асаана.
- **Ben's Bites**, **The Neuron** — RSS байхгүй (feed зам нь HTML/404 буцаана), тиймээс нэмээгүй.
- **Futurism** — `/artificial-intelligence/feed` нь JPEG рүү redirect хийдэг тул ерөнхий `/feed`-ийг авсан.
- **VentureBeat AI** — feed хаяг зөв боловч bot хамгаалалт HTTP 429 буцаадаг. Идэвхтэй үлдээсэн,
  алдаа нь `Source.lastError`-т бичигдэж бусад эх сурвалжийг зогсоохгүй.
- Бусад feed бүгд ажиллаж байна.

\* = одоогоор `isActive: false`

## Мэдээний agent — 2-р шат (үнэлгээ + монголоор бичих)
RAW нийтлэлийг хоёр LLM дуудлагаар боловсруулна: эхлээд хямд моделиор 1–10 оноо, дараа нь
босго давсныг нь монголоор бичиж `DRAFT` болгоно. Босго давахгүй бол `REJECTED`.

```bash
npm run agent:process -- --limit 10          # default 20
WRITE_MODEL=anthropic/claude-opus-5 npm run agent:process -- --limit 3   # бичих моделийг солих
```

**Ангилал.** Үнэлгээний дуудлага оноо, шалтгаангийн хамт `category`-г тодорхойлно
(`src/agent/category.ts`):

| Ангилал | Юу орох вэ |
|---|---|
| `NEWS` | салбарын мэдээ: шинэ модель, компанийн шийдвэр, хөрөнгө оруулалт |
| `PROJECT` | AI-аар хийсэн төсөл, бүтээгдэхүүн, нээлттэй эх |
| `BUSINESS` | бизнес санаа, орлого, мөнгө олсон жишээ |
| `FACT` | сонирхолтой баримт, судалгааны үр дүн |
| `RISK` | аюул, хууран мэхлэлт, хувийн мэдээлэл, зохицуулалт |
| `HOWTO` | хэрэглээ, заавар — уншигч өөрөө давтаж болох |

LLM танигдахгүй утга буцаавал эх сурвалжийн `defaultCategory` хэрэглэгдэнэ. Ангилал нь
өдрийн квот (нэг ангиллаас 2-оос илүүгүй), FB постын өнгө аяс, өдрийн slot сонголтод хэрэглэгдэнэ.

**PROJECT/HOWTO-д доод оноо нэгээр доогуур** (`CATEGORY_MIN_SCORE`, default 6). Эдгээр контент
нь жин багатай эх сурвалжаас (Product Hunt, TLDR, хувийн блог) ирдэг бөгөөд үнэлгээний модель
тэдэнд ховор 7+ өгдөг тул оройн slot (PROJECT/HOWTO/BUSINESS) хоосон үлддэг байв. Сулралт нь
agent-ийн `REJECTED` босго болон нийтлэх босго хоёуланд нь үйлчилнэ; ерөнхий босгыг бууруулбал
(`AUTO_PUBLISH_MIN_SCORE=5`) бүх ангилал түүнийг дагана.

Оноо өгөх гол шалгуур: **монгол уншигчид үүнийг ойлгох, хэрэгжүүлэх, гайхах боломжтой юу?**
Ганц компанийн PR бол бага оноо; хүний амьдрал, ажил, мөнгөнд нөлөөлөх бол өндөр.

`.env` тохиргоо:

| Хувьсагч | Утга |
|---|---|
| `SCORE_MODEL` | үнэлгээний модель (maxTokens 600, temperature 0.1) |
| `WRITE_MODEL` | монголоор бичих модель (maxTokens 4000, temperature 0.4) |
| `RELEVANCE_THRESHOLD` | үүнээс доош оноотой нийтлэл `REJECTED` (default 7; PROJECT/HOWTO-д 6) |
| `DAILY_PUBLISH_LIMIT` | өдөрт авто нийтлэх дээд тоо (default 3, `0` = унтраалттай) |
| `AUTO_PUBLISH_MIN_SCORE` | квотод нэр дэвших доод оноо (default 7) |

### Багц сонголт — холимог
Нэг run-д 30 нийтлэл авна, гэхдээ жин өндөртэй эх сурвалж (OpenAI Blog, TechCrunch ...) бүх ээлжийг
эзлэхгүйн тулд багцыг хоёр хуваана (`src/agent/raw.api.ts`):

| Бүлэг | Хэд | Юу орох вэ |
|---|---|---|
| Жин ≥ 7 | 15 | салбарын гол мэдээ — албан ёсны блог, томоохон хэвлэл |
| `defaultCategory` ∈ PROJECT/BUSINESS/FACT/HOWTO | 15 | төсөл, бизнес, баримт, заавар (ихэвчлэн жин багатай эх сурвалж) |

Бүлэг дотроо `publishedAtSource desc` (шинэ нь түрүүлнэ). Аль нэг бүлэг хүрэлцэхгүй бол нөгөөгөөр
нөхнө; хоёуланд нь орсон нийтлэлийг (жишээ Hugging Face: жин 8 ба PROJECT) нэг л удаа авна.

### Хоцрогдсон RAW
7 хоногоос хуучин RAW нийтлэлийг **үнэлэлгүй** `SKIPPED` болгоно — хуучин мэдээ нийтлэх утгагүй
бөгөөд дараалал эзэлж шинэ мэдээг хойшлуулдаг. Agent ажиллах бүрдээ үүнийг хийдэг; гараар:

```bash
npm run raw:prune            # 7 хоногоос хуучныг SKIPPED болгоно
npm run raw:prune -- --dry   # зөвхөн тоог харна
npm run raw:prune -- --days 3
```

`SKIPPED` нь `REJECTED`-ээс ялгаатай: LLM огт дуудаагүй, зүгээр л хоцорсон. /admin дээр тусдаа табтай.

RAW нийтлэлүүдийг `source.weight desc, publishedAtSource desc`-ээр авна — найдвартай эх сурвалж эхэлнэ.
Prompt-д `sourceText` (бүтэн текст) байвал түүнийг, үгүй бол `sourceExcerpt`-ийг өгнө; бүтэн текст
олдоогүйг моделд мэдэгдэж, богино (100–150 үг) бичихийг үүрэг болгоно.

Нийтлэл бүрт `relevance`, `scoreReason`, `scoreModel`, `writeModel`, `tokensUsed` хадгалагдана.
Дурдагдсан компанийг каталогтой тааруулж (alias-тай) `Article.companies`-т, моделийг **зөвхөн яг
таарах нэрээр** `Article.models`-т холбоно.
Алдаа гарвал тухайн нийтлэл `RAW` хэвээр үлдэж, дараагийн ажиллалтад дахин орно.

Анхаарах:
- **OpenRouter кредит `max_tokens`-ийг хязгаарладаг.** Үлдэгдэл бага үед "can only afford N tokens"
  гэсэн 402 алдаа гарна — ялангуяа үнэтэй бичих модель дээр. `chatJson` энэ тоог уншаад нэг удаа
  тэр хэмжээгээр дахин оролдоно, гэхдээ жинхэнэ шийдэл нь кредит нэмэх.
- **OpenAI Blog-ийн хуудсууд JS-ээр зурагддаг**, RSS-д нь `content:encoded` байхгүй (`description`
  ~150 тэмдэгт). Тиймээс `needsBrowser = true` — Playwright-аар нээж бүтэн текстийг авна.
  Playwright суугаагүй бол алдаа хэвлээд тухайн нийтлэл хураангуйгаар үргэлжилнэ.
- **Эдгээр endpoint дээр reasoning-ийг унтраах боломжгүй** ("Reasoning is mandatory for this
  endpoint"). `chatJson` үүнийг мэдэж, reasoning-гүй дуудлага татгалзвал reasoning-тэйгээр дахин
  дуудна. Ингэснээр reasoning токен `max_tokens`-оос иддэг тул бичих дуудлагад 4000 өгдөг.

## Редакторын самбар — /admin
`ADMIN_PASSWORD` тохируулаад `/admin` руу орно (HTTP Basic, хэрэглэгч `admin`). Нууц үг хоосон бол
хуудас 503 буцаана. Бусад зам нээлттэй.

- Самбар: RAW/DRAFT/PUBLISHED/REJECTED тоо, **«Өнөөдөр нийтэлсэн N/3»** (УБ цагаар, өдрийн квот),
  **«FB дараалалд M»**, `openrouter`/`rss`/`agent` ажлуудын сүүлийн ажиллалт.
- Таб бүр дээр нийтлэлийн жагсаалт: гарчиг, эх сурвалж, оноо, бүтэн текст байгаа эсэх (● / ○), огноо.
  DRAFT таб дээр мөр бүрт «Нийтлэх» / «Хаях». PUBLISHED таб дээр Facebook багана: постлосон огноо
  (постын холбоостой) эсвэл «хүлээгдэж байна» + «Одоо FB-д постлох» товч.
- Мөр бүрт ангиллын шошго (Мэдээ/Төсөл/Бизнес/Баримт/Эрсдэл/Хэрэглээ) харагдана.
- `/admin/<id>`: зүүн талд гарчиг, хураангуй, үндсэн текст, шошго, slug-ийн форм
  («Хадгалах», «Хадгалаад нийтлэх»); баруун талд эх мэдээлэл, үнэлгээний шалтгаан, бүтэн текст,
  «Дахин бичүүлэх» (тухайн нэг нийтлэлийг agent-аар дахин боловсруулна — LLM дуудна, алдаа гарвал
  хуудсан дээр харагдана), Facebook хэсэг: зургийн урьдчилсан харалт + «Зураг дахин үүсгэх»,
  FB текстийг гараар засах, «Дахин бичүүлэх (2 хувилбар)», нөөц хувилбар (A/B), «Одоо FB-д постлох».
- Нийтлэхэд `/`, `/medee`, `/medee/<slug>` болон холбогдсон моделийн хуудсууд шинэчлэгдэнэ.

### Ажиллуулах товчнууд
Самбар дээрээс гараар ажил эхлүүлнэ: **«Мэдээ татах»** (rss), **«Агент бичүүлэх»** (agent),
**«Бүгд»** (openrouter → arena → rss → agent → digest → newsletter → facebook).
Нэрлэсэн алхам (`--only`) өдөрт нэг удаагийн шалгалтыг алгасаж албадан ажиллана.

Товч дарахад `npx tsx src/pipeline.ts --only <нэр>` тусдаа процесс болж салж ажиллана
(server action дотор 5–10 минут хүлээвэл HTTP timeout болно). Гаралт нь
`logs/<нэр>-<цаг>.log` руу бичигдэж, `JobRun.pid` / `JobRun.logFile`-д тэмдэглэгдэнэ.

Job бүрийн төлөв мөр самбар дээр харагдана:
- **● ажиллаж байна**
- **✓ дууссан** HH:MM, орсон→гарсан
- **⚠ дууссан** (шараар) — оролдсоны **талаас илүү** нь унасан. Жишээ: agent 30 нийтлэлээс 20 нь
  алдаа өгсөн ч 10 нь бичигдсэн бол ажил «унасан» биш ч анхаарал хэрэгтэй. `JobRun.attempted` /
  `JobRun.failed`-аар тооцно (agent: нийтлэл, rss: эх сурвалж)
- **✗ алдаа** — алхам бүхэлдээ унасан (бүх нийтлэл/эх сурвалж унасан, эсвэл онцгой алдаа). Ажиллаж байгаа зүйл байвал хуудас 10 секунд тутам өөрөө шинэчлэгдэнэ. «лог» холбоосоор
`/admin/logs/<jobRunId>` дээр сүүлийн 200 мөрийг харна.

Нэг job давхар ажиллахаас хамгаалагдсан — ажиллаж байхад дахин дарвал «аль хэдийн ажиллаж байна»
гэж хэлнэ. 30 минутаас удсан дуусаагүй `JobRun`-ийг `ok = false`, `error = "timeout"` болгож хаана.

## Мэдээний хуудсууд
- `/medee` — нийтлэгдсэн мэдээ, 20-оор хуудаслана (`?page=`), 10 минут тутам шинэчлэгдэнэ.
- `/medee/<slug>` — гарчиг, хураангуй, markdown биет (`react-markdown`, raw HTML идэвхгүй), шошго,
  холбогдсон модель/компани, эх сурвалжийн холбоос, AI-аар бэлтгэсэн тухай тэмдэглэл.
- Нүүр хуудсанд сүүлийн 5 мэдээ, моделийн хуудсанд тухайн моделийг дурдсан сүүлийн 5 мэдээ гарна.

## Facebook — өдөрт 3 пост
`.env`-д `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `SITE_URL` бөглөнө. Token хоосон бол алхам алгасагдана.

```bash
npm run publish:facebook                     # тухайн slot-ын постыг тавина
npx tsx src/publish/fbcopy.ts <slug> --dry   # зөвхөн FB текстийг бичүүлж харах
npx tsx src/publish/fbimage.ts <slug> --out a.jpg   # зураг үүсгэж файлаар харах
npx tsx src/publish/fbimage.ts --ranking --out b.jpg # жагсаалтын карт
```

| Хувьсагч | Утга |
|---|---|
| `FB_POSTS_PER_RUN` | нэг run-д хэдэн пост (default 1). Pipeline өдөрт 3 удаа ажилладаг тул **өдөрт 3 пост** |
| `FB_COPY_MODEL` | FB текст бичих модель (хоосон бол `WRITE_MODEL`) |
| `IMAGE_MODEL` | зургийн модель (default `google/gemini-3.1-flash-lite-image`) |
| `FB_IMAGE_DAILY_LIMIT` | өдөрт үүсгэх зургийн дээд тоо (default 5, `0` = зураггүй) |
| `FB_USE_SOURCE_IMAGE` | `true` бол AI зургийн оронд эх нийтлэлийн `og:image` |
| `FB_SHOW_SOURCE` | `true` бол постод «Эх сурвалж: <домэйн>» мөр нэмнэ |
| `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN` | хоосон бол алхам алгасагдана |
| `SITE_URL` | постын холбоос: `SITE_URL/medee/<slug>` |

### Өдрийн 3 slot
Slot-ыг pipeline ажилласан цагаар (УБ) тодорхойлно — cron саатсан ч зөв сонгогдоно
(`src/publish/slot.api.ts`):

| Slot | УБ цаг | Юу тавих вэ |
|---|---|---|
| morning | 11:00 хүртэл | хамгийн өндөр оноотой `NEWS` / `RISK` |
| noon | 11:00–16:00 | **Мягмар/Пүрэв/Ням**: жагсаалтын карт. Бусад өдөр `FACT` / `BUSINESS` |
| evening | 16:00-аас хойш | `PROJECT` / `HOWTO` / `BUSINESS` |

Сонгосон ангиллын нийтлэл дараалалд байхгүй бол дараалалын дараагийнхыг (ямар ч ангилал) авна —
slot хоосон өнгөрөхгүй. Жагсаалтын карт өдөрт нэг л удаа (`FbRankingPost.day` unique).

### Постын карт (зураг + текст)
`src/publish/card.ts` — MOGUL маягийн «нэг баримт + текст давхарласан зураг». Хоёр зураг гарна:

| Юу | Хэмжээ | Хаана |
|---|---|---|
| `heroImageData` | 1080×1350, **тексгүй** | вэб нийтлэлийн дээр (16:9 огтолно), `/api/hero-image/<id>` |
| `fbImageData` | 1080×1350 (4:5), **тексттэй карт** | FB, IG пост, `/api/fb-image/<id>` |

**Суурь зураг.** Сэдвийн **хүний талыг** харуулна (моделийн шахалт → утсан дээрээ орчуулгын апп
ашиглаж буй хүн; чип → гал тогооны ширээн дээрх зөөврийн компьютер).

`FACT`, `HOWTO`, `PROJECT` ангилалд **лаборатори, физикийн багаж, цэвэр өрөө, микроскоп,
судлаач/техникч** дүрслэх нь хориотой (`isLabScene`) — уншигч өөрийгөө таних ёстой тул зөвхөн
өдөр тутмын орчин (утас, зөөврийн компьютер, гэр, кафе, оффис, дэлгүүр, гудамж, автобус).
`RISK`, `NEWS`, `BUSINESS` ангилалд нийтлэл нь яг тэр тухай бол мэргэжлийн орчин зөвшөөрөгдөнө.
Зөрчсөн дүрслэл гарвал шалтгааныг нь хэлж нэг удаа дахин гаргуулна.

`FB_USE_SOURCE_IMAGE=true` үед картын доод баруун буланд «Зураг: <эх сурвалж>» гэж жижгээр бичнэ. Компози: гол объект **дээд 2/3-д**, доод 1/3 хоосон/харанхуй (ширээ, шал, хана)
— тэнд headline бичигдэнэ. `IMAGE_MODEL`-ээр кино кадар/документари стилийн гэрэл зураг:
`documentary photograph, candid cinematic still, real people in a real place, 35mm film look,
slight grain, natural lighting`. Хориглосон: текст, лого, watermark, гялалзсан stock зураг,
3D render, CGI, неон, hologram, робот гар, цэнхэр дижитал дэвсгэр. `FB_USE_SOURCE_IMAGE=true` үед
эх нийтлэлийн `og:image`-ийг суурь болгоно (зардалгүй).

Модулиуд: `card.api.ts` (картын формат, headline-ийн дүрэм, зургийн дүрслэл/тохиргоо — цэвэр),
`card.ts` (LLM + sharp), `fbimage.ts` / `fbimage.api.ts` (зөвхөн өдрийн **жагсаалтын карт** ба
`imagesToday`, `recentImagePrompts` туслахууд).

**Давхарга** (`overlaySvg`, sharp + SVG): доод 45%-д хар→тунгалаг gradient, дээд 16%-д бага зэрэг
сүүдэр (wordmark уншигдахад); зүүн дээд буланд «AI News» 36px; headline 2–4 мөр, цагаан, Roboto Bold
56–64px, зүүн зэрэгцүүлсэн, 64px зайтай, мөр хооронд 1.15; доод зүүн буланд «_дагаарай» (FB) /
«_дэлгэрэнгүй bio-д» (IG) 28px, 70% тунгалаг.

Фонт нь `fonts/Roboto-{Bold,Regular}.ttf` — `src/publish/fonts.ts` нь түр fontconfig тохиргоо
үүсгэж `FONTCONFIG_FILE`-аар зааж өгдөг (контейнерт Roboto суулгах шаардлагагүй).

**Headline** (`fbHook`) — LLM 3 хувилбар бичээд тус бүрийг нь өөрөө үнэлнэ (surprise / relevance /
clarity, 0–10). `checkHook` давсан хувилбаруудаас **хамгийн өндөр оноотойг** сонгоно (тэнцвэл
богиныг). Бүтэц: `[хэн/юу] + [гайхалтай тоо эсвэл харьцуулалт] + [үр дагавар]`.

`checkHook`-ийн шалгуур:
- 110 тэмдэгтээс богино, нэг өгүүлбэр, emoji/хашилт/хашгирахгүй;
- **огноо хориотой** (`2026`, `9-р сарын 21`, `21-нд`) — `stripDates` эдгээрийг хасаж үзнэ, тиймээс
  зөвхөн огнооны тоо нь «тоотой» гэж тооцогдохгүй;
- **үр дагаврын тоо** байх (хувь, дахин, ам.доллар, сая хэрэглэгч, хугацаа) — эсвэл харьцуулалт
  («хүртэл», «ч гэсэн», «гэвч», «атал») байвал тоогүй ч болно;
- мэдээллийн хуурай хэллэг («танилцуулжээ», «зарлажээ», «төлөвлөжээ») хориотой — оронд нь
  «болж байна / болно / байдаг / хүрчээ».

4 мөрөөс хэтэрвэл фонт 64 → 56 → 48 болж багасна; 48 дээр ч багтахгүй бол headline дахин бичигдэнэ.

### Постын текст (тусдаа LLM дуудлага)
Гарчиг картан дээр бичигдсэн тул текст нь түүнийг **давтахгүй**, тайлбарлана
(`src/publish/fbcopy.ts` → `Article.fbText`, /admin-аас засаж болно).

```
<1 өгүүлбэр — гарчгийн контекст> <1–2 өгүүлбэр — яагаад чухал, монголд юу гэсэн үг>   (250–400 тэмдэгт)

Дэлгэрэнгүй: https://сайт/medee/slug

Өдөр бүр AI-ийн сонирхолтой мэдээ авахыг хүсвэл AI News-ийг дагаарай.
```

Instagram дээр холбоосын мөр «Дэлгэрэнгүй холбоос bio-д.» болж, дагах уриалгын оронд 5–8 hashtag
явна (`#AI #ХиймэлОюун #Монгол #технологи` + сэдвийн 2–4).

`FB_SHOW_SOURCE=true` үед постын төгсгөлд «Эх сурвалж: <домэйн>» мөр нэмэгдэнэ (анхдагчаар үгүй).
Emoji, хашилт, «AI-аар бичсэн» гэх илчлэлт, мэдээг нийтэлсэн сайтын нэр хориотой — харин компани,
модель, хүний нэрийг тодорхой бичнэ. Хоёр хувилбар бичигдэж нэг нь постлогдоод нөгөө нь
`fbTextAlt`-д A/B-д үлдэнэ.

### Дараалал
`status = PUBLISHED` бөгөөд `fbPostedAt` хоосон нийтлэлүүд дараалалд байна. Амжилттай бол
`fbPostId`, `fbPostedAt` бичигдэнэ. Алдаа гарвал `fbPostedAt` хоосон үлдэж **дараагийн run-д дахин
оролдоно**; `fbAttempts` нэмэгдэж, `fbError`-т сүүлийн алдаа бичигдэнэ. 3 удаа унасан нийтлэл
дараалалаас гарна (/admin дээр улаанаар «3 удаа алдаа»).

`/admin`-ы PUBLISHED таб болон `/admin/<id>` дээр FB төлөв харагдана; `/admin/<id>` дээр зургийн
урьдчилсан харалт, «Зураг дахин үүсгэх», FB текстийг засах, «Дахин бичүүлэх» товчнууд байна.

## Pipeline — хоёр горим
Cron **цаг бүр** ажиллана (`0 * * * *` UTC), код нь УБ цагаар (UTC+8) горимоо сонгоно.

```bash
npm run pipeline                      # цагаасаа хамаарч горимоо сонгоно
npm run pipeline -- --mode publish    # горим албадах
npm run pipeline -- --only rss        # зөвхөн нэг алхам (горим, өдрийн шалгалтыг алгасна)
npm run pipeline -- --skip arena
```

### НИЙТЛЭХ горим (publish) — УБ 07:00, 15:00, 19:00
`PUBLISH_HOURS_UB="7,15,19"`. Хоёр алхам ажиллана — `publish` ба `instagram`:

1. Жагсаалтын картын өдөр (Мягмар/Пүрэв/Ням, өдрийн slot) бол картаа FB-д тавиад дуусна.
2. Өдрийн квот дүүрээгүй бол **бэлэн (`readyAt`) DRAFT**-уудаас slot-ын ангилал ба квотын дүрмээр
   1 нийтлэл сонгож `PUBLISHED` болгоно. Бэлэн нийтлэл байхгүй бол ердийн DRAFT-аас сонгоно.
3. Тэр нийтлэлийг **шууд FB-д постлоно** — урьдчилан бэлтгэсэн `fbText` ба `fbImageData`-г
   ашиглана, байхгүй бол тэр дор нь үүсгэнэ.
4. Тэр нийтлэлийг **Instagram-д** постлоно (зурагтай бол) — [Instagram](#instagram).
5. Нийтлэх юм байхгүй бол FB дараалалд хүлээж буй постоор slot-оо дүүргэнэ.
6. `instagram` алхам өмнө нь унасан IG постуудыг дахин оролдоно.

RSS, үнэлгээ хийхгүй тул ихэвчлэн нэг минутын дотор дуусна.

### БЭЛТГЭХ горим (prepare) — бусад бүх цагт

| Алхам | Юу хийх вэ |
|---|---|
| `rss` | шинэ item татна |
| `agent` | `AGENT_BATCH` (default 10) RAW үнэлж DRAFT болгоно, холимог сонголттой. RAW дараалал 50-аас доош бол багц автоматаар **6** болж буурна |
| `improve` | дараагийн slot-уудад нийтлэл бэлдэнэ (доор) |
| `openrouter`, `arena`, `digest`, `newsletter` | өдөрт нэг удаа, УБ `DAILY_HOUR_UB` (3) цагаас хойш |

**Зардлын хамгаалалт.** `agent` алхам ажиллахаасаа өмнө тухайн УБ өдөрт LLM-д төлсөн нийт дүнг
(`JobRun.costUsd`) шалгана; `AGENT_DAILY_BUDGET_USD` (default 1.5) хэтэрсэн бол алгасна. Зардлыг
OpenRouter-ийн тайлагнасан бодит утгаар тооцно.

**improve алхам.** Бэлэн нийтлэлийн тоог `PREPARE_READY_TARGET` (default 3) хүртэл гүйцээнэ.

Сонголт нь **дараагийн slot-уудын ангиллаар** явагдана (`upcomingSlots`): эхний бэлдэх нийтлэл нь
дараагийн slot-ын ангиллаас (жишээ өглөө → NEWS/RISK), хоёр дахь нь түүний дараагийнхаас гэх мэт.
Жагсаалтын карт тавих slot алгасагдана (тэнд нийтлэл хэрэггүй). Нийтлэх үеийнхтэй ижил дүрэм
(эх сурвалж ≤2, ангилал ≤2, `sameTopic`) үйлчилнэ — нэг үйл явдлыг гурван эх сурвалжаас бэлдэхгүй.
Буфер нь ирээдүйн slot-уудынх тул **өнөөдөр нийтлэгдсэн** нь ангиллын хязгаарыг идэхгүй, зөвхөн
сэдвийн давхардал шалгахад л хэрэглэгдэнэ (`avoidTopics`).

Нийтлэл бүрт:

1. текстийг **нэг удаа** засварлана (гарчиг 60 тэмдэгтээс богино, эхний өгүүлбэр хүчтэй,
   давхардсан хэллэг арилгана) → `improvedAt`. Засвар нь эх хувилбараасаа дор байвал
   (богиносгосон, хоосон) хэвээр үлдээнэ.
2. FB текст бичнэ (`fbText` + `fbTextAlt`)
3. зураг үүсгэнэ — зөвхөн эхний 2 нийтлэлд (дараагийн 2 slot), `FB_IMAGE_DAILY_LIMIT`-ийн хүрээнд
4. `readyAt` тэмдэглэнэ

Алхам бүр idempotent (аль хэдийн хийгдсэнийг алгасна) тул цаг бүрийн run давхар зардал гаргахгүй.

Буфер дүүрэн үед ч алхам нэг зүйл хийнэ: **зураггүй үлдсэн бэлэн нийтлэлүүдэд зураг нөхнө**
(`topUpImages`). Өдрийн зургийн хязгаар дүүрсэн үед бэлдсэн нийтлэлүүд зураггүй үлддэг — маргааш
квот сэргэхэд эндээс нөхөгдөж, slot дээр зураг үүсгэхэд 25 секунд алдахгүй.

### Давхар ажиллахаас хамгаалах
Pipeline эхлэхдээ `JobRun(job: "pipeline")` мөр үүсгэж горимоо (`mode`) бичнэ. Өмнөх run дуусаагүй
байвал энэ удаад алгасна; 50 минутаас удсаныг үхсэн гэж үзэж хаана. Алхмуудын `JobRun`-д ч
горим бичигдэнэ (`JOB_MODE`).

`rss` алхам дээр **эх сурвалж бүр унасан**, `agent` алхам дээр **нийтлэл бүр унасан** бол алхмыг
унасан гэж үзнэ — cron дээр эвдрэл чимээгүй өнгөрөхгүй. `JobRun` мөн `ok = false` болж, /admin дээр
улаанаар харагдана.

## Автоматжуулалт (cron) — цаг бүр
```
0 * * * *
```
Горимыг код өөрөө сонгоно: УБ 07:00, 15:00, 19:00 — НИЙТЛЭХ; бусад цагт — БЭЛТГЭХ.

Локал (Kali):
```
0 * * * * cd /home/kali/ai-medee && /usr/bin/npm run pipeline >> logs/pipeline.log 2>&1
```
`logs/` хавтас git-д ордоггүй (`.gitignore`).

## Deploy (Railway, Hobby)
Гурван сервис: **Postgres**, **web**, **cron**. Хоёулаа нэг `Dockerfile`-ээс build хийгдэж,
зөвхөн start command-аараа ялгаатай.

| Сервис | Start command | Тайлбар |
|---|---|---|
| web | `npm run start:web` | `prisma migrate deploy` хийгээд `next start`. Health: `/api/health` |
| cron | `npm run start:cron` | `migrate deploy` → `seed:sources` → `src/pipeline.ts`. Schedule: `0 * * * *` (цаг бүр; горимоо өөрөө сонгоно) |

Cron сервис ажиллах бүрдээ `prisma migrate deploy` (advisory lock-той тул web-тэй зэрэг ажиллаж
болно) ба эх сурвалжийн seed-ийг хийгээд pipeline-ээ эхлүүлнэ.

### Env хувьсагчид

**web**

| Хувьсагч | Тайлбар |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `ADMIN_PASSWORD` | `/admin`-ы Basic auth нууц үг. Хоосон бол `/admin` 503 |
| `SITE_URL` | нийтийн домэйн, Facebook постын холбоост |
| `AUTH_SECRET` | **заавал** — хэрэглэгчийн session ([Auth.js](#хэрэглэгчийн-нэвтрэлт-authjs)) |
| `AUTH_URL` | `SITE_URL`-тай ижил |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google-ээр нэвтрэх (заавал биш) |
| `OPENROUTER_API_KEY` | зөвхөн `/admin` дээрх «Дахин бичүүлэх» товчинд |
| `NEXT_PUBLIC_UMAMI_URL`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | analytics — [Analytics (Umami)](#analytics-umami) |
| `OLD_HOSTS` | хуучин домэйнууд, таслалаар. Тэднээр ирсэн хүсэлтийг `SITE_URL` руу **301** — [Домэйн солих](#домэйн-солих) |
| `CSP_ENFORCE` | `true` бол CSP-г хатуу горимд (анхдагч: report-only) |
| `FB_PAGE_ID`, `IG_USERNAME` | хөлийн Facebook/Instagram холбоос ба схемийн `sameAs` |
| `RESEND_API_KEY`, `ADMIN_EMAIL` | долоо хоногийн админ тайлан (cron дээр ч хэрэгтэй) |
| `APP_ROLE` | `web` — холболтын сангийн хэмжээг сонгоно (`start:web` өөрөө тавьдаг) |
| `PRISMA_POOL_MAX` | холболтын сангийн хэмжээг гараар дарах (анхдагч: web 10, cron 5) |
| `NEXT_TELEMETRY_DISABLED` | `1` |

**cron**

| Хувьсагч | Тайлбар |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `OPENROUTER_API_KEY` | үнэлгээ, бичилт, жагсаалтын Data API |
| `SCORE_MODEL`, `WRITE_MODEL`, `RELEVANCE_THRESHOLD` | agent-ийн тохиргоо |
| `DAILY_PUBLISH_LIMIT`, `AUTO_PUBLISH_MIN_SCORE` | өдрийн нийтлэлийн квот (default 3, оноо ≥ 7) |
| `PUBLISH_HOURS_UB`, `DAILY_HOUR_UB` | нийтлэх цагууд (УБ) ба өдөрт нэг удаагийн алхмуудын цаг |
| `AGENT_BATCH`, `AGENT_DAILY_BUDGET_USD`, `PREPARE_READY_TARGET` | БЭЛТГЭХ горимын хязгаарууд |
| `SITE_URL` | Facebook/Instagram постын холбоос, зургийн нийтийн хаяг |
| `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN` | хоосон бол Facebook алхам алгасагдана |
| `IG_USER_ID` | Instagram business account id — хоосон бол IG алхам алгасагдана |
| `FB_POSTS_PER_RUN` | нэг run-д хэдэн пост (default 1 → өдөрт 3) |
| `FB_COPY_MODEL` | FB текстийн модель (хоосон бол `WRITE_MODEL`) |
| `IMAGE_MODEL`, `FB_IMAGE_DAILY_LIMIT`, `FB_USE_SOURCE_IMAGE` | FB постын зураг — [Facebook](#facebook--өдөрт-3-пост) |
| `RESEND_API_KEY`, `ADMIN_EMAIL` | Ням гарагийн админ тайлан (`npm run report:weekly`) |
| `APP_ROLE` | `cron` — холболтын сан 5 (`start:cron` өөрөө тавьдаг) |

## Домэйн солих

Сайтын хаяг **зөвхөн нэг газар** тодорхойлогдоно: `SITE_URL` env → `src/lib/site.ts`
(`siteUrl()`, `absUrl()`, `siteHost()`, `userAgent()`). Кодод хатуу бичсэн домэйн байхгүй
(`grep -rn "railway.app\|ainews.mn" src/` → 0).

Шинэ домэйн руу шилжих дараалал:

1. **DNS.** Домэйн нийлүүлэгч дээр `CNAME`-ээ Railway-ийн өгсөн хаяг руу заана
   (`www` дэд домэйн). Үндсэн домэйн (apex) бол Railway-ийн `A`/`ALIAS` заавраар.
2. **Railway → web сервис → Settings → Domains → Custom Domain.** Домэйнээ нэмээд
   гэрчилгээ (Let's Encrypt) гарахыг хүлээнэ — ихэвчлэн хэдэн минут.
3. **Env.** web ба cron сервис хоёуланд:
   - `SITE_URL=https://<шинэ домэйн>` (төгсгөлд ташуу зураасгүй)
   - `AUTH_URL=https://<шинэ домэйн>` — `SITE_URL`-тай яг ижил
   - `OLD_HOSTS=<хуучин>.up.railway.app` (олон бол таслалаар) — хуучин холбоосууд
     **301**-ээр шинэ рүү шилжинэ, хайлтын систем эрхээ дамжуулна
4. **Дахин deploy.** Зөвхөн хувьсагч солиход Railway хуучин image-аа дахин ажиллуулдаг.
   `SITE_URL` нь sitemap, robots, RSS-д **хүсэлтийн үед** уншигддаг тул restart хангалттай;
   гэхдээ баталгаатай байхын тулд дахин build хийвэл зүгээр.
5. **Шалгах:**
   ```bash
   curl -sI https://<хуучин>.up.railway.app/medee | head -3   # 301 + location: шинэ домэйн
   curl -s  https://<шинэ домэйн>/robots.txt                   # Sitemap: шинэ домэйн
   curl -s  https://<шинэ домэйн>/feed.xml | head -6           # <link> шинэ домэйн
   npm run audit:seo -- --base=https://<шинэ домэйн>           # canonical, og:*
   ```
6. **Facebook app.** developers.facebook.com → App → Settings → Basic → *App Domains*-д
   шинэ домэйн, *Site URL*-ыг мөн сольно. Sharing Debugger-ээр
   (`developers.facebook.com/tools/debug`) шинэ хаягийн og:image-ийг дахин татуулна.
7. **Instagram.** Профайлын bio дахь холбоосыг шинэ домэйн болгоно (IG постууд
   «холбоос bio-д» гэж бичдэг).
8. **Google Search Console.** Шинэ домэйнийг property болгон нэмж, эзэмшлээ батална.
   Хуучин property дээр **Change of Address** хэрэгслийг ажиллуулна (301 бэлэн байх ёстой).
   `https://<шинэ домэйн>/sitemap.xml`-ыг илгээнэ.
9. **Umami.** Website тохиргоон дахь домэйнийг сольно (эс тэгвээс шинэ домэйний
   үзэлт бүртгэгдэхгүй).

Хэсэг хугацааны дараа `OLD_HOSTS`-ыг хэвээр үлдээнэ — хуучин холбоос интернэтэд удаан
үлддэг тул хасах яарал байхгүй.

### Эхний удаад
Эх сурвалжууд `start:cron` дотор автоматаар seed хийгддэг. Хүсвэл гараар шууд ажиллуулж болно:
```bash
railway run --service cron npm run seed:sources
```

### Docker локал дээр
```bash
docker build -t ai-news .
docker run --rm -p 3000:3000 -e DATABASE_URL=... -e ADMIN_PASSWORD=... ai-news
```
Image суурь нь `mcr.microsoft.com/playwright:v1.63.0-noble` — chromium бэлэн байдаг тул
`npx playwright install` хэрэггүй. Жагсаалтын карт болон зургийн credit нь SVG-ээс sharp-аар
зурагддаг тул контейнерт кирилл дэмждэг фонт (DejaVu/Liberation) байх шаардлагатай — playwright
image дээр байдаг. **Playwright-ийн хувилбар `package.json`-той яг таарах ёстой**
(тиймээс `"playwright": "1.63.0"` гэж тогтоосон, `^` байхгүй) — зөрвөл browser олдохгүй.

## Өдрийн квотоор авто нийтлэх
Агент нийтлэл бүрийг `DRAFT` болгож бичнэ. Алхмын **төгсгөлд** квотын шат ажиллаж, УБ цагаар
(`Asia/Ulaanbaatar`, UTC+8) тухайн өдөр аль хэдийн нийтлэгдсэн мэдээг тоолоод үлдсэн квотыг
`DRAFT`-уудаас сонгож `PUBLISHED` болгоно (`publishedAt = now`, `reviewedBy = "auto"`).

| Хувьсагч | Утга |
|---|---|
| `DAILY_PUBLISH_LIMIT` | өдөрт дээд тал нь хэдэн мэдээ (default `3`, `0` = авто нийтлэх унтраалттай) |
| `AUTO_PUBLISH_MIN_SCORE` | квотод нэр дэвших доод оноо (default `7`; PROJECT/HOWTO-д `6`) |

Сонголтын дүрэм (`src/agent/quota.api.ts`, тесттэй):
1. **Оноо өндөрөөс нь** эхэлнэ, тэнцвэл эх сурвалжийн шинэ мэдээ түрүүлнэ.
2. **Нэг эх сурвалжаас өдөрт 2-оос илүүгүй** — нэг сайтын эгнээ болохгүйн тулд.
3. **Нэг ангиллаас өдөрт 2-оос илүүгүй** — өдрийн 3 пост бүгд ижил төрлийн болохгүйн тулд.
   Түүнчлэн **боломжтой бол өдрийн сонголтод дор хаяж нэг NEWS-ээс бусад ангилал** орно: сүүлийн
   суудлыг NEWS эзлэх гэж байвал оноо багатай ч PROJECT/BUSINESS/FACT/RISK/HOWTO нэр дэвшигчид
   өгнө (ийм нэр дэвшигч байхгүй бол суудал хоосон үлдэхгүй, NEWS-ээр дүүргэнэ).
4. **Ижил сэдэв/модель давхардуулахгүй** — ижил модель дурдсан, эсвэл ижил компани + ижил
   шошготой мэдээнээс нэгийг л авна.
5. Зөвхөн **бүтэн тексттэй** (`sourceText`) нийтлэл — хураангуйгаар бичигдсэнд баримт дутуу байж мэднэ.

Өдрийн турш хязгаарыг барина: 09:00-ийн run 3 нийтэлбэл 13:00, 19:00-ийнх нь юу ч нийтлэхгүй.
Гараар `/admin`-аас нийтэлсэн нь **мөн квотод тооцогдоно** (`publishedAt`-аар тоолдог), эх сурвалж,
сэдвийн хязгаарт ч ордог. Квотод багтаагүй нийтлэл `DRAFT` хэвээр хүлээж, маргааш дахин нэр дэвшинэ.

`/admin`-ийн нүүрэнд «Өнөөдөр нийтэлсэн N/3» гэж харагдана; авто нийтлэгдсэн нь «авто» шошготой.

> **Анхааруулга:** эхний 2–4 долоо хоног `DAILY_PUBLISH_LIMIT=0` тавьж, агентын бичсэнийг гараар
> хянана уу. Гарчиг, тоо, нэр томьёо тогтвортой зөв гарч байгаад итгэсний дараа л асаана.

## Хэрэглэгчийн нэвтрэлт (Auth.js)
`next-auth` v5 + Prisma adapter. Session нь **JWT, 30 хоног** (Credentials provider нь database
session дэмждэггүй). Хэрэглэгчийн хүснэгтүүд: `User`, `Account`, `Session`, `VerificationToken`.

| Хувьсагч | Утга |
|---|---|
| `AUTH_SECRET` | **заавал** — `openssl rand -base64 32` |
| `AUTH_URL` | сайтын үндсэн хаяг (`SITE_URL`-тай ижил). Локалд хоосон байж болно |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | хоёулаа байвал л Google-ийн товч харагдана |

**Нэвтрэх аргууд**
- Имэйл + нууц үг (bcryptjs, 8-аас доошгүй тэмдэгт, хэт түгээмэл нууц үгийг хориглоно).
- Google OAuth — түлхүүр тохируулаагүй бол товч ч харагдахгүй. Redirect URI:
  `<AUTH_URL>/api/auth/callback/google`.

**Имэйл баталгаажуулалт.** Бүртгүүлэхэд Resend-ээр холбоос илгээнэ (24 цаг хүчинтэй);
`RESEND_API_KEY` байхгүй бол dev-д консолд хэвлэнэ. Баталгаажаагүй хэрэглэгч **нэвтэрч чадна**,
гэхдээ бичих үйлдэлд `requireVerified()` шаардана (коммент, prompt нэмэх — 0.2-т). Нууц үг сэргээх
холбоос 1 цаг хүчинтэй (`/nevtreh/martsan`); сэргээсэн нь имэйлээ эзэмшдэгийг баталдаг тул
баталгаажсанд тооцно.

**Хуудсууд:** `/nevtreh`, `/burtguuleh`, `/nevtreh/martsan`, `/nevtreh/shine-nuuts-ug/<token>`,
`/batalgaajuulah/<token>`, `/profile/*`. Header дээр нэвтрээгүй бол «Нэвтрэх» товч, нэвтэрсэн бол
нэр/зурагтай цэс (Профайл, Гарах).

**Аюулгүй байдал**
- Хязгаарлалт (IP-ээр, in-memory): нэвтрэх 5/мин, бүртгэл 3/цаг, нууц үг сэргээх 3/цаг.
- Нэвтрэх алдаа үргэлж «Имэйл эсвэл нууц үг буруу байна» — бүртгэлтэй эсэхийг задруулахгүй.
  Бүртгэл, сэргээх хариу ч ижил зарчмаар («хэрэв энэ хаяг бүртгэлтэй бол...»).
- CSRF-ийг Auth.js өөрөө хариуцна; форм бүр server action-аар явна.
- `middleware.ts`: `/profile/*` нь session cookie шаардана (жинхэнэ шалгалтыг хуудас өөрөө
  `currentUser()`-ээр хийнэ), `/admin/*` хэвээр `ADMIN_PASSWORD`-оор.

**Newsletter холболт.** Бүртгүүлэхдээ «Долоо хоногийн имэйл авах» сонговол `Subscriber` үүснэ;
ижил имэйлтэй бүртгэл аль хэдийн байвал `Subscriber.userId` нь хэрэглэгчтэй холбогдоно.

**Umami event:** `login`, `register`, `verify_email`.

## Профайл, хадгалах, сонирхол
Нэвтэрсэн хэрэглэгчийн хэсэг — `/profile` доорх 4 таб. Бүгд `force-dynamic`, layout нь
`currentUser()`-ээр хамгаалагдана.

| Таб | Юу хийдэг |
|---|---|
| `/profile` | нэр солих, имэйл/төлөв, баталгаажуулах холбоос дахин авах, нууц үг солих |
| `/profile/hadgalsan` | хадгалсан нийтлэлүүд, ангиллаар шүүх, хоосон үед сүүлийн 3 мэдээ санал болгоно |
| `/profile/sonirhol` | ангилал + хэрэглээний сонголт, долоо хоногийн имэйл авах эсэх |
| `/profile/ayuulgui` | бүх төхөөрөмжөөс гарах, бүртгэл устгах |

**Хадгалах (bookmark).** `Bookmark(userId, articleId)` — `@@unique([userId, articleId])`.
`toggleBookmarkFor()` нь **идемпотент**: хасахдаа `deleteMany` (олдоогүй ч алдаа гаргахгүй),
хадгалахдаа unique зөрчлийг (`P2002`) залгина — хоёр таб зэрэг дарахад давхар мөр үүсэхгүй.
Товч нь `useOptimistic`-тэй тул дарах агшинд шууд дүрслэгдэнэ; нэвтрээгүй бол
`/nevtreh?ur=<буцах зам>` руу явуулна.

**Сонирхол.** `UserPreference(categories[], usecases[], digestEmail)`. **Хоосон ангилал = бүгд**
гэсэн үг тул нүүрний «Таны сонирхол» блок харагдахгүй (`showInterestBlock`). Form-оос ирсэн утгыг
`cleanCategories` / `cleanUsecases` шүүнэ — танигдахгүй ангилал, идэвхгүй болсон slug орохгүй.
«Долоо хоногийн имэйл» сонголт `Subscriber`-тэй синк болно (`syncDigestEmail`): унтраахад мөрийг
устгахгүй `UNSUBSCRIBED` болгоно, дахин асаахад анхны `confirmedAt` хэвээр үлдэнэ.

**Бүх төхөөрөмжөөс гарах.** `User.sessionVersion`-ыг нэмэгдүүлнэ. JWT дотор `sv` талбар явдаг тул
хуучин токенууд дараагийн хүсэлт дээрээ хүчингүй болно.

**Бүртгэл устгах.** `УСТГАХ` гэж бичиж баталгаажуулна. `Bookmark`, `UserPreference`, `Account`,
`Session` нь FK-аар cascade устана; `Subscriber.userId` нь `SetNull` тул имэйлийн бүртгэлийг
гараар устгана.

**/admin → Хэрэглэгчид** (`/admin/hereglegch`): нийт бүртгэл, баталгаажсан хувь, сонирхол
тохируулсан тоо, сүүлийн 20 бүртгэл (нэвтрэх арга, төлөв), хамгийн их хадгалагдсан топ 10 нийтлэл.

**Umami event:** `bookmark_add`, `bookmark_remove`.

## Заавар (/zaavar) — мөнхийн контент
HOWTO гарын авлагууд. Мэдээ хурдан хуучирдаг бол заавар нь Google-ээс жилээр траффик татна.

**Модель:** `Guide` — `slug`, `title`, `lead`, `bodyMd`, `level` (BEGINNER/INTERMEDIATE/ADVANCED),
`audience[]`, `tools[]`, `usecaseSlug` (`/hereglee`-тэй холбоно), `readMinutes`, `heroImageData`,
`faq` (Json `[{q,a}]`), `status`, `views`, `topic` (захиалсан сэдэв), `costUsd`.
Тусдаа `GuideStep` хүснэгт БАЙХГҮЙ — алхмууд нь `bodyMd` доторх `##` гарчгууд.

**bodyMd-ийн гэрээ**

| Тэмдэглэгээ | Юу болох вэ |
|---|---|
| `## Гарчиг` | TOC-ийн мөр, JSON-LD HowTo-ийн алхам, `id` нь `slugify(гарчиг)` |
| ` ```prompt … ``` ` | «Хуулах» товчтой `<PromptBox>` |
| ` ```js … ``` ` | энгийн код блок |

`headingId()`-г `tocFromMarkdown` ба `GuideBody` хоёул дууддаг тул TOC-ийн холбоос үргэлж таарна.
Ижил гарчиг давхардвал хоёр дахь нь `-2` авна.

**Хуудсууд:** `/zaavar` (түвшин/хэн/хэрэгслээр шүүх), `/zaavar/<slug>` (sticky TOC, PromptBox,
хэрэгслийн chip, FAQ accordion, холбоотой 3 заавар + хэрэглээний ангилал, Хадгалах товч).
Nav-д «Заавар», нүүрний «Сүүлийн мэдээ»-ний доор «Шинэ заавар» 3 карт.

**Хадгалах.** `Bookmark` нь одоо нийтлэл ЭСВЭЛ заавар заана: `articleId`/`guideId` хоёрын **яг нэг
нь** бөглөгдөнө (DB-д `CHECK (num_nonnulls(...) = 1)`, Prisma-д илэрхийлэгддэггүй тул гараар).

**SEO**
- `metadata`: title ≤60, description ≤155 (`clamp` нь үгийн дунд таслахгүй), canonical, OG/Twitter.
- JSON-LD: `HowTo` (алхмууд `##`-аас, `totalTime`, алхам бүр `#id` холбоостой) + `FAQPage`.
- `/sitemap.xml` — мэдээ, заавар, модель (1000 хүртэл), хэрэглээ, статик хуудсууд. Заавар нь
  мэдээнээс өндөр `priority` (0.9 vs 0.6).
- `/robots.txt` — `/api/` хаалттай, гэхдээ зургийн эндпойнтууд (`guide-image`, `hero-image`,
  `fb-image`, `og`) тусад нь `Allow` — эс тэгвээс og:image, HowTo зураг индексэд орохгүй.
- Хуудас бүрд «Сүүлд шинэчилсэн» огноо.

**Контент үүсгэх** — `/admin/zaavar`
- «Сэдвээс заавар бичүүлэх»: сэдэв + зорилтот уншигч + түвшин → `WRITE_MODEL` бүтэн заавар бичнэ
  (lead 2 өгүүлбэр, 5–8 алхам, шаардлагатай алхамд prompt, «Түгээмэл алдаа», FAQ 3–5).
  `checkGuide` давахгүй бол нэг удаа дахин бичүүлнэ.
- **Хэрэгслийн нэрийг зааврын хэллэгт ЗӨВШӨӨРНӨ.** FB текстийн «эх сурвалж/загварын нэр бүү дурд»
  дүрэм энд хамаарахгүй — заавар нь ChatGPT, Gemini, Canva-г нэрээр нь заах ёстой.
- Hero зураг нь `card.ts`-ийн scene урсгалаар (`buildHero`), ангилал нь `HOWTO` тул лаборатори,
  микроскоп гарахгүй — энгийн хүн, өдөр тутмын орчин.
- Бүх заавар **DRAFT**-аар үүснэ. Автомат нийтлэхгүй — админ уншиж, засаад өөрөө нийтэлнэ.

```bash
npm run seed:guides              # 12 суурь сэдвийг DRAFT-аар (~$0.6, зурагтай)
npm run seed:guides -- --no-hero # зураггүй, хямд
npm run seed:guides -- --only 3  # эхний 3
npx tsx src/guides/write.ts "сэдэв" --audience оюутан --level BEGINNER
```

Давтан ажиллуулахад аюулгүй: `Guide.topic`-оор давхардлыг шалгана (гарчгийг LLM өөрөө бичдэг тул
slug-аас сэдвийг таних боломжгүй).

**Үзэлт.** Umami-гаас татахгүй, `Guide.views`-ыг DB дээр шууд `increment` хийнэ. `isBot()` нь
user-agent-аар crawler, curl, headless-ийг шүүнэ (UA огт байхгүй бол ч тоолохгүй).

**Umami event:** `guide_view`, `prompt_copy`, `guide_filter`.

## Prompt сан (/prompt)
Монгол хэлний prompt-уудын каталог. Хэрэглэгч ч нэмнэ.

**Модель:** `Prompt` — `slug`, `title`, `body`, `description` (≤200), `category` (9 ангилал),
`tools[]`, `language` (MN/EN/MIXED), `variables[]`, `authorUserId`, `source` (SITE/USER),
`status` (PENDING/PUBLISHED/REJECTED), `copies`, `likes`, `topic`, `rejectReason`.
Дагалдах: `PromptLike` (userId+promptId түлхүүр), `PromptReport` (гомдол).

**Хувьсагчийн гэрээ.** Текст дотор `{компанийн нэр}` гэж бичвэл бөглөх нүх болно.
`extractVariables` нь бичигдсэн дарааллаар, давхардалгүй задална; `fillVariables` нь бөглөсөн нүхийг
солиод бөглөөгүйг нь `{хаалт}` хэвээр үлдээнэ (хуулаад гараар нөхөж болно). Мөр таслалттай
`{...}` нь хувьсагч биш. Хадгалах бүрд `variables` дахин тооцогдоно.

**Хуудсууд**

| Зам | Юу байна |
|---|---|
| `/prompt` | карт grid, шүүлт (ангилал, хэрэгсэл, хэл), эрэмбэ (шинэ / их хуулагдсан / их таалагдсан) |
| `/prompt/<slug>` | бүтэн текст, хувьсагч бөглөх, ChatGPT/Gemini-д нээх, холбоотой 4 prompt + заавар |
| `/prompt/nemeh` | нэвтэрсэн + баталгаажсан хэрэглэгч нэмнэ, урьдчилан харна |
| `/profile/prompt` | «Миний prompt» — төлөв, татгалзсан шалтгаан, устгах |
| `/admin/prompt` | PENDING/PUBLISHED/REJECTED таб, батлах/татгалзах/засах/устгах |

Nav-д «Prompt», нүүрэнд «Өнөөдрийн prompt» (likes+copies-оор шилдэг 20-оос өдрийн дугаараар нэг нь).

**Хуулах.** Нэвтрэхгүйгээр ажиллана — `copies` тоолуур л нэмэгдэнэ. Хадгалах (`Bookmark.promptId`)
ба зүрх (`PromptLike`) нь нэвтрэхийг шаардана. `Bookmark`-ийн CHECK одоо 3 багана:
`num_nonnulls(articleId, guideId, promptId) = 1`.

`likes` багана нь `PromptLike`-ийн тоог **дахин тоолж** тусгана (increment биш) — хоёр таб зэрэг
дарахад тоолуур бодит байдлаас салахгүй, сөрөг тоо гарахгүй.

**Хэрэглэгчийн prompt.** `requireVerified()` шаардана. Хязгаар нь **өдөрт 5** — in-memory биш,
`Prompt.createdAt`-аар УБ хоногоор DB-ээс тоолно (сервер дахин эхлэхэд тэглэгдэхгүй).
Илгээмэгц LLM автомат шалгалт (`SCORE_MODEL`) ажиллана:

- Илт муу (spam / unsafe / nonsense / not-prompt / language) → **REJECTED**, шалтгаан нь монголоор.
- Бусад бүх тохиолдолд → **PENDING**, админ шийднэ. **LLM унасан ч PENDING** — хэрэглэгчийг
  шийтгэхгүй. Шалгалт нь эргэлзвэл зөвшөөрдөг тал руугаа тохируулагдсан.

Админ батлах/татгалзахад зохиогч руу имэйл явна (`RESEND_API_KEY` байвал; эс тэгвээс dev консол).

**SEO:** metadata + canonical, JSON-LD `CreativeWork` (`text` нь prompt өөрөө, зохиогч нь
SITE бол Organization, USER бол Person), sitemap-д `priority` 0.7. `/prompt/nemeh` нь `noindex`.

**Хайлт:** `Prompt.searchVector` (гарчиг A, тайлбар B, бие C) — `/api/search`, `⌘K`, `/hailt`
бүгдэд «Prompt» бүлэг нэмэгдсэн.

```bash
npm run seed:prompts              # 40 сайт-prompt (ангилал бүрт 4–5), ~$0.25
npm run seed:prompts -- --only 5  # эхний 5
```

Давтан ажиллуулахад аюулгүй (`Prompt.topic`). **Production дээр** Railway-ийн web service дотроос:

```bash
railway run --service web npm run seed:prompts
```

(эсвэл Railway UI → service → Settings → `npm run seed:prompts`-ыг нэг удаагийн command болгон
ажиллуулна. `DATABASE_URL`, `OPENROUTER_API_KEY`, `WRITE_MODEL` тухайн орчинд байх ёстой.)

**Umami event:** `prompt_copy` (`from: guide|prompt`), `prompt_like`, `prompt_submit`,
`prompt_open_chatgpt`, `prompt_view`, `prompt_filter`.

## Монгол хэлний бенчмарк (/benchmark)
Сар бүр топ моделиудыг **монгол хэлний бодит даалгавраар** тестлээд эрэмбэлнэ. Дэлхийн
бенчмаркууд англиар хэмждэг — монголоор хэн ч тогтмол хэмждэггүй.

**Модель:** `BenchTask` (даалгавар, лавлах хариулт, rubric, checker, жин), `BenchRun` (сарын нэг
ажиллагаа), `BenchResult` (модель×даалгавар бүрийн гаралт, оноо), `BenchModelSummary` (дүн, эрэмбэ).

**Даалгаврууд.** 30 ширхэг, 10 ангилалд 3-3: орчуулга (МН→АН, АН→МН), товчлол, найруулга, албан
бичиг, унших ойлголт, тоон бодлого, монгол соёл, заавар дагах, JSON гаргах. Агуулга нь бодит:
Монголбанкны мэдээ, гэрээний заалт, ХХК-ийн албан бичиг, УБ-ын автобусны хуваарь, Наадам,
Цагаан сар, тендерийн нөхцөл.

**Даалгаврыг нийтэд харуулахгүй** (contamination — дараагийн үеийн моделиуд сургалтдаа
оруулбал оноо зохиомлоор өснө). Ангиллын тайлбар ба `isPublic` тэмдэгтэй цөөн жишээ нээлттэй.

**Хоёр давхар үнэлгээ**

| Давхарга | Юу хийдэг |
|---|---|
| Тодорхой шалгалт (`checker`) | JSON хүчинтэй эсэх, үгийн тоо, кириллийн хувь. **Унавал оноо 0** |
| LLM шүүгч (`BENCH_JUDGE_MODEL`) | rubric + лавлах хариулттай хамт 0–10 оноо + 1 өгүүлбэр |
| Хоёр дахь шүүгч (`BENCH_JUDGE_MODEL_2`) | шүүгчтэй **ижил компанийн** моделийг давхар үнэлж дунджална |
| Хүний хяналт | `/admin/benchmark` дээр `humanScore` — LLM-ийнхийг дарна |

`finalScore` дараалал: гар оноо → хариу өгөөгүй бол 0 → checker унасан бол 0 → шүүгчийн оноо.

**Ажиллах нөхцөл.** Модель бүр ижил: temperature 0, max_tokens 1200, timeout 60с, алдаа гарвал
2 удаа retry (2с, 6с). Хариу өгөөгүй эсвэл checker унасан даалгаварт шүүгчийг дуудахгүй — зардал
хэмнэнэ.

**Моделийн сонголт.** OpenRouter хэрэглээний топ 15 + `BENCH_EXTRA_MODELS` (анхдагчаар GPT,
Claude, Gemini-ийн flagship). Flagship-ууд жагсаалтын **эхэнд** тавигдана — төсөв дуусвал тэд
хасагдахгүй.

**Төсөв.** `BENCH_BUDGET_USD` (анхдагч 15). Модель эхлэхийн өмнө бүтэн багц багтах эсэхийг
шалгана — дундуур тасалбал тухайн моделийн дүн бүрэн бус болно. Хэтэрвэл `status=BUDGET`,
хэдэн модель тестлэгдээгүйг `note`-д бичнэ. Эхлэхийн өмнө урьдчилсан тооцоог логд хэвлэнэ.

**Оноо.** Даалгавруудын **жигнэсэн дундаж** (заавар дагах, JSON нь 2 дахин их жинтэй). Тэнцвэл
хурдан нь дээгүүр. «Монгол 1000 үгийн үнэ» нь тарифаас биш **бодит хэмжилтээс** —
зарцуулсан мөнгө ÷ гаргасан монгол үгийн тоо × 1000.

**Хуудсууд:** `/benchmark` (hero + heat cell хүснэгт + ангиллын шүүлт + нээлттэй жишээ),
`/benchmark/<modelSlug>` (ангиллын оноо, шүүгчийн тайлбар, нээлттэй даалгавар дээрх бодит
хариулт), `/benchmark/argachlal` (аргачлал ба **хязгаарлалт** — найдвартай байдлын үндэс),
`/admin/benchmark` (run эхлүүлэх, явц, зардал, гар оноо, даалгавар засах).

`/model/<slug>`-д «Монгол хэлний оноо» блок, нүүрний Топ 10-д «MN» багана нэмэгдсэн.

**Автомат контент.** Run дуусахад (а) топ 5, гэнэтийн үр дүн, ангиллын шилдгийг багтаасан
нийтлэл **DRAFT**-аар үүснэ (админ нийтэлнэ); (б) жагсаалтын картын өдөр шинэ бенчмарк байвал
FB/IG-д **бенчмаркийн карт** (топ 5 + онооны тууз) сард нэг удаа тавигдана.

**SEO:** JSON-LD `Dataset` + `ItemList` (`AggregateRating`), metadata «Монгол хэлээр хамгийн сайн
AI модель — <сар>», sitemap-д хоёр хуудас.

```bash
npm run seed:bench                 # 30 даалгавар + лавлах хариулт (~$0.28)
npm run seed:bench -- --no-reference   # зөвхөн даалгавар, үнэгүй
npm run bench                      # энэ сарын бүтэн run
npm run bench -- --month 2026-10   # тодорхой сар
npm run bench -- --models a/b,c/d --tasks 5 --budget 2   # туршилт
```

**Production дээр бүтэн run:**

```bash
railway run --service web npm run bench -- --month 2026-10
```

Эсвэл юу ч хийхгүй — pipeline нь **сарын 1-нд** БЭЛТГЭХ горимд өөрөө ажиллуулна
(`--only bench`-ээр гараар ч дуудаж болно, /admin/benchmark дээрх товч үүнийг хийдэг).

| Env | Утга |
|---|---|
| `BENCH_JUDGE_MODEL` | шүүгч (анхдагч `anthropic/claude-sonnet-5`) |
| `BENCH_JUDGE_MODEL_2` | хоёр дахь шүүгч; тохируулаагүй бол өөр компанийн нэгийг автоматаар |
| `BENCH_EXTRA_MODELS` | таслалаар, заавал орох моделиуд |
| `BENCH_BUDGET_USD` | нэг run-ийн төсөв (анхдагч 15) |
| `BENCH_REFERENCE_MODEL` | лавлах хариулт бичих модель (анхдагч = шүүгч) |

**Umami event:** `bench_view`, `bench_model_view`.

## AI хэрэгслийн каталог (/hereglel)
Монгол хэрэглэгчид зориулсан AI хэрэгслийн бүрэн каталог: үнэ, **монгол хэлний дэмжлэг**,
платформ, хэрэглэгчийн үнэлгээ. Дараа affiliate орлогын суурь.

**`/hereglee` vs `/hereglel`.** Хоёр нь өөр зорилготой: `/hereglee` нь «юунд ашиглах вэ» гэсэн
редакцийн товч жагсаалт (хуучин `AiTool` модель), `/hereglel` нь бүрэн каталог (шинэ `Tool`
модель). Андуурахгүйн тулд nav-д **«Хэрэгсэл»** (каталог) л байна; `/hereglee` нь нүүрнээс
холбогдож, хуудас бүр дээр тухайн ангиллын каталогийн топ 5-ыг харуулна
(`categoryForUseCase` нь usecase slug-ийг `ToolCategory`-той холбоно).

**Модель:** `Tool` — `slug`, `name`, `tagline` (≤80), `descriptionMd`, `website`, `logoData`
(64×64), `categories[]` (14 ангилал), `pricing` (FREE/FREEMIUM/TRIAL/PAID), `priceFrom`,
`mongolianSupport` (NONE/PARTIAL/GOOD), `platforms[]`, `mnNoteMd`, `affiliateUrl`, `rating`,
`reviewCount`, `upvotes`, `status`, `source`, `topic`. Дагалдах: `ToolReview` (toolId+userId
unique), `ToolClick` (toolId+day unique), `ToolUpvote` (userId+toolId).

`ToolPlan` нь `AiTool`-ийн хуучин `ToolPricing`-ээс тусдаа — TRIAL нэмэгдсэн.

**Хуудсууд**

| Зам | Юу байна |
|---|---|
| `/hereglel` | карт grid, шүүлт (ангилал, үнэ, MN дэмжлэг, платформ), эрэмбэ (алдартай/шинэ/үнэлгээ) |
| `/hereglel/<slug>` | толгой, үнэ/платформ хүснэгт, тайлбар, «Монгол хэрэглэгчид анхаарах», хувилбарууд, холбоотой заавар/prompt, шүүмж |
| `/hereglel/<a>-vs-<b>` | хоёр хэрэгслийг хажуу хажуугаар (Б.2-ын суурь) |
| `/hereglel/nemeh` | хэрэглэгч санал болгоно — LLM автоматаар бөглөж PENDING болгоно |
| `/admin/hereglel` | батлах, засах, affiliateUrl, лого дахин татах, «LLM-ээр шинэчлэх», шүүмж хянах |

Харьцуулалт нь тусдаа route биш — `[slug]` дотор `parseVersusSlug` нь `-vs-`-ийг таньдаг.
Тусдаа сегмент байвал `chatgpt-vs-claude` хоёр route-д зэрэг таарч зөрчилдөнө.

**«Алдартай» эрэмбэ** = `upvotes × 3 + сүүлийн 30 хоногийн товшилт`. Upvote нь хэрэглэгчийн
санаатай үйлдэл тул товшилтоос хүндтэй. Товшилт нь DB-д байдаг тул SQL-ээр эрэмбэлэх
боломжгүй — оноог кодод бодож эрэмбэлнэ.

**Товшилт.** «Вэбсайт руу →» товч нэвтрэхгүй ч ажиллана, `ToolClick`-д өдрөөр нэгтгэгдэнэ.
Affiliate холбоос үед `rel="sponsored nofollow"` + хуудсан дээр ил тод тайлбар.

**Upvote, шүүмж.** `upvotes` ба `rating`/`reviewCount` баганууд increment биш — бүртгэлийн
бодит тооноос **дахин бодогдоно**, тиймээс зэрэг дарахад тоолуур бодит байдлаас салахгүй.
Шүүмж нь `requireVerified()` шаардана, нэг хэрэглэгч нэг хэрэгсэлд нэг шүүмж (дахин бичвэл
шинэчлэгдэнэ). Текст байвал А.2-ын LLM moderation ажиллана — илт муу бол PENDING болж
админ хянана. **PENDING шүүмж дүнд орохгүй.**

**Лого.** Дараалал: сайтын HTML дахь `<link rel="icon">` → `/favicon.ico` → Google s2 favicons.
Бүгд бүтэхгүй бол нэрнээс тогтвортой өнгөтэй **үсгэн avatar**. SVG дотор `<script>` байвал
хүлээж авахгүй; `/api/tool-logo/<slug>` нь `sandbox` CSP-тэй.

**Bookmark**-ийн CHECK одоо 4 багана: `num_nonnulls(articleId, guideId, promptId, toolId) = 1`.

**SEO:** `SoftwareApplication` JSON-LD — `offers` (үнэ мэдэгдэхгүй бол огт бичихгүй, 0 гэвэл
хуурамч), `aggregateRating` (шүүмж байвал), `sameAs` нь хэрэгслийн сайт. metadata: «X — үнэ,
монгол хэлний дэмжлэг, хувилбарууд». sitemap-д `priority` 0.8.

```bash
npm run seed:tools                 # 80 хэрэгсэл + LLM тайлбар + лого (~$0.6)
npm run seed:tools -- --only 5     # эхний 5
npm run seed:tools -- --no-logo    # лого татахгүй (хурдан)
npm run seed:tools -- --logos-only # байгаа хэрэгслүүдийн логыг л татна
```

**Production дээр:**

```bash
railway run --service web npm run seed:tools
```

Давтан ажиллуулахад аюулгүй (`Tool.topic`). Seed нь вэбсайт бүрийг шалгаж, **404/5xx/холболтгүй**
сайтыг логд тэмдэглэнэ; 403/405/429 нь «ботыг хориглов» гэсэн үг тул эвдэрсэнд тооцохгүй
(Cloudflare-ийн ард байгаа сайтууд ингэдэг).

**Umami event:** `tool_view`, `tool_click_out` (`affiliate` талбартай), `tool_upvote`,
`tool_review`, `tool_filter`, `tool_submit`, `tool_versus_view`.

## Моделийн харьцуулалт (/harits)
«GPT-5.1 vs Gemini 4» маягийн хайлт бүр тусдаа хуудас болно. Дүгнэлт нь **хэмжсэн өгөгдлөөс**
гарна — А.3-ын монгол бенчмарк, LMArena Elo, OpenRouter хэрэглээ, үнэ.

**Яагаад `/harits`, `/model/...-vs-...` биш.** Моделийн slug нь `openai/gpt-5.1` хэлбэртэй тул
`/model/openai/gpt-5.1-vs-google/gemini-4` гэвэл catch-all route-той зөрчилдөж, хаяг ч уншигдахгүй.
Тусдаа route: `/harits/<pair>`, `pair = <slugA>--vs--<slugB>`, slug-ийн `/` нь `~` болно.

**Canonical дараалал.** `pairKey` нь хосыг **цагаан толгойн эрэмбээр** бичнэ — ижил хос үргэлж
ижил хаягтай, SEO хуваагдахгүй. Эсрэг дараалалтай хаягийг **middleware 301**-ээр canonical руу
шилжүүлнэ (хуудсыг рендерлэхгүй). Хуудас дотор `permanentRedirect()` хийвэл Next нь **308**
буцаадаг тул middleware-т барьсан.

**OpenRouter-ийн шинэ талбарууд** (`openrouter` алхамд синк болно): `cachedInputPricePerM`
(кэшээс уншсан оролтын хямд тариф), `inputModalities[]` / `outputModalities[]`, `tokenizer`,
`maxOutputTokens`, `isModerated`. `contextLength`, үнэ, `modality`, `releasedAt` нь өмнөх
бүлгүүдээс байсан.

**`/harits/<pair>` хуудас**

| Хэсэг | Юу байна |
|---|---|
| Товч дүгнэлт | 3 өгүүлбэр, LLM бичнэ, `AiModelComparison`-д кэшлэгдэнэ |
| Хүснэгт | MN оноо (ангиллаар accordion), Arena Elo, хэрэглээний байр/токен, context, орох/гарах үнэ, монгол 1000 үгийн үнэ, хурд, оролтын төрөл, гарсан огноо |
| Хэн юунд сонгох вэ | 4 хувилбар (орчуулга/бичих/код/хямд их хэмжээ), **дүрмээр** |
| Холбоотой | «X vs бусад» топ 5, хоёр моделийн хуудас, бенчмарк, заавар |

**«✓ дээр» логик.** `better(a, b, dir)` — их нь дээр эсвэл бага нь дээр. Аль нэгний өгөгдөл
**дутуу (null) эсвэл тэнцсэн** үед тэмдэг тавихгүй: өгөгдөлгүйгээр «дээр» гэж хэлэх нь уншигчийг
мэхлэх болно. Байр, үнэ, хугацаанд бага нь дээр; үнэ `0` нь «үнэгүй» — `null`-тай андуурахгүй.

**«Хэн юунд сонгох вэ» нь LLM биш, дүрэм.** Шалгуур дараалалтай, эхнийх тэнцвэл дараагийнх
шийднэ:

| Хувилбар | Дүрэм |
|---|---|
| Орчуулга | бенчмаркийн орчуулгын 2 ангиллын дундаж → нийт MN оноо |
| Бичих | нийт MN оноо → Arena Elo |
| Код | Arena Elo → context |
| Хямдаар их хэмжээ | монгол 1000 үгийн бодит үнэ → гаралтын тариф |

LLM-ийн дүгнэлтэд эдгээрийг «зөрчихгүй» гэж prompt-д оруулж өгдөг.

**Дүгнэлтийн кэш.** `AiModelComparison(pairKey unique, summaryMn, generatedAt, views)`. **30 хоног**
хуучирвал дахин бичүүлнэ (үнэ, оноо хувирдаг). Дүгнэлтийг **build үед биш, эхний үзэлтэд (lazy)**
бичүүлнэ — build нь LLM-ээс хамааралгүй. LLM унасан бол хуучин дүгнэлтийг харуулна; байхгүй бол
хуудас дүгнэлтгүй ч хүснэгттэйгээ гарна. ISR `revalidate` 1 өдөр.

**`/harits` — «Модель сонгох».** 3 асуулт (юунд / төсөв / монгол хэл чухал уу) → дүрмээр 3 модель.
Төсвөөр шүүнэ (үнэгүй = гаралт $0, хямд = ≤$2/1M), «зураг ойлгох» бол `inputModalities`-д `image`
байхыг шаардана. Шүүлт хэт хатуу бол хоосон хуудас гаргахгүй — шүүлтгүй эрэмбээр гүйцээнэ.
Доор нь хамгийн их үзэгдсэн 10 харьцуулалт.

`/model/<slug>` хуудас бүрд «Харьцуулах» select (хэмжилттэй топ 20 модель) → `/harits` руу.

**Урьдчилан төлөвлөсөн хослолууд.** Топ 10 хэрэглээ + бенчмаркийн топ 5-ын бүх хослол
(`plannedPairs()`) sitemap-д орно. Бенчмаркийн дүн байхгүй үед C(10,2) = 45 хослол; бүтэн
бенчмарктай үед ~60–105.

**SEO:** title «X vs Y — аль нь дээр вэ? (2026)», `ItemList` + `Product`×2 JSON-LD
(`offers` нь гаралтын тариф, `aggregateRating` нь MN оноо; өгөгдөл байхгүй бол огт бичихгүй),
canonical нь цагаан толгойн эрэмбэтэй хаяг.

**Umami event:** `compare_view`, `compare_pick`.

## «Өдрийн баримт» галерей (/barimt)
FB/IG-д тавьдаг картуудыг сайт дээр үзүүлж, хуваалцуулна. **Шинэ контент үүсгэхгүй** — байгаа
`Article.fbImageData`-г ашиглана.

**Хуудсууд**

| Зам | Юу байна |
|---|---|
| `/barimt` | 4:5 картын grid, infinite scroll (cursor, 24-өөр), ангиллын шүүлт, «Долоо хоногийн шилдэг», lightbox |
| `/barimt/<slug>` | нэг картын хуудас. **OG зураг = карт өөрөө (1080×1350)** — FB/IG-д хуваалцахад яг карт preview болно |
| `/barimt/<slug>/embed` | iframe-д зориулсан цэвэр хуудас |
| `/api/barimt?cursor=…` | галерейн дараагийн хуудас (JSON) |

Nav-д «Баримт», нүүрэнд «Өдрийн баримт» 3 картын хэвтээ зурвас, нийтлэлийн хуудсанд
«Энэ мэдээний карт» + хуваалцах.

**Cursor pagination, offset биш.** Cursor нь `(fbImageAt, id)`. Offset нь шинэ карт нэмэгдэхэд
хуудас гулсаж давхардал/цоорхой үүсгэдэг. `PAGE_SIZE + 1` мөр уншиж, илүү нь байвал дараагийн
cursor гаргана — «дараагийн хуудас байгаа эсэх»-ийг тусдаа `count` query-гүйгээр мэднэ.
Танигдахгүй cursor нь эхний хуудсыг буцаана (хоосон хуудас гаргахгүй).

**Хуваалцах.** Facebook, X, Telegram, Messenger — бүгд нийтийн share dialog, нэвтрэх шаардлагагүй.
Messenger нь `FB_APP_ID` шаарддаг тул тохируулаагүй бол **харагдахгүй** (`sharePlatforms`).
Мөн «Зураг татах», «Зураг хуулах» (clipboard, дэмждэггүй хөтөч дээр «Татаж авна уу» болно),
«Embed код».

**«Долоо хоногийн шилдэг».** `fbLikes + fbShares × 3` (share нь хүн өөрийн хуудсанд тавьсан
гэсэн хүчтэй дохио). FB-ийн тоо 0 бол **картын татсан тоо** (`cardCopies`) хэрэглэгдэнэ.
Оноогүй карт жагсаалтад орохгүй — хоосон блок гаргахгүй.

```bash
npm run fb:stats   # FB reaction/share синк (pipeline-д fbstats алхам, өдөрт 1 удаа)
```

`FB_PAGE_ACCESS_TOKEN` тохируулаагүй бол чимээгүй алгасна — галерей нь татсан тоогоор эрэмбэлэгдэнэ.
Graph-ийн хариунд `error` байвал тоолуурыг **0 болгож дарж бичихгүй** (`parseStats` → `null`) —
эс тэгвээс бодит өгөгдөл алдагдана.

**Embed нь route handler (page биш).** `/barimt/<slug>/embed` нь бэлэн HTML буцаана —
сайтын layout, nav, аналитикийн скрипт орохгүй. Бусад сайтын хуудсанд ажиллах тул:

- `<script>`, inline handler **огт байхгүй**; гарчгийг `esc()`-ээр escape хийнэ.
- CSP: `script-src 'none'`, `frame-ancestors *`, `form-action 'none'`, `base-uri 'none'`.
- `X-Frame-Options` **тавихгүй** — тавивал `frame-ancestors`-ыг дарж embed-ыг хаана.
- `X-Robots-Tag: noindex` — embed хуудас хайлтад орохгүй.

**Хуучин нийтлэлүүдэд карт нөхөх**

```bash
npm run backfill:cards               # сүүлийн 30 карттгүй PUBLISHED нийтлэлд
npm run backfill:cards -- --limit 5
npm run backfill:cards -- --dry      # юу хийхээ л хэвлэнэ
```

Суурь зураг (`heroImageData`) байвал **зөвхөн текст давхарлана** — LLM, зургийн зардал гарахгүй.
Байхгүй бол шинээр (~$0.04/ширхэг). Идемпотент: `fbImageAt` байгаа нийтлэл дараалалд орохгүй.
Өдрийн зургийн квотоос (`FB_IMAGE_DAILY_LIMIT`) **хамааралгүй** — энэ нь нэг удаагийн нөхөн
ажил, автомат pipeline биш.

**SEO:** `ImageObject` JSON-LD (`contentUrl` нь карт, `associatedArticle` нь мэдээ, 1080×1350),
sitemap-д карт бүр, `/barimt` статик хуудас.

**Umami event:** `card_view`, `card_share_facebook` / `_x` / `_telegram` / `_messenger`,
`card_download`, `card_embed_copy`, `card_filter`.

## Монголын AI мэдээ (/mongol)
Дотоодын AI/технологийн мэдээ — сайтын хамгийн том цоорхой байсан. Агуулга нь автомат
(шүүлт + товчлол) ба гараар (төслүүдийн жагсаалт, гар аргаар мэдээ нэмэх) хоёулаа.

**region.** `Source.region` ба `Article.region` (`MN` | `GLOBAL`). Бүх хуучин эх сурвалж
`GLOBAL` хэвээр. `Article.region`/`isLocal` нь эх сурвалжаас **удамшина** — RSS ба HTML
fetcher хоёулаа бичнэ. Ангилалд `MONGOL` нэмээгүй — region-оор ялгана.

**Эх сурвалжууд** (2026-09-26-нд тус бүрд RSS байгаа эсэхийг шалгасан)

| Эх сурвалж | Арга | Тайлбар |
|---|---|---|
| ITOIM | RSS `/rss.xml` | технологи, медиад тусгайлсан → жин 8 |
| iKon.mn | RSS `/rss` | ерөнхий мэдээ, шүүлт хийгдэнэ |
| Eguur.mn | RSS `/feed/` | ерөнхий мэдээ |
| News.mn | HTML `article a` | RSS байхгүй (`/feed/` нь HTML буцаана) |
| Unread.today | HTML `h3 a` | бизнес, технологийн тойм |
| UB Life | HTML `article a` | ерөнхий мэдээ |
| МУИС | HTML `article a` | `/news` |
| Gogo.mn, Zindaa.mn | — | жагсаалт JS-ээр зурагддаг → идэвхгүй |
| МОНЦАМЭ | — | бот бүрд **403** → идэвхгүй |
| ШУТИС, ХХЗХ | — | static HTML-д холбоос гарахгүй → идэвхгүй |

Идэвхгүй болгосон шалтгаан бүр `sources.seed.ts`-д комментоор бичигдсэн (тест шалгадаг).

**HTML fetcher** (`src/fetchers/html.ts`) — RSS-гүй сайтад: `Source.listUrl` +
`Source.linkSelector` (CSS). `linkedom`-оор задалж, **ижил хостын** холбоосуудыг л авна,
fragment/давхардлыг шүүнэ, гарчиг 10 тэмдэгтээс богиныг хасна. Эх сурвалж бүрийг
**24 цагт нэг удаа** (`dueForFetch`), хүсэлт хооронд 1.5с завсар.
**robots.txt-г хүндэтгэнэ**: бидний нэрийн (`AINewsBot`) блок байвал түүнийг, эс тэгвээс
`*`-ийнхийг авна (стандартын дагуу хоёуланг нэмэхгүй). User-Agent:
`AINewsBot/1.0 (+https://ai-news.mn)`.

```bash
npm run fetch:html                            # бүх listUrl-тай эх сурвалж
npx tsx src/fetchers/html.ts --test <sourceId> # зөвхөн холбоосуудыг хэвлэнэ
```

**Түлхүүр үгийн шүүлт** (`src/mongol/filter.api.ts`). Дотоодын сайтууд ерөнхий мэдээний
сайт — спорт, улс төр, гэмт хэрэг бүгд ирнэ. LLM-ээр бүгдийг үнэлбэл зардал олон дахин
өснө. Тиймээс:

- **Гарчиг** дээр ямар нэг түлхүүр үг таарвал → давна (гарчиг нь редакцийн дохио).
- Зөвхөн **биед** таарсан бол: **хүчтэй** үг 1, эсвэл **сул** үг 2+ шаардана.

Хүчтэй = хиймэл оюун, робот, чатбот, стартап, кибер халдлага… Сул = технологи, дата,
дижитал, ухаалаг, апп… Энэ хуваалт бодит өгөгдлөөс гарсан: биед «технологи» дангаараа
таарах нь УИХ, эрүүл мэнд, барилгын мэдээнд ч байдаг. Практикт iKon.mn-ийн 30 мэдээнээс
**28 нь шүүгдэж** 2 үлдсэн.

Кирилл үсэгт `\b` ажиллахгүй тул үгийн хилийг зай/цэг таслалаар шалгана (`matches`), мөн
залгавартай хэлбэрийг барина (`stemMatches`: «дижитал» → «дижиталжуулалтын»). Богино
латин үгэнд (ai, gpt) stem хэрэглэхгүй — «airport», «gptest» хуурамч дохио болно.

**Товчлол, иш татах.** Дотоодын нийтлэл нь **монгол** хэл дээр байна — орчуулах биш
**товчлон найруулна** (`LOCAL_SYSTEM`). Гол шалгуур: **эх сурвалжийн хэвлэлийн нэр биед
заавал дурдагдана** («ikon.mn-ийн мэдээлснээр…»). Дотоодын хэвлэлийг иш татах нь ёс зүйн
шаардлага бөгөөд харилцааны хөрөнгө. `checkLocal` нь `mentionsSource`-оор шалгаж, давахгүй
бол нэг удаа дахин бичүүлнэ.

**Квот.** Дотоод мэдээ **ерөнхий 3-ын ДЭЭР** тусдаа квоттой: `DAILY_LOCAL_LIMIT` (анхдагч
**1**) → нийт 4. `publishedToday` нь `isLocal: false` гэж тоолдог болсон — эс тэгвээс
Монголын нэг мэдээ дэлхийн нэг мэдээг хөөнө. Дотоод мэдээ **FB slot-д орохгүй**
(`pickForSlot`/`pickForPrepare` нь `isLocal: false`), зөвхөн `/mongol` ба нүүрэнд гарна.
Оноо **6+** бол нийтэлнэ (`LOCAL_MIN_SCORE`) — дэлхийн мэдээнээс доогуур, учир нь
Монголын AI мэдээ өөрөө хомс.

**Pipeline-ийн шинэ алхмууд:** `html` (RSS-гүй сайтууд), `local` (өдөрт нэг удаа дотоод
мэдээ нийтлэх). `/admin`-аас ч дуудаж болно.

**Хуудсууд:** `/mongol` («Монголд юу болж байна» — төслүүдийн жагсаалт + дотоод мэдээ),
нүүрэнд «Монголд» блок (сүүлийн 3), nav-д «Монгол», `/admin/mongol` (эх сурвалж удирдах +
«Татаж үзэх» товч, MongolProject CRUD, гараар мэдээ нэмэх).

**MongolProject** — гараар хөтөлдөг жагсаалт. **LLM-ээр таамаглахгүй**: байхгүй компанийн
нэр зохиох эрсдэлтэй. Seed нь зөвхөн 5 баталгаажсан төсөл, вэбсайт бүрийг **HTTP-ээр
шалгаж** 200 биш бол оруулахгүй.

```bash
npm run seed:mongol                  # 5 төсөл (хаяг шалгана)
npm run seed:mongol -- --no-check    # шалгахгүй
```

Долоо хоногийн digest-д «Монголд» хэсэг нэмэгдсэн (`localSection`) — дотоод мэдээ байхгүй
бол хэсэг огт гарахгүй.

**Umami event:** `mongol_view`.

## «Надад ямар AI тохирох вэ?» асуулга (/songolt)
FB-д хуваалцагдах, шинэ хэрэглэгч татах интерактив хуудас. 5 асуулт → 3 санал.

**Дүгнэлт нь дүрмээр, LLM биш.** Шалтгаан: хурдан (хүлээлтгүй), **тогтвортой** (ижил
хариултад үргэлж ижил үр дүн — хуваалцахад чухал), үнэгүй.

| Асуулт | Сонголт |
|---|---|
| 1. Юунд ашиглах вэ | бичих / орчуулах / сурах / код / зураг-видео / бизнес-маркетинг / ярилцах (олон, дээд тал 3) |
| 2. Та хэн бэ | оюутан / оффисын ажилтан / бизнес эрхлэгч / багш / эцэг эх / хөгжүүлэгч |
| 3. Төсөв | үнэгүй л / сард $10 хүртэл / хамаагүй |
| 4. Монгол хэл | бараг бүгд / тал хувь / бага |
| 5. Төхөөрөмж | утас / компьютер / хоёулаа |

Асуулга бүхэлдээ **клиент дээр** явна — сервер рүү зөвхөн эхлэхэд ба дуусахад л хандана.

**Оноо** (`src/songolt/score.api.ts`, цэвэр функц):

| Шалгуур | Оноо |
|---|---|
| Ангилал таарах | +3 × (таарсан ангиллын тоо, даалгаврын тоогоор хязгаарлагдана) |
| Монгол дэмжлэг | GOOD +2 / PARTIAL +1, «бараг бүгд монголоор» бол **×2** |
| Төсөв таарах | +2 |
| Платформ таарах | +1 |
| Бенчмаркийн MN оноо | оноо/10 × 2 (байхгүй бол 0 — шийтгэл биш) |
| Алдартай (upvote+товшилт ≥5) | +1 |

**Ангилал огт таараагүй хэрэгсэл огт орохгүй** — «алдартай» гэдгээр л дээр гарч ирвэл
хариулт утгагүй болно. Тэнцвэл нэрээр эрэмбэлж тогтвортой байлгана.

Бенчмарк нь **моделиудыг** (`openai/gpt-5.1`) хэмждэг, каталог нь **бүтээгдэхүүнийг**
(ChatGPT). Тиймээс `TOOL_VENDOR`-оор нийлүүлэгчид холбож, тухайн компанийн хамгийн өндөр
MN оноог авна — зөвхөн модель нь тодорхой мэдэгдэх хэрэгслүүдэд.

**Код.** Хариулт 16 бит + 4 бит хувилбар + 8 бит шалгах нийлбэр = 28 бит → **base64url
5 тэмдэгт**. Шалгах нийлбэр нь гараар зохиосон кодыг барина (500 санамсаргүй кодоос
30-аас цөөн нь давдгийг тест шалгадаг). Ижил хариулт → ижил код → ижил үр дүн.

**Үр дүнгийн хуудас** `/songolt/<code>`: #1 том карт (2 өгүүлбэрийн шалтгаан template-ээр,
зөвхөн баталгаатай өгөгдлөөс), #2/#3 жижиг, тус бүрд «Каталогт үзэх» / «Заавар» / «Prompt»
(tools-оор холбогдоно, байхгүй бол товч гарахгүй). «Facebook-т хуваалцах», «Холбоос хуулах»,
«Дахин эхлэх». ISR 1 өдөр.

**OG зураг** `/api/og/songolt?code=…` — 1200×630, `next/og`. «Надад тохирох AI: ChatGPT»
гэсэн брэндийн карт. Хүчингүй код → 404.

**Нэвтэрсэн хэрэглэгч.** Үр дүнгээс `UserPreference.categories`-ыг автоматаар бөглөнө →
нүүрний «Таны сонирхол» блок шууд ажиллана. **Аль хэдийн тохируулсан бол дарж бичихгүй** —
хэрэглэгчийн сонголт давуу.

**CTA:** нүүрний hero-гийн доор, `/hereglel` ба `/zaavar` дээр жижиг. **Nav-д биш** —
асуулга нь нэг удаагийн үйлдэл, байнгын цэс биш.

**Статистик** `/admin/songolt`: эхэлсэн/дууссан тоо, дуусгалтын хувь (`QuizDaily`),
хамгийн их **#1 байрт** санал болгогдсон хэрэгсэл (`QuizResult`), сүүлийн 14 хоногийн
хүснэгт. Алхам тус бүрийн уналтыг Umami-гаас.

**Umami event:** `quiz_start`, `quiz_step_1`…`quiz_step_5`, `quiz_finish` (tool),
`quiz_share` (platform, tool).

## SEO, аюулгүй байдал, хяналт

### Сайтын хаяг — нэг эх сурвалж

`src/lib/site.ts` нь `SITE_URL`-ийг уншдаг **цорын ганц** модуль:

| Функц | Хаана |
|---|---|
| `siteUrl()` | canonical, OG, sitemap, RSS, FB/IG постын холбоос |
| `absUrl(path)` | RSS, имэйл — харьцангуй замыг үнэмлэхүй болгоно |
| `siteHost()` | картын хөл, имэйлийн `from`, embed |
| `userAgent()` | RSS/HTML татагчийн `User-Agent` |
| `oldHosts()` / `isOldHost()` | middleware дэх 301 — [Домэйн солих](#домэйн-солих) |
| `socialLinks()` / `sameAs()` | хөлийн FB/IG холбоос, Organization схем |

Шалгах: `grep -rn "railway.app\|ainews.mn" src/ --include="*.ts" --include="*.tsx"` → 0.

### Схемийн өгөгдөл (JSON-LD)

`src/lib/jsonld.api.ts` — цэвэр функцууд, `<JsonLd>`/`<BreadcrumbLd>` компонентоор рендерлэнэ:

- **Organization** + **WebSite** (SearchAction → `/hailt?q=`) — layout-д, бүх хуудсанд
- **BreadcrumbList** — бүх дэд хуудсанд («Нүүр ›» автоматаар нэмэгдэнэ)
- **NewsArticle** — нийтлэлд (author/publisher = Organization, `citation` = эх сурвалж)
- Хэсэг тус бүрийн схемүүд хэвээр: `HowTo`+`FAQPage` (заавар), `SoftwareApplication`
  (хэрэгсэл), `CreativeWork` (prompt), `ImageObject` (карт), `ItemList` (харьцуулалт),
  `Dataset`+`Table` (бенчмарк)

### `npm run audit:seo`

Ажиллаж буй сайтын **бүх** хуудсыг татаж, metadata дутуу газрыг жагсаана.
Route-уудыг build-ийн manifest-ээс, динамик хаягийн жишээг sitemap-аас авна (DB-д хандахгүй).

```bash
npm run build && npx next start -p 3099 &
npm run audit:seo -- --base=http://localhost:3099
npm run audit:seo -- --base=https://ainews.mn --json > seo.json
```

Шалгадаг зүйл: `title`, `description` (урт), `canonical`, `og:title/description/image`,
`twitter:card`, `<html lang>`, `h1` тоо, JSON-LD задарч байгаа эсэх. Нэвтрэлт, хайлтын
хуудсуудад canonical шаардахгүй ч `noindex` шаардана. Дутуу зүйл байвал exit code 1.

### RSS

| Хаяг | Агуулга |
|---|---|
| `/feed.xml` | мэдээ + заавар, 40 бичлэг |
| `/feed/mongol.xml` | зөвхөн Монголын AI мэдээ |

`src/lib/rss.api.ts` — цэвэр RSS 2.0 үүсгэгч (RFC-822 огноо, XML escape, `atom:link rel=self`).
Хоёулаа `force-dynamic` + `Cache-Control` — `SITE_URL` нь build-д шатахгүй.

### Аюулгүй байдлын header-ууд

`src/lib/headers.ts` → middleware бүх хариунд тавина:

| Header | Утга |
|---|---|
| `Content-Security-Policy-Report-Only` | `CSP_ENFORCE=true` бол хатуу горимд шилжинэ |
| `Strict-Transport-Security` | зөвхөн `SITE_URL` нь https үед (локалд хөтөч гацахаас сэргийлнэ) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, microphone, geolocation, payment, usb — бүгд хаалттай |

`/barimt/<slug>/embed` нь өөрийн CSP-тэй (`frame-ancestors *`) — middleware дарж бичихгүй.

### Хязгаарлалт ба шалгалт

- **`/api/*`** — нэг IP минутад **60** хүсэлт (`src/lib/ratelimit.api.ts`). Зураг, OG,
  health, auth нь чөлөөтэй (тэднийг Facebook, Google, Railway-ийн сервер олноор дууддаг).
- **Server action-ууд** — [zod](https://zod.dev) схемээр (`src/lib/validate.ts`).
  Server action бүр нээлттэй endpoint тул UI-д ямар талбар байгаагаас үл хамааран
  сервер тал өөрөө шалгана: `cuid`, `slug`, `internalPath` (`revalidatePath`-д очих зам
  задарсан хаяг байж болохгүй), нууц үгийн дээд урт (bcrypt-ийн CPU-г хамгаална).
- **`/api/health`** — DB ping (ms), RAW дараалал, бэлэн DRAFT, алдааны тоо, сүүлийн
  cron ажиллалт хэдэн минутын өмнө байсан. DB унавал **503** → Railway дахин эхлүүлнэ.

### Алдааны бүртгэл — `/admin/aldaa`

`src/instrumentation.ts` (`onRequestError`) нь server component, route handler, server
action дотор гарсан барьж аваагүй алдаа бүрийг `AppError` хүснэгтэд бичнэ. Ижил алдааг
шинэ мөр болгохгүй — `fingerprint` (эх сурвалж + зам + нормчилсон мессеж) нийлүүлж
`count`-ыг нэмнэ. `/admin/aldaa` дээр сүүлийн 50-г stack-тай нь харна.

> `instrumentation.ts` нь Node **ба** Edge хоёуланд bundle хийгддэг тул Prisma-г ЭНДЭЭС
> импортлож болохгүй. Тиймээс `src/lib/errors.ts` өөрийгөө `globalThis` дээр бүртгэдэг.

### Фонт

Roboto-г кирилл + латин + тэмдэгтээр subset хийсэн (124 KB TTF → 41 KB woff2),
`src/app/fonts.ts` → `next/font/local`. Хоёр тохиргоо зориуд:

- **`display: "optional"`** — фонт ~100 мс дотор бэлэн биш бол хөтөч системийн
  фонтоор үлдээнэ. `swap` нь фонт ирэхэд текстийг дахин зурдаг бөгөөд тэр зураас нь
  шинэ LCP нэр дэвшигч болдог.
- **`preload: false`** — `next/font` анхдагчаар `<link rel=preload>` нэмдэг. Гар утасны
  удаан сүлжээнд 2 × 42 KB нь LCP-ийн замтай зурвасын төлөө өрсөлдөж **+1 с** нэмж
  байсан (Lighthouse mobile: 2.5 с → 1.8 с болов).

Үр дүн: **анх орж ирсэн хүн системийн фонтоор**, хоёр дахь хуудаснаас (фонт кэшлэгдсэн)
Roboto-гоор уншина. LCP-г фонтын гоо сайхнаас чухалд тооцсон шийдэл — эсрэгээр нь
хүсвэл `preload: false`-ыг хасахад л болно.

### Кэш

DB-ийн унших query-ууд процессийн доторх TTL кэштэй (`src/lib/cache.api.ts`):

| Хэсэг | Хугацаа |
|---|---|
| Нүүр хуудсанд гарах өгөгдөл | 5 мин |
| Мэдээ | 1 мин |
| Жагсаалт, каталог, харьцуулалт, бенчмарк | 1 цаг |
| Заавар | 1 өдөр |

Next-ийн `unstable_cache` биш: тэр нь утгыг JSON болгодог тул `Date` талбарууд мөр болж
эргэж ирнэ. Редактор «нийтлэх» дархад `src/lib/revalidate.ts` нь Next-ийн route кэш ба
энэ кэш хоёуланг нь цэвэрлэдэг тул өөрчлөлт шууд гарна.

### Долоо хоногийн админ тайлан

```bash
npm run report:weekly -- --dry    # зөвхөн хэвлэнэ
npm run report:weekly             # ADMIN_EMAIL рүү илгээнэ
```

Ням гарагт pipeline автоматаар илгээнэ (digest-тэй ижил өдөр). Агуулга: контент,
FB/IG, хэрэглэгч, хайлт, LLM зардал — бүгд өмнөх долоо хоногтой харьцуулсан хувьтай,
дээр нь «анхаарах» блок (нийтлэл гараагүй, ажиллалт унасан, хүлээгдэж буй илгээлт, алдаа).

## Брэнд
Нэр: **AI News**. Тэмдэг нь өсөх багана + дээш заасан сум, өнгө `--color-accent` (`#4f46e5`).

| Файл | Юу вэ |
|---|---|
| `src/components/Logo.tsx` | `<LogoMark size={32} />` ба `<Logo />` — inline SVG, сэдвийн өнгийг дагана |
| `src/app/icon.svg` | favicon. CSS хувьсагч ажиллахгүй тул өнгө нь тогтмол `#4f46e5` |
| `src/app/apple-icon.png` | 180×180 |
| `src/app/opengraph-image.png` | 1200×630, `#f7f6f2` дэвсгэр дээр тэмдэг + нэр |
| `src/app/manifest.ts` | PWA manifest |

PNG-үүдийг дахин үүсгэх:
```bash
npx tsx scripts/brand.ts
```
`public/brand/` дотор `mark.png` (эсвэл `logo-mark.png`, `icon.png`) байвал түүнээс, байхгүй бол
`icon.svg`-тэй ижил SVG-ээс зурна. Үр дүнг git-д commit хийнэ — build үед дахин үүсгэдэггүй.

## Хэрэглээ — «Ямар ажилд аль AI?»
AI-г сайн мэдэхгүй хүнд зориулсан хэсэг: хийх ажлаа сонгоод тохирох хэрэгслүүдийг харна.
Өгөгдөл нь **хүний бэлтгэсэн** — agent биш — `/admin/hereglee` дээрээс засна.

```bash
npm run db:seed:usecases   # эхний өгөгдөл. Байгаа мөрийг дарж бичихгүй, зөвхөн шинийг нэмнэ
```

- `/hereglee` — 13 ангилал (карт: дүрс, нэр, тайлбар, топ 3 хэрэгсэл)
- `/hereglee/<slug>` — хэрэгслүүд эрэмбээрээ: #, нэр, гаргагч, тайлбар, тэмдэглэл,
  үнийн шошго (Үнэгүй / Үнэгүй + төлбөртэй / Төлбөртэй), «монголоор ажилладаг» шошго, «Нээх →».
  Доор нь тухайн ангиллын slug эсвэл нэрийг шошгондоо агуулсан нийтлэгдсэн мэдээ.
- Нүүр хуудсанд «AI-г юунд ашиглах вэ?» блок (эхний 6 ангилал), nav-д «Хэрэглээ».

Загвар: `UseCase` (ангилал) ↔ `UseCaseTool` (эрэмбэ + тухайн ангилалд хамаарах тэмдэглэл) ↔ `AiTool`
(хэрэгсэл — олон ангилалд орж болно). Дүрс нь `lucide-react`-ийн нэр, `src/components/UseCaseIcon.tsx`
дотор гараар буулгасан (бүх сангаа bundle-д оруулахгүйн тулд).

> «Монголоор ажилладаг» тэмдэг нь **редакторын үнэлгээ** — тухайн хэрэгсэл монгол хэлээр асуухад
> ойлгож, монголоор хариулдаг эсэх. Хэрэгслүүдийн чанар байнга өөрчлөгддөг тул хуудсан дээр
> «өөрөө туршиж үзэхийг зөвлөе» гэж бичсэн.

### /admin/hereglee
Ангилал бүр задардаг: нэр/тайлбар/дараалал/идэвх засах, хэрэгслийн эрэмбэ/тэмдэглэл/идэвх засах,
ангиллаас салгах, байгаа хэрэгслийг холбох, шинэ хэрэгсэл үүсгэж шууд холбох. Хадгалахад нүүр,
`/hereglee`, тухайн ангиллын хуудас шинэчлэгдэнэ.

## Чанарын жагсаалт — LMArena Elo
OpenRouter-ийн жагсаалт «аль AI-г хамгийн их ашигладаг вэ» гэдгийг хэлдэг ч «аль нь хамгийн сайн вэ»
гэдгийг хэлдэггүй. Хоёр дахь эх сурвалж нь **LMArena** (lmarena.ai)-гийн Elo — хүмүүсийн сохор
харьцуулалтаас гарсан оноо.

```bash
npm run fetch:arena                   # эсвэл npm run pipeline -- --only arena
```

**Эх сурвалж:** HuggingFace-ийн албан ёсны `lmarena-ai/leaderboard-dataset` дата, datasets-server-ийн
JSON API (`text/latest` split). Тэр split-ийн эхний мөрүүд нь «overall» ангилал, байраараа
эрэмбэлэгдсэн байдаг тул нэг хүсэлтээр топ 100-г авна — Playwright-аар хуудас уншиж scrape хийх
шаардлагагүй.

Өгөгдөл `RankingSnapshot`-д `source = ARENA_ELO`-оор хадгалагдана (`score` = Elo, `rank` = байр).
Шинэ хүснэгт нэмээгүй — `RankSource` enum-д `ARENA_ELO` анхнаасаа байсан тул **migration хэрэггүй**.

Анхаарах:
- Arena нэг моделийн хувилбаруудыг (`-high`, `-max`) тусад нь жагсаадаг. Бид нэг модель болгон
  нэгтгэж, хамгийн өндөр Elo-г авна. Тиймээс харагдах байр нь Arena-гийн өөрийнх нь байр биш,
  **манай таарсан багц доторх байр**.
- Каталогт (`AiModel`) байхгүй Arena модель бүрт `arenaOnly: true` мөр үүснэ. Ийм модель
  **чанарын жагсаалт, нүүрний «Чанар» toggle, `/model/<slug>`-д бүрэн харагдана**, харин
  **хэрэглээний жагсаалтад хэзээ ч орохгүй** (`leaderboardWhere()`, `src/queries/rank-filter.ts`).
  Моделийн хуудсан дээр «зөвхөн LMArena-д байдаг» гэсэн тэмдэглэл гарна.
  Slug нь normalize хийсэн Arena нэр (`qwen3.5-max` → `qwen35`), компанийг Arena-гийн
  `organization`-оос авч, байхгүй бол үүсгэнэ.
- OpenRouter-т байгаа моделийг давхардуулж үүсгэхгүйн тулд `src/data/model-aliases.ts`-д
  `MODEL_ALIASES` (нэр) ба `COMPANY_ALIASES` (компани: `xai` → `x-ai`) хоёрыг бөглөнө.
  Шинээр үүссэн моделиудыг лог дээр хэвлэдэг — давхардсан бол alias нэмээд
  `AiModel`-оос устгана.
- LMArena долоо хоног тутам нийтэлдэг тул өөрчлөлтийг «өмнөх өдөр» биш **хамгийн сүүлийн өмнөх
  нийтлэлтэй** харьцуулж тооцно. Эхний удаа ажиллуулахад бүх мөр «шинэ» гэж гарна; моделийн
  хуудасны графикт Arena мөр хоёр дахь нийтлэлээс хойш гарч ирнэ.

**UI:** `/jagsaalt` болон нүүр хуудсан дээр «Хэрэглээ | Чанар» таб (`?tab=chanar`), шүүлтүүр хоёуланд
ижил ажиллана. Моделийн хуудсанд график дээр хоёр дахь (тасархай) мөр + legend. Ишлэлийг хоёуланг нь
зэрэгцүүлж харуулна. Эх сурвалжийн тайлбар (OpenRouter, LMArena) `/jagsaalt`-ын доод талд нэг мөрөөр байна.

## Долоо хоногийн тойм (digest)
7 хоногийн нийтлэгдсэн мэдээг нэг урт нийтлэл болгож нэгтгэнэ — Facebook-д хуваалцахад
хамгийн тохиромжтой формат.

```bash
npm run agent:digest              # DRAFT болгож үлдээнэ (хянаад гараар нийтэлнэ)
npm run agent:digest -- --publish # шууд нийтэлнэ
npm run pipeline -- --only digest # pipeline-аар (зөвхөн Ням гарагт ажиллана)
```

Digest бол ердийн `Article` — `kind = DIGEST` төдий. Slug, DRAFT→PUBLISHED урсгал,
`/medee/<slug>` хуудас бүгд адилхан ажиллана. Дотор нь орсон мэдээнүүд `DigestItem`-ээр холбогдоно.

**Агуулга:** LLM нь зөвхөн lead ба сэдэвчилсэн хэсгүүдийг бичнэ (мэдээ бүрийг
`/medee/<slug>` холбоосоор дурдана). **«Жагсаалтын өөрчлөлт» хэсгийг LLM бичихгүй** —
`RankingSnapshot`-оос шууд тооцно (топ 10-д орсон/гарсан, хамгийн их өссөн/унасан, Arena-д
шинээр орсон), тиймээс тоо нь баталгаатай. Төгсгөлд «Энэ digest-д орсон мэдээ» жагсаалт автоматаар
нэмэгдэнэ.

Долоо хоногт **3-аас цөөн** мэдээ нийтлэгдсэн бол digest үүсгэхгүй, лог бичээд гарна.
Pipeline дээр зөвхөн **Ням гарагт (UTC)** ажиллана — бусад өдөр «Ням гараг биш, алгасав».

**UI:** `/medee` жагсаалтад «Долоо хоног» шошготой, нүүр хуудсан дээр сүүлийн тойм том карт болж
«Сүүлийн мэдээ»-ийн дээр гарна. Тоймын хуудсан дээр «Facebook-д хуваалцах» товч.

### og:image
`/api/og/<slug>` — гарчиг, огноо, AI News лого бүхий 1200×630 зураг (`next/og`). Кирилл үсэг
нэмэлт фонтгүйгээр зурагддаг. Мэдээ, тойм хоёуланд нь ажиллана; `SITE_URL`-ээр үнэмлэхүй хаяг
болгон `og:image`, `twitter:image`-д тавина.

## Хайлт
Postgres-ийн өөрийн full-text search — нэмэлт сан, гадаад сервисгүй.

**Индекс.** `Article`, `AiModel`, `AiTool`, `UseCase` бүрд `searchVector` багана
(`GENERATED ALWAYS AS ... STORED`, GIN индекстэй) — өгөгдөл өөрчлөгдөхөд Postgres өөрөө шинэчилнэ,
тусдаа ажиллуулах юмгүй. Тохиргоо нь **`'simple'`**: монгол кирилл үсэгт stemmer байхгүй тул
үгийг хэвээр нь индекслэнэ. `unaccent` нь латин үсгийн аягийг арилгана (`Café` → `Cafe`).

Жин: гарчиг **A**, хураангуй/гаргагч **B**, бие/тайлбар **C**.

Хоёр нарийн зүйл:
- `unaccent()` нь `STABLE` учир generated column-д шууд орохгүй. Толь бичиг нь өөрчлөгддөггүй тул
  `immutable_unaccent()` гэсэн `IMMUTABLE` боодол хийсэн (баримтжуулсан стандарт арга).
- `to_tsvector('simple','anthropic/claude-opus-5')` нь **нэг токен** болдог тул моделийн slug-ийн
  `/` ба `-`-ийг зайгаар сольж индекслэнэ — ингэснээр «anthropic» гэж хайхад Claude-ууд олдоно.

**Query.** `buildTsQuery()` бүх үгийг `&`-аар холбож, сүүлийн үгэнд `:*` залгана
(«gem» → Gemini). tsquery-гийн операторуудыг хасдаг тул хэрэглэгч юу ч бичсэн алдаа гарахгүй.
2 тэмдэгтээс богино query — хоосон.

Хэрэгслийг өөрийнх нь нэр/тайлбараас гадна **харьяалагдах ангиллынх нь нэрээр** олдог болгосон
(«код бичих» → тэр ангиллын бүх хэрэгсэл).

**API.** `GET /api/search?q=…` → `{ articles, models, tools, total }`,
`Cache-Control: public, max-age=60`. 300мс-ээс удвал логд анхааруулга бичнэ.

**UI.** Толгой хэсгийн хайлтын товч (эсвэл `Ctrl`/`⌘`+`K`) → modal: 200мс debounce, гурван бүлэг,
`↑ ↓ Enter Esc`, гар утсан дээр бүтэн дэлгэц. `/hailt?q=` хуудсанд бүтэн үр дүн,
`ts_headline`-аар тааралт тодруулсан, юу ч олдоогүй бол сүүлийн 3 мэдээ санал болгоно.

**Аналитик.** Хайлт бүрийг `SearchLog`-д (`q`, `resultCount`, `createdAt`) бичнэ — юу хайгдаж
байгааг харахад. Хувийн мэдээлэл хадгалахгүй.

> `npm test` дэх хайлтын интеграцийн тест `DATABASE_URL` байвал ажиллана, үгүй бол алгасна.

## Newsletter
Долоо хоногийн тоймыг имэйлээр илгээнэ. **Double opt-in** — бүртгүүлэхэд баталгаажуулах захиа очиж,
холбоос дарсны дараа л `ACTIVE` болно.

```bash
npm run newsletter:send                      # сүүлийн digest-ийг ACTIVE бүгдэд
npm run newsletter:send -- --dry-run         # хэнд явахыг л хэвлэнэ, илгээхгүй
npm run newsletter:send -- --test=me@mail.mn # зөвхөн тэр хаяг руу (бүртгэл үлдээхгүй)
npm run pipeline -- --only newsletter        # зөвхөн Ням гарагт ажиллана
```

`.env`: `RESEND_API_KEY`, `NEWSLETTER_FROM` (default `AI News <noreply@ainews.mn>`),
`NEWSLETTER_REPLY_TO`. **`RESEND_API_KEY` хоосон бол илгээх алхам алдаа заахгүй, логд бичээд
алгасна** — хөгжүүлэлтийн үед баталгаажуулах холбоос лог дээр хэвлэгдэнэ.

Нэг digest **хоёр удаа илгээгдэхгүй** (`NewsletterSend.digestArticleId` нь unique).
Resend-ийн batch API-аар нэг дуудлагад 100 хаяг.

**Имэйл.** React Email биш — inline-CSS HTML (имэйл клиентүүд гадаад CSS-ийг хасдаг) + текст
хувилбар. Лого, гарчиг, lead, тоймын 4 хүртэл сэдэв (гарчиг + эхний догол мөр), «Бүтнээр унших →»
товч, доод талд **unsubscribe холбоос заавал**. «Жагсаалтын өөрчлөлт», «Энэ digest-д орсон мэдээ»
хэсгүүдийг имэйлд оруулахгүй — сайт дээр уншина.

**Хамгаалалт.** Имэйлийг `zod`-оор шалгана. Нэг IP цагт 5 удаа (in-memory). Бүртгэлтэй имэйл
дахин бүртгүүлэхэд **алдаа заахгүй** — «холбоос дахин илгээлээ» гэж хариулна (аль хаяг бүртгэлтэй
болохыг гадуур мэдэхээс сэргийлнэ).

**Хуудсууд.** Нүүр ба нийтлэл бүрийн төгсгөлд бүртгэлийн блок. `/newsletter/batalgaajlaa`,
`/newsletter/hasagdlaa`. `/admin/newsletter` дээр тоо, илгээлтийн түүх, «Тест илгээх», CSV татах.

## Analytics (Umami)

Self-hosted [Umami](https://umami.is) — cookie-гүй, хувийн мэдээлэл цуглуулдаггүй, өгөгдөл нь
өөрсдийн Postgres дээр үлддэг. Railway дээр **тусдаа service** болж ажиллана.

### Railway дээр umami service үүсгэх

1. Төслийн доторх **New → Docker Image** → `ghcr.io/umami-software/umami:postgresql-latest`
2. Variables:

   | Хувьсагч | Утга |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — одоогийн Postgres-ээ хуваалцана (Umami өөрийн хүснэгтүүдээ үүсгэнэ) |
   | `APP_SECRET` | санамсаргүй урт мөр: `openssl rand -hex 32` |

3. Settings → Networking → **Generate Domain** (жишээ `umami-production.up.railway.app`)
4. Тэр хаягаар нэвтэрнэ: `admin` / `umami` → **нууц үгээ шууд солино**
5. Settings → Websites → **Add website**: Name `AI News`, Domain нь сайтын домэйн
6. Үүссэн website-ийн **Edit → Website ID**-г хуулж авна

### web service-ийн env

| Хувьсагч | Тайлбар |
|---|---|
| `NEXT_PUBLIC_UMAMI_URL` | umami service-ийн домэйн, жишээ `https://umami-production.up.railway.app` |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | 5-р алхмын website id |

**Хоёул байвал л** tracker рендэрлэнэ — нэг нь дутуу бол (локал dev) юу ч ачаалахгүй.
Хувьсагчийг `umamiConfig(process.env)`-оор бүтнээр нь уншдаг тул Next үүнийг build үед inline
хийхгүй: Railway дээр утгыг солиход **дахин build хэрэггүй**, restart хангалттай.

### Юу хэмжигддэг

Tracker (`next/script`, `strategy="afterInteractive"`) хуудасны үзэлтийг автоматаар бүртгэнэ.
`/admin` доорх хуудсуудад **огт ачаалахгүй** — редакторын ажил статистикийг бохирдуулахгүй.
`data-exclude-search` тул URL-ийн `?q=…` хадгалагдахгүй (хайлтын үгийг доорх event-ээр авна).

| Event | Өгөгдөл | Хэзээ |
|---|---|---|
| `search` | `query`, `resultCount` | `/hailt` хуудас, эсвэл dropdown-оос үр дүн сонгоход |
| `newsletter_subscribe` | — | имэйл амжилттай илгээгдсэн үед |
| `newsletter_confirm` | — | `/newsletter/batalgaajlaa` (холбоос хүчинтэй үед) |
| `ranking_tab` | `tab`: `usage` \| `quality` | `/jagsaalt`-ын аль таб үзэж байгаа |
| `share_facebook` | `slug` | «Facebook-д хуваалцах» товшилт |
| `model_view` | `slug` | моделийн хуудас |
| `usecase_view` | `slug` | хэрэглээний ангиллын хуудас |

Код: `src/lib/analytics.ts` (`analytics.*` туслахууд), `src/components/Track.tsx`
(серверийн хуудаснаас event илгээх `<TrackEvent>`). `window.umami` байхгүй бол бүх дуудлага
**no-op** — script ачаалахаас өмнө илгээсэн event-ийг ~6 секунд дахин оролдоод чимээгүй орхино.

### /admin дээрх хайлтын статистик

Umami-гаас **хамааралгүй**, `SearchLog` хүснэгтээс шууд (tracker блоклогдсон ч тоо бүрэн):

- **Сүүлийн 7 хоногийн топ 20 хайлт**
- **Үр дүнгүй хайлтууд** — ямар контент дутуу байгааг шууд заана

Толгой хэсгийн **«Аналитик →»** холбоос Umami dashboard руу гаргана
(`NEXT_PUBLIC_UMAMI_URL` тохируулаагүй бол харагдахгүй).

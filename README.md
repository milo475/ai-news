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
`/hereglee` (ямар ажилд аль AI), `/argachlal`, `/medee`.

Хуудсууд өгөгдлийг зөвхөн `src/data/index.ts`-ээс авна — DB эсвэл fixture-ийг тэнд сольдог.
Нүүр хуудас request тутам шинэчлэгдэнэ (`force-dynamic`) — build үед DB байдаггүй, мөн deploy хийсэн
даруйд хуучин өгөгдөл харагдахгүйн тулд. Бусад хуудас: `/medee` 10 мин, `/medee/<slug>` болон
`/model/...` 1 цагийн ISR.

## Мэдээний agent — 1-р шат (RSS цуглуулагч)
LLM дуудахгүй: эх сурвалжаас татаж `Article.status = RAW` нийтлэл болгон хадгална.
Монгол гарчиг/хураангуй (`titleMn`, `summaryMn`, `bodyMn`) 2-р шатанд бөглөгдөнө.

```bash
npm run db:seed:sources   # эх сурвалжуудыг Source хүснэгтэд upsert
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

Feed-ийн төлөв (2026-09-20):
- **Anthropic News** — нийтийн RSS/Atom олдсонгүй (`rss.xml`, `feed.xml`, `news/rss.xml` бүгд 404, HTML дотор
  `<link rel="alternate">` байхгүй). `isActive: false` болгосон — feed гармагц seed дээр асаана.
- **VentureBeat AI** — feed хаяг зөв боловч bot хамгаалалт HTTP 429 буцаадаг. Идэвхтэй үлдээсэн,
  алдаа нь `Source.lastError`-т бичигдэж бусад эх сурвалжийг зогсоохгүй.
- Бусад 8 feed ажиллаж байна.

## Мэдээний agent — 2-р шат (үнэлгээ + монголоор бичих)
RAW нийтлэлийг хоёр LLM дуудлагаар боловсруулна: эхлээд хямд моделиор 1–10 оноо, дараа нь
босго давсныг нь монголоор бичиж `DRAFT` болгоно. Босго давахгүй бол `REJECTED`.

```bash
npm run agent:process -- --limit 10          # default 20
WRITE_MODEL=anthropic/claude-opus-5 npm run agent:process -- --limit 3   # бичих моделийг солих
```

`.env` тохиргоо:

| Хувьсагч | Утга |
|---|---|
| `SCORE_MODEL` | үнэлгээний модель (maxTokens 300, temperature 0.1) |
| `WRITE_MODEL` | монголоор бичих модель (maxTokens 4000, temperature 0.4) |
| `RELEVANCE_THRESHOLD` | үүнээс доош оноотой нийтлэл `REJECTED` (default 7) |
| `AUTO_PUBLISH_MIN_SCORE` | хоосон = унтраалттай. Тоо бол тэр оноо давсныг шууд нийтэлнэ |

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

- Самбар: RAW/DRAFT/PUBLISHED/REJECTED тоо, `openrouter`/`rss`/`agent` ажлуудын сүүлийн ажиллалт.
- Таб бүр дээр нийтлэлийн жагсаалт: гарчиг, эх сурвалж, оноо, бүтэн текст байгаа эсэх (● / ○), огноо.
  DRAFT таб дээр мөр бүрт «Нийтлэх» / «Хаях».
- `/admin/<id>`: зүүн талд гарчиг, хураангуй, үндсэн текст, шошго, slug-ийн форм
  («Хадгалах», «Хадгалаад нийтлэх»); баруун талд эх мэдээлэл, үнэлгээний шалтгаан, бүтэн текст,
  «Дахин бичүүлэх» (тухайн нэг нийтлэлийг agent-аар дахин боловсруулна — LLM дуудна, алдаа гарвал
  хуудсан дээр харагдана).
- Нийтлэхэд `/`, `/medee`, `/medee/<slug>` болон холбогдсон моделийн хуудсууд шинэчлэгдэнэ.

### Ажиллуулах товчнууд
Самбар дээрээс гараар ажил эхлүүлнэ: **«Мэдээ татах»** (rss), **«Агент бичүүлэх»** (agent),
**«Бүгд»** (openrouter → rss → agent → facebook).

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

## Facebook
`.env`-д `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `SITE_URL` бөглөнө. Token хоосон бол алхам алгасагдана.

```bash
npm run publish:facebook    # PUBLISHED бөгөөд постлоогүй мэдээг постолно
```

Нэг ажиллуулалтад дээд тал нь 5 пост, хооронд 30 секунд. Пост: гарчиг + хураангуй + сайтын холбоос.
Facebook-ийн буцаасан id `Article.fbPostId`-д хадгалагдана; `/admin/<id>` дээр «Facebook-т постлох»
товчоор гараар ч постолж болно.

## Pipeline
```bash
npm run pipeline                          # openrouter → arena → rss → agent → digest → newsletter → facebook
npm run pipeline -- --skip openrouter      # алхам алгасах (таслалаар олныг)
```
Алхам бүр тусдаа try/catch — нэг нь унасан ч дараагийнх ажиллана. Төгсгөлд дүнгийн хүснэгт гарч,
ямар нэг алхам унасан бол exit 1.

`rss` алхам дээр **эх сурвалж бүр унасан**, `agent` алхам дээр **нийтлэл бүр унасан** бол (жишээ нь
сүлжээ тасарсан, OpenRouter кредит дууссан) алхмыг унасан гэж үзнэ — cron дээр эвдрэл чимээгүй
өнгөрөхгүй. `JobRun` мөн `ok = false` болж, /admin дээр улаанаар харагдана. Хэсэг нь амжилттай бол
алхам «ok» хэвээр.

## Автоматжуулалт (cron)
Локал (Kali):
```
30 3 * * * cd /home/kali/ai-medee && /usr/bin/npm run pipeline >> logs/pipeline.log 2>&1
```
UTC 03:30 = Улаанбаатарын цагаар 11:30. `logs/` хавтас git-д ордоггүй (`.gitignore`).

Railway/VPS дээр ижил командыг тухайн платформын cron service-ээр ажиллуулна (дараагийн шатанд).

## Deploy (Railway, Hobby)
Гурван сервис: **Postgres**, **web**, **cron**. Хоёулаа нэг `Dockerfile`-ээс build хийгдэж,
зөвхөн start command-аараа ялгаатай.

| Сервис | Start command | Тайлбар |
|---|---|---|
| web | `npm run start:web` | `prisma migrate deploy` хийгээд `next start`. Health: `/api/health` |
| cron | `npm run start:cron` | `src/pipeline.ts`. Schedule: `30 3 * * *` (UTC 03:30 = УБ 11:30) |

Cron сервис migration хийхгүй — түүнийг web хариуцна.

### Env хувьсагчид

**web**

| Хувьсагч | Тайлбар |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `ADMIN_PASSWORD` | `/admin`-ы Basic auth нууц үг. Хоосон бол `/admin` 503 |
| `SITE_URL` | нийтийн домэйн, Facebook постын холбоост |
| `OPENROUTER_API_KEY` | зөвхөн `/admin` дээрх «Дахин бичүүлэх» товчинд |
| `NEXT_PUBLIC_UMAMI_URL`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | analytics — [Analytics (Umami)](#analytics-umami) |
| `NEXT_TELEMETRY_DISABLED` | `1` |

**cron**

| Хувьсагч | Тайлбар |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `OPENROUTER_API_KEY` | үнэлгээ, бичилт, жагсаалтын Data API |
| `SCORE_MODEL`, `WRITE_MODEL`, `RELEVANCE_THRESHOLD` | agent-ийн тохиргоо |
| `SITE_URL` | Facebook постын холбоост |
| `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN` | хоосон бол Facebook алхам алгасагдана |

### Эхний удаад
Deploy хийсний дараа эх сурвалжуудыг нэг удаа seed хийнэ:
```bash
railway run --service cron npm run db:seed:sources
```

### Docker локал дээр
```bash
docker build -t ai-news .
docker run --rm -p 3000:3000 -e DATABASE_URL=... -e ADMIN_PASSWORD=... ai-news
```
Image суурь нь `mcr.microsoft.com/playwright:v1.63.0-noble` — chromium бэлэн байдаг тул
`npx playwright install` хэрэггүй. **Playwright-ийн хувилбар `package.json`-той яг таарах ёстой**
(тиймээс `"playwright": "1.63.0"` гэж тогтоосон, `^` байхгүй) — зөрвөл browser олдохгүй.

## Авто нийтлэх (анхдагчаар унтраалттай)
`AUTO_PUBLISH_MIN_SCORE` хоосон бол агент бүх нийтлэлийг `DRAFT` болгож, хүн хянана. Тоо (жишээ `9`)
тавибал агент бичсэний дараа **оноо нь тэр утгаас дээш БӨГӨӨД бүтэн тексттэй** нийтлэлийг шууд
`PUBLISHED` болгоно (`publishedAt = now`, `reviewedBy = "auto"`). Зөвхөн хураангуйгаар бичигдсэн
нийтлэл авто нийтлэгдэхгүй — баримт дутуу байх магадлалтай учраас.

/admin-ийн PUBLISHED таб дээр ийм нийтлэл «авто» шошготой харагдана.

> **Анхааруулга:** эхний 2–4 долоо хоног үүнийг унтраалттай байлгаж, агентын бичсэнийг гараар хянана
> уу. Гарчиг, тоо, нэр томьёо тогтвортой зөв гарч байгаад итгэсний дараа л асаана. Асаасан ч
> 9-өөс доош утга тавихыг зөвлөхгүй.

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
зэрэгцүүлж харуулна. `/argachlal`-д Arena Elo гэж юу вэ гэдгийг тайлбарласан.

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

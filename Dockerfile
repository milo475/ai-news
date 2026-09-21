# Playwright-ийн албан ёсны image — chromium болон түүний системийн сангууд бэлэн,
# PLAYWRIGHT_BROWSERS_PATH нь тохируулагдсан байдаг.
# Хувилбар нь package.json дахь playwright-тай ЯГ таарах ёстой (1.63.0) — зөрвөл browser олдохгүй.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

# Хамаарлууд тусад нь — код өөрчлөгдөхөд энэ layer дахин үүсэхгүй.
# devDependencies заавал хэрэгтэй: tsx (pipeline), prisma CLI (migrate deploy), next build.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

# Prisma client үүсгээд Next-ийг build хийнэ. Build үед DB хэрэггүй —
# DB-д ханддаг хуудсууд зөвхөн request үед ажиллана.
RUN npx prisma generate && npm run build

EXPOSE 3000

# web сервис. cron сервис дээр start command-ыг "npm run start:cron" болгоно.
CMD ["npm", "run", "start:web"]

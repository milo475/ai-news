#!/usr/bin/env bash
#
# Production дээр npm script ажиллуулна.
#
#   ./scripts/prod.sh cost:report
#   ./scripts/prod.sh publish:audit -- --days 30 --judge
#   ./scripts/prod.sh article:fix -- --slug <slug> --title "Урт гарчиг энд"
#   ./scripts/prod.sh prisma migrate deploy        # npm-ийн бус команд: prisma/npx
#
# ЯАГААД ЭНЭ ХЭРЭГТЭЙ ВЭ:
#   `railway run npm run …` нь (а) --service-гүй бол буруу үйлчилгээний хувьсагчийг
#   өгч болно, (б) `DATABASE_URL` нь Railway-ийн ДОТООД хаяг (postgres.railway.internal)
#   бөгөөд энэ нь зөвхөн кластерын дотроос л холбогддог. Локалаас ажиллуулахад
#   `DATABASE_PUBLIC_URL` хэрэгтэй. Энэ скрипт хоёуланг нь зөв тавина.
#
# DB URL нь зөвхөн орчны хувьсагчаар дамжина — файл, лог, echo-д гарахгүй.
set -euo pipefail

RAILWAY="${RAILWAY_BIN:-$HOME/.local/bin/railway}"
SERVICE="${RAILWAY_SERVICE:-ai-news}"

[ $# -ge 1 ] || {
  echo "Хэрэглээ: ./scripts/prod.sh <npm-script|prisma> [args…]" >&2
  echo "Жишээ:   ./scripts/prod.sh publish:audit -- --days 30 --judge" >&2
  exit 1
}

CMD="$1"; shift

# Аргументуудыг shell-д АЮУЛГҮЙ дамжуулна: "$@" -г нэг бүрчлэн хашилтална.
# Эс бөгөөс --title "Урт гарчиг энд" гэсэн зай бүхий утга хэд хэдэн аргумент
# болж задардаг.
quoted=""
for a in "$@"; do
  quoted+=" $(printf '%q' "$a")"
done

if [ "$CMD" = "prisma" ]; then
  INNER="npx prisma${quoted}"
else
  INNER="npm run --silent $(printf '%q' "$CMD")${quoted}"
fi

exec "$RAILWAY" run --service "$SERVICE" sh -c '
  # Локалаас холбогдох тул нийтийн хаягийг хэрэглэнэ
  if [ -n "${DATABASE_PUBLIC_URL:-}" ]; then export DATABASE_URL="$DATABASE_PUBLIC_URL"; fi
  '"$INNER"'
'

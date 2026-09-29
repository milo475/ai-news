#!/usr/bin/env bash
#
# Нөөцийг СЭРГЭЭЖ ЧАДАХ эсэхийг батална.
#
#   npm run db:restore-test -- ~/backups/ai-news/ai-news-2026-09-29.dump
#
# Локал тусдаа DB (ai_news_restore_test) руу сэргээж, мөрийн тоог production-тай
# тулгаад тэр DB-г УСТГАНА. Production-д юу ч бичихгүй.
set -euo pipefail

DUMP="${1:-}"
[ -n "$DUMP" ] || { echo "Хэрэглээ: npm run db:restore-test -- <файл.dump>"; exit 1; }
[ -f "$DUMP" ] || { echo "✗ файл олдсонгүй: $DUMP"; exit 1; }

RAILWAY="${RAILWAY_BIN:-$HOME/.local/bin/railway}"
PSQL="${PSQL_BIN:-/usr/bin/psql}"
PG_RESTORE="${PG_RESTORE_BIN:-/usr/bin/pg_restore}"
SERVICE="${RAILWAY_SERVICE:-ai-news}"
TEST_DB="${RESTORE_TEST_DB:-ai_news_restore_test}"

# Локал admin холболт — DATABASE_URL-ийн эзэн, хост, портыг ашиглана
LOCAL_URL="${DATABASE_URL:?DATABASE_URL тохируулаагүй}"
ADMIN_URL="${LOCAL_URL%/*}/postgres"

log() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*"; }

TABLES='Article User BenchResult BenchModelSummary Guide Prompt Tool StudioSession'
counts() {  # $1 = холболт
  "$PSQL" "$1" -qtAX -F' ' -c "
    SELECT 'Article', count(*) FROM \"Article\"
    UNION ALL SELECT 'User', count(*) FROM \"User\"
    UNION ALL SELECT 'BenchResult', count(*) FROM \"BenchResult\"
    UNION ALL SELECT 'BenchModelSummary', count(*) FROM \"BenchModelSummary\"
    UNION ALL SELECT 'Guide', count(*) FROM \"Guide\"
    UNION ALL SELECT 'Prompt', count(*) FROM \"Prompt\"
    UNION ALL SELECT 'Tool', count(*) FROM \"Tool\"
    UNION ALL SELECT 'StudioSession', count(*) FROM \"StudioSession\"
    ORDER BY 1;"
}

cleanup() {
  log "Тест DB-г устгаж байна…"
  "$PSQL" "$ADMIN_URL" -qtAX -c "DROP DATABASE IF EXISTS \"$TEST_DB\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "Тест DB үүсгэж байна: $TEST_DB"
"$PSQL" "$ADMIN_URL" -qtAX -c "DROP DATABASE IF EXISTS \"$TEST_DB\" WITH (FORCE);" >/dev/null
"$PSQL" "$ADMIN_URL" -qtAX -c "CREATE DATABASE \"$TEST_DB\";" >/dev/null

TEST_URL="${LOCAL_URL%/*}/$TEST_DB"
log "Сэргээж байна ($(numfmt --to=iec "$(stat -c%s "$DUMP")"))…"
"$PG_RESTORE" -d "$TEST_URL" --no-owner --no-acl -j 4 "$DUMP" 2>&1 | grep -v "^pg_restore: warning" || true

log "Мөрийн тоог production-тай тулгаж байна…"
PROD_URL=$("$RAILWAY" variables --service "$SERVICE" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).DATABASE_PUBLIC_URL??"")}catch{process.stdout.write("")}})')

printf '\n  %-22s %10s %10s  %s\n' "хүснэгт" "нөөц" "production" ""
BAD=0
if [ -n "$PROD_URL" ]; then
  paste <(counts "$TEST_URL") <(counts "$PROD_URL") | while read -r t1 n1 t2 n2; do
    mark="✓"; [ "$n1" = "$n2" ] || mark="≠"
    printf '  %-22s %10s %10s  %s\n' "$t1" "$n1" "$n2" "$mark"
  done
  # Зөрүү байгаа эсэхийг тусад нь (while нь дэд бүрхүүлд ажиллана)
  DIFF=$(paste <(counts "$TEST_URL") <(counts "$PROD_URL") | awk '$2 != $4 {print $1}')
  [ -z "$DIFF" ] || { BAD=1; echo; log "⚠ зөрүүтэй: $DIFF"; log "  (нөөц авсны дараа production өөрчлөгдсөн байж болно)"; }
else
  counts "$TEST_URL" | while read -r t n; do printf '  %-22s %10s %10s\n' "$t" "$n" "?"; done
  log "⚠ production-той тулгаагүй (DATABASE_PUBLIC_URL алга)"
fi

echo
[ "$BAD" -eq 0 ] && log "✓ сэргээлт амжилттай" || log "⚠ сэргээлт болсон ч тоо зөрүүтэй"

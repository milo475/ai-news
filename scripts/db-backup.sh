#!/usr/bin/env bash
#
# Production DB-ийн өдөр тутмын нөөц.
#
# Railway Hobby төлөвлөгөөнд backup/PITR БАЙХГҮЙ: нэг буруу migration эсвэл
# устгалт бүх нийтлэл, хэрэглэгч, бенчмаркийг арчина. Энэ скрипт нь systemd
# --user timer-ээр өдөр бүр ажиллана.
#
#   npm run db:backup
#
# ААР ЗҮЙЛ: dump-д хэрэглэгчийн имэйл, нууц үгийн hash байна. Git, GitHub,
# cloud — ХААНА Ч гаргахгүй. DB URL-ийг лог, файлд бичихгүй.
set -euo pipefail

# systemd орчинд PATH хумигдмал — бүтэн замууд
RAILWAY="${RAILWAY_BIN:-$HOME/.local/bin/railway}"
PG_DUMP="${PG_DUMP_BIN:-/usr/bin/pg_dump}"
PG_RESTORE="${PG_RESTORE_BIN:-/usr/bin/pg_restore}"
PSQL="${PSQL_BIN:-/usr/bin/psql}"

SERVICE="${RAILWAY_SERVICE:-ai-news}"
DIR="${BACKUP_DIR:-$HOME/backups/ai-news}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
KEEP_SUNDAYS="${BACKUP_KEEP_SUNDAYS:-8}"

STARTED=$(date +%s)
DAY=$(date +%F)
OUT="$DIR/ai-news-$DAY.dump"

mkdir -p "$DIR"
chmod 700 "$DIR"

log() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*"; }
fail() { log "✗ $*"; report "false" "0" "$*"; exit 1; }

# Үр дүнг production-ийн JobRun-д бичнэ — /api/health-ийн lastRuns-д гарна
report() {
  local ok="$1" bytes="$2" err="${3:-}"
  local secs=$(( $(date +%s) - STARTED ))
  [ -n "${DB_URL:-}" ] || return 0
  PGCONNECT_TIMEOUT=20 "$PSQL" "$DB_URL" -qtAX <<SQL || log "⚠ JobRun бичигдсэнгүй"
INSERT INTO "JobRun" (id, job, "startedAt", "finishedAt", ok, "itemsOut", error)
VALUES (
  md5(random()::text || clock_timestamp()::text),
  'backup',
  now() - make_interval(secs => $secs),
  now(),
  $ok,
  $bytes,
  $( [ -n "$err" ] && printf "%s" "'$(printf '%s' "$err" | sed "s/'/''/g" | cut -c1-500)'" || printf "NULL" )
);
SQL
}

log "Railway-ээс холболтын мэдээлэл авч байна ($SERVICE)…"
DB_URL=$("$RAILWAY" variables --service "$SERVICE" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).DATABASE_PUBLIC_URL??"")}catch{process.stdout.write("")}})')
[ -n "$DB_URL" ] || fail "DATABASE_PUBLIC_URL олдсонгүй (railway login хийсэн эсэхийг шалгана уу)"

# pg_dump-ийн хувилбар серверийнхээс БАГА байж болохгүй
SERVER_V=$(PGCONNECT_TIMEOUT=20 "$PSQL" "$DB_URL" -tAc "SHOW server_version;" 2>/dev/null | cut -d. -f1)
DUMP_V=$("$PG_DUMP" --version | grep -oE '[0-9]+' | head -1)
[ -n "$SERVER_V" ] || fail "серверт холбогдсонгүй"
log "сервер PostgreSQL $SERVER_V · pg_dump $DUMP_V"
if [ "$DUMP_V" -lt "$SERVER_V" ]; then
  fail "pg_dump $DUMP_V < сервер $SERVER_V — /usr/lib/postgresql/$SERVER_V/bin/pg_dump ашиглана уу"
fi

log "Нөөц авч байна → $(basename "$OUT")"
TMP="$OUT.partial"
PGCONNECT_TIMEOUT=30 "$PG_DUMP" "$DB_URL" -Fc --no-owner --no-acl -f "$TMP" \
  || fail "pg_dump амжилтгүй"
mv "$TMP" "$OUT"
chmod 600 "$OUT"

BYTES=$(stat -c%s "$OUT")
[ "$BYTES" -gt 0 ] || fail "нөөц хоосон"

log "Шалгаж байна (pg_restore --list)…"
TABLES=$("$PG_RESTORE" --list "$OUT" 2>/dev/null | grep -c "TABLE DATA" || true)
[ "$TABLES" -gt 0 ] || fail "pg_restore --list уншигдсангүй эсвэл хүснэгт алга"

log "✓ $(numfmt --to=iec "$BYTES") · $TABLES хүснэгт · $(( $(date +%s) - STARTED ))с"

# Гол хүснэгтүүдийн мөрийн тоо — сэргээхэд юутай тулгахыг мэдэхийн тулд
log "Мөрийн тоо:"
PGCONNECT_TIMEOUT=20 "$PSQL" "$DB_URL" -qtAX -F' ' <<'SQL' | while read -r t n; do printf '  %-22s %s\n' "$t" "$n"; done
SELECT 'Article', count(*) FROM "Article"
UNION ALL SELECT 'User', count(*) FROM "User"
UNION ALL SELECT 'BenchResult', count(*) FROM "BenchResult"
UNION ALL SELECT 'BenchModelSummary', count(*) FROM "BenchModelSummary"
UNION ALL SELECT 'Guide', count(*) FROM "Guide"
UNION ALL SELECT 'Prompt', count(*) FROM "Prompt"
UNION ALL SELECT 'Tool', count(*) FROM "Tool"
UNION ALL SELECT 'StudioSession', count(*) FROM "StudioSession"
ORDER BY 1;
SQL

# ——— Эргэлт: сүүлийн 14 өдөр + ням гарагийн 8 долоо хоног ———
log "Хуучин нөөцийг цэвэрлэж байна…"
KEPT=0
DELETED=0
for f in "$DIR"/ai-news-*.dump; do
  [ -e "$f" ] || continue
  d=$(basename "$f" .dump); d=${d#ai-news-}
  age=$(( ( $(date +%s) - $(date -d "$d" +%s) ) / 86400 ))
  dow=$(date -d "$d" +%u)   # 7 = ням
  weeks=$(( age / 7 ))
  if [ "$age" -lt "$KEEP_DAYS" ] || { [ "$dow" -eq 7 ] && [ "$weeks" -lt "$KEEP_SUNDAYS" ]; }; then
    KEPT=$((KEPT+1))
  else
    rm -f "$f"; DELETED=$((DELETED+1))
  fi
done
log "үлдээв $KEPT · устгав $DELETED"

report "true" "$BYTES"
log "Дууслаа."

/**
 * Нөөцийн шинэлэг байдлын шалгалт (цэвэр хэсэг).
 *
 * Railway Hobby-д backup/PITR байхгүй тул энэ Kali машин дээрх systemd timer нь
 * цорын ганц хамгаалалт. Тэр timer чимээгүй унтарвал мэдэх ёстой.
 */

/** Сүүлийн амжилттай нөөц үүнээс хуучин бол ⚠ */
export const BACKUP_STALE_HOURS = 36;

export interface BackupHealth {
  /** Сүүлийн амжилттай нөөц хэзээ */
  at: Date | null;
  hoursAgo: number | null;
  /** Хамгийн сүүлийн нөөцийн хэмжээ, байтаар */
  bytes: number | null;
  stale: boolean;
  message: string | null;
}

export function backupHealth(
  last: { finishedAt: Date | null; itemsOut: number | null } | null,
  now: Date,
  staleHours = BACKUP_STALE_HOURS,
): BackupHealth {
  const at = last?.finishedAt ?? null;
  if (!at) {
    return {
      at: null, hoursAgo: null, bytes: null, stale: true,
      message: "DB-ийн нөөц хэзээ ч амжилттай ажиллаагүй байна — systemctl --user status ai-news-backup.timer",
    };
  }

  const hoursAgo = Math.round(((now.getTime() - at.getTime()) / 3_600_000) * 10) / 10;
  const stale = hoursAgo > staleHours;
  return {
    at,
    hoursAgo,
    bytes: last?.itemsOut ?? null,
    stale,
    message: stale
      ? `DB-ийн сүүлийн нөөц ${hoursAgo} цагийн өмнөх (хязгаар ${staleHours}ц) — ` +
        "systemctl --user status ai-news-backup.timer шалгана уу"
      : null,
  };
}

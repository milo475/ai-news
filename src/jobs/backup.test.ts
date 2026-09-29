import { test } from "node:test";
import assert from "node:assert/strict";
import { backupHealth, BACKUP_STALE_HOURS } from "./backup.api";

const NOW = new Date("2026-09-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

test("сүүлийн нөөц шинэхэн бол ⚠ гарахгүй", () => {
  const h = backupHealth({ finishedAt: hoursAgo(10), itemsOut: 9_123_456 }, NOW);
  assert.equal(h.stale, false);
  assert.equal(h.message, null);
  assert.equal(h.hoursAgo, 10);
  assert.equal(h.bytes, 9_123_456);
});

test("36 цагаас хуучин бол ⚠", () => {
  assert.equal(BACKUP_STALE_HOURS, 36);
  assert.equal(backupHealth({ finishedAt: hoursAgo(36), itemsOut: 1 }, NOW).stale, false, "яг 36 нь зүгээр");
  const h = backupHealth({ finishedAt: hoursAgo(37), itemsOut: 1 }, NOW);
  assert.equal(h.stale, true);
  assert.match(h.message!, /37 цагийн өмнөх/);
  assert.match(h.message!, /ai-news-backup.timer/);
});

test("нэг өдөр алгассан ч (24ц) хэвийн — timer өдөр бүр", () => {
  // 02:40-д ажилладаг тул хамгийн ихдээ ~24ц зөрүү хэвийн
  assert.equal(backupHealth({ finishedAt: hoursAgo(25), itemsOut: 1 }, NOW).stale, false);
});

test("нөөц хэзээ ч ажиллаагүй бол ⚠", () => {
  const h = backupHealth(null, NOW);
  assert.equal(h.stale, true);
  assert.equal(h.at, null);
  assert.match(h.message!, /хэзээ ч амжилттай ажиллаагүй/);
});

test("finishedAt байхгүй бүртгэлийг ажиллаагүйд тооцно", () => {
  assert.equal(backupHealth({ finishedAt: null, itemsOut: 5 }, NOW).stale, true);
});

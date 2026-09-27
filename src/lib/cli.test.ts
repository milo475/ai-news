import { test } from "node:test";
import assert from "node:assert/strict";
import { isEntry } from "./cli";

test("isEntry: файлын нэрийг БҮТНЭЭР нь таарна", () => {
  const argv = (path: string) => ["node", path];
  assert.equal(isEntry("card.ts", argv("/app/src/publish/card.ts")), true);
  assert.equal(isEntry("card.ts", argv("src/publish/card.ts")), true);
  assert.equal(isEntry("card.ts", argv("card.ts")), true);
});

test("isEntry: recard.ts нь card.ts-ийн CLI-г асаах ЁСГҮЙ", () => {
  // endsWith("card.ts") нь "recard.ts"-д ч үнэн — энэ алдаа бодитоор гарсан:
  // `npm run cards:fix` ажиллуулахад card.ts-ийн CLI хэрэглээг хэвлэдэг байв
  assert.equal(isEntry("card.ts", ["node", "/app/src/gallery/recard.ts"]), false);
  assert.equal(isEntry("recard.ts", ["node", "/app/src/gallery/recard.ts"]), true);
});

test("isEntry: өөр файлд худал", () => {
  assert.equal(isEntry("card.ts", ["node", "/app/src/publish/fbimage.ts"]), false);
  assert.equal(isEntry("seed.ts", ["node", "/app/src/guides/write.ts"]), false);
  assert.equal(isEntry("card.ts", ["node"]), false);
  assert.equal(isEntry("card.ts", []), false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CORE_STEPS, exitCodeFor, isCoreStep, MAX_FAILURES_PER_DAY, shouldGiveUpToday,
} from "./steps.api";

test("isCoreStep: мэдээ нийтлэх урсгалын алхмууд", () => {
  for (const s of ["rss", "agent", "publish", "facebook", "instagram"]) {
    assert.equal(isCoreStep(s), true, s);
  }
  // Туслах: унасан ч сайт ажиллана
  for (const s of ["digest", "newsletter", "openrouter", "arena", "bench", "fbstats", "insights", "report", "improve", "html", "local"]) {
    assert.equal(isCoreStep(s), false, s);
  }
  assert.equal(isCoreStep("байхгүй"), false);
});

test("exitCodeFor: зөвхөн гол алхам унавал 1", () => {
  assert.equal(exitCodeFor([]), 0);
  // digest унасан ч Railway улаан болохгүй — энэ нь засварын гол зорилго
  assert.equal(exitCodeFor(["digest"]), 0);
  assert.equal(exitCodeFor(["digest", "newsletter", "fbstats"]), 0);
  assert.equal(exitCodeFor(["agent"]), 1);
  assert.equal(exitCodeFor(["digest", "publish"]), 1, "нэг ч гол алхам унавал 1");
});

test("shouldGiveUpToday: 2 удаа унасны дараа тэр өдөртөө болино", () => {
  assert.equal(MAX_FAILURES_PER_DAY, 2);
  assert.equal(shouldGiveUpToday(0), false);
  assert.equal(shouldGiveUpToday(1), false, "нэг удаа унасан нь түр гэмтэл байж болно");
  assert.equal(shouldGiveUpToday(2), true);
  assert.equal(shouldGiveUpToday(9), true);
  // Хязгаарыг тохируулж болно
  assert.equal(shouldGiveUpToday(1, 1), true);
  assert.equal(shouldGiveUpToday(2, 5), false);
});

test("CORE_STEPS нь өөрчлөгдвөл санаатай байх ёстой", () => {
  assert.deepEqual([...CORE_STEPS], ["rss", "agent", "publish", "facebook", "instagram"]);
});

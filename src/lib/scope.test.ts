/**
 * Зэрэг ажиллаж буй ажлуудын зардал ХОЛИЛДОХГҮЙ байх.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { recordCall, resetLedger, total, withScope } from "./spend";

test("хоёр зэрэг ажлын зардал холилдохгүй", async () => {
  resetLedger();

  const a = withScope(async (spent) => {
    recordCall(0.10);
    // Нөгөө ажил дундуур дуудлага хийнэ
    await new Promise((r) => setTimeout(r, 20));
    recordCall(0.05);
    return spent();
  });

  const b = withScope(async (spent) => {
    await new Promise((r) => setTimeout(r, 5));
    recordCall(1.00);
    await new Promise((r) => setTimeout(r, 20));
    recordCall(2.00);
    return spent();
  });

  const [la, lb] = await Promise.all([a, b]);

  assert.equal(Number(la.usd.toFixed(4)), 0.15, "A нь B-гийн зардлыг авсан байна");
  assert.equal(la.calls, 2);
  assert.equal(Number(lb.usd.toFixed(4)), 3.0, "B нь A-гийн зардлыг авсан байна");
  assert.equal(lb.calls, 2);

  // Процессын нийт нь хоёуланг агуулна
  assert.equal(Number(total().usd.toFixed(4)), 3.15);
  assert.equal(total().calls, 4);
});

test("хүрээнээс ГАДУУРХ дуудлага ажлын тоолуурт орохгүй", async () => {
  resetLedger();
  // Студи гэх мэт вэб дуудлага — withJob-ийн гадна
  recordCall(5.0);

  const inside = await withScope(async (spent) => {
    recordCall(0.2);
    return spent();
  });

  assert.equal(Number(inside.usd.toFixed(4)), 0.2, "гадуурх дуудлага орсон байна");
  assert.equal(Number(total().usd.toFixed(4)), 5.2, "процессын нийтэд хоёулаа орно");
});

test("үүрлэсэн хүрээ дотоод ажлыг тусад нь тоолно", async () => {
  resetLedger();
  const outer = await withScope(async (spent) => {
    recordCall(1.0);
    const inner = await withScope(async (s2) => {
      recordCall(0.5);
      return s2();
    });
    assert.equal(Number(inner.usd.toFixed(4)), 0.5);
    return spent();
  });
  // Дотоод дуудлага нь гадаад хүрээнд ОРОХГҮЙ — тус тусдаа ажил
  assert.equal(Number(outer.usd.toFixed(4)), 1.0);
});

test("бүртгэл throw хийхгүй", () => {
  resetLedger();
  assert.doesNotThrow(() => recordCall(Number.NaN));
  assert.doesNotThrow(() => recordCall(undefined as unknown as number));
  assert.equal(total().calls, 2, "муу утга ч дуудлага гэж тоологдоно");
});

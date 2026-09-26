import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

/** Тест бүр өөрийн env-ийг тавина — middleware нь process.env-ээс уншдаг */
function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const req = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(new Request(url, { headers }));

test("OLD_HOSTS — хуучин домэйноос шинэ рүү 301, зам хадгалагдана", () => {
  withEnv({ OLD_HOSTS: "old.up.railway.app", SITE_URL: "https://ai.mn" }, () => {
    const res = middleware(req("https://old.up.railway.app/medee/gpt-5?a=1", { host: "old.up.railway.app" }));
    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), "https://ai.mn/medee/gpt-5?a=1");
  });
});

test("OLD_HOSTS — шинэ домэйн дээр шилжүүлэхгүй", () => {
  withEnv({ OLD_HOSTS: "old.up.railway.app", SITE_URL: "https://ai.mn" }, () => {
    const res = middleware(req("https://ai.mn/medee", { host: "ai.mn" }));
    assert.notEqual(res.status, 301);
  });
});

test("OLD_HOSTS — тохируулаагүй бол хэзээ ч шилжүүлэхгүй", () => {
  withEnv({ OLD_HOSTS: undefined, SITE_URL: "https://ai.mn" }, () => {
    const res = middleware(req("https://anything.mn/", { host: "anything.mn" }));
    assert.notEqual(res.status, 301);
  });
});

test("аюулгүй байдлын header-ууд энгийн хуудсанд тавигдана", () => {
  withEnv({ SITE_URL: "https://ai.mn", OLD_HOSTS: undefined }, () => {
    const res = middleware(req("https://ai.mn/medee", { host: "ai.mn" }));
    assert.ok(res.headers.get("Content-Security-Policy-Report-Only"));
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.ok(res.headers.get("Strict-Transport-Security"));
  });
});

test("embed хуудсанд сайтын CSP-г дарж бичихгүй", () => {
  withEnv({ SITE_URL: "https://ai.mn", OLD_HOSTS: undefined }, () => {
    const res = middleware(req("https://ai.mn/barimt/x/embed", { host: "ai.mn" }));
    assert.equal(res.headers.get("Content-Security-Policy-Report-Only"), null);
  });
});

test("/harits — эсрэг дараалалтай хосыг 301-ээр canonical руу", () => {
  withEnv({ SITE_URL: "https://ai.mn", OLD_HOSTS: undefined }, () => {
    const res = middleware(req("https://ai.mn/harits/zzz--vs--aaa", { host: "ai.mn" }));
    assert.equal(res.status, 301);
    assert.ok(res.headers.get("location")?.endsWith("/harits/aaa--vs--zzz"));
  });
});

test("/profile — session cookie байхгүй бол нэвтрэх рүү", () => {
  withEnv({ SITE_URL: "https://ai.mn", OLD_HOSTS: undefined }, () => {
    const res = middleware(req("https://ai.mn/profile", { host: "ai.mn" }));
    assert.equal(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/nevtreh?ur=%2Fprofile"));
  });
});

test("/admin — ADMIN_PASSWORD байхгүй бол 503", () => {
  withEnv({ SITE_URL: "https://ai.mn", OLD_HOSTS: undefined, ADMIN_PASSWORD: undefined }, () => {
    const res = middleware(req("https://ai.mn/admin", { host: "ai.mn" }));
    assert.equal(res.status, 503);
  });
});

test("/admin — нууц үг буруу бол 401", () => {
  withEnv({ SITE_URL: "https://ai.mn", OLD_HOSTS: undefined, ADMIN_PASSWORD: "s3cret" }, () => {
    // btoa нь зөвхөн latin1 — Basic auth-ийн header ч мөн адил
    const bad = middleware(
      req("https://ai.mn/admin", { host: "ai.mn", authorization: `Basic ${btoa("admin:wrong")}` }),
    );
    assert.equal(bad.status, 401);

    const ok = middleware(
      req("https://ai.mn/admin", { host: "ai.mn", authorization: `Basic ${btoa("admin:s3cret")}` }),
    );
    assert.notEqual(ok.status, 401);
  });
});

test("/api — минутад 60 хүсэлт, 61 дэх нь 429", () => {
  withEnv({ SITE_URL: "https://ai.mn", OLD_HOSTS: undefined }, () => {
    const ip = `9.9.9.${Math.floor(Math.random() * 250) + 1}`;
    let last;
    for (let i = 0; i < 60; i++) {
      last = middleware(req("https://ai.mn/api/search?q=a", { host: "ai.mn", "x-forwarded-for": ip }));
      assert.notEqual(last.status, 429, `${i + 1} дэх хүсэлт`);
    }
    assert.equal(last!.headers.get("RateLimit-Remaining"), "0");

    const blocked = middleware(
      req("https://ai.mn/api/search?q=a", { host: "ai.mn", "x-forwarded-for": ip }),
    );
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers.get("Retry-After"));
  });
});

test("/api/og, /api/health зэрэг нь хязгаараас чөлөөтэй", () => {
  withEnv({ SITE_URL: "https://ai.mn", OLD_HOSTS: undefined }, () => {
    const ip = "8.8.8.8";
    for (let i = 0; i < 200; i++) {
      const res = middleware(req("https://ai.mn/api/og/x", { host: "ai.mn", "x-forwarded-for": ip }));
      assert.notEqual(res.status, 429);
    }
  });
});

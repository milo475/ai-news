import { test } from "node:test";
import assert from "node:assert/strict";
import {
  articleLink, BASE_HASHTAGS, buildPost, DEFAULT_POSTS_PER_RUN, hashtagOf, hashtagsFor,
  leadOf, MAX_ATTEMPTS, postsPerRun, sentences,
} from "./facebook.api";

test("postsPerRun: анхдагч 1, env-ээр өөрчилнө", () => {
  assert.equal(DEFAULT_POSTS_PER_RUN, 1);
  assert.equal(postsPerRun({}), 1);
  assert.equal(postsPerRun({ FB_POSTS_PER_RUN: "2" }), 2);
  assert.equal(postsPerRun({ FB_POSTS_PER_RUN: "0" }), 0);          // алхам алгасагдана
  assert.equal(postsPerRun({ FB_POSTS_PER_RUN: "" }), 1);
  assert.equal(postsPerRun({ FB_POSTS_PER_RUN: "хоёр" }), 1);       // буруу утга = анхдагч
  assert.equal(postsPerRun({ FB_POSTS_PER_RUN: "-3" }), 1);
});

test("MAX_ATTEMPTS: 3 удаа алдсаныг дараалалаас гаргана", () => {
  assert.equal(MAX_ATTEMPTS, 3);
  const queued = (fbAttempts: number) => fbAttempts < MAX_ATTEMPTS;
  assert.equal(queued(0), true);
  assert.equal(queued(2), true);
  assert.equal(queued(3), false);
});

test("sentences / leadOf: 2–3 өгүүлбэр, дутвал биетээс нөхнө", () => {
  assert.deepEqual(sentences("Нэг. Хоёр! Гурав?"), ["Нэг.", "Хоёр!", "Гурав?"]);

  // Хураангуй 2 өгүүлбэртэй бол биетээс нэгийг нэмж 3 болгоно
  const lead = leadOf(
    "OpenAI шинэ модель танилцууллаа. Энэ нь өмнөхөөсөө хурдан.",
    "**OpenAI** шинэ модель танилцууллаа. Үнэ нь хоёр дахин хямд боллоо. Гуравдахь өгүүлбэр.",
  );
  assert.equal(
    lead,
    "OpenAI шинэ модель танилцууллаа. Энэ нь өмнөхөөсөө хурдан. Үнэ нь хоёр дахин хямд боллоо.",
  );

  // Markdown тэмдэглэгээ постод орохгүй
  assert.ok(!leadOf(null, "## Гарчиг\n\n[холбоос](https://a.mn) дээр **тод**.").includes("*"));

  // Хураангуйг биетийн эхний өгүүлбэрт давтсан бол дахин бичихгүй
  assert.equal(
    leadOf(
      "OpenAI хуулийн салбарт зориулсан шийдлээ танилцууллаа.",
      "OpenAI хууль эрх зүйн салбарт зориулсан шийдлээ танилцууллаа. Үнэ нь сард 200 доллар.",
    ),
    "OpenAI хуулийн салбарт зориулсан шийдлээ танилцууллаа. Үнэ нь сард 200 доллар.",
  );
});

test("hashtagOf / hashtagsFor: #AI #ХиймэлОюун + модель/компани", () => {
  assert.equal(hashtagOf("GPT-6 Astra"), "#GPT6Astra");
  assert.equal(hashtagOf("OpenAI"), "#OpenAI");
  assert.equal(hashtagOf("  "), null);
  assert.equal(hashtagOf("---"), null);

  assert.deepEqual(hashtagsFor([], []), BASE_HASHTAGS);
  assert.deepEqual(hashtagsFor(["Claude Fable 5.1"], ["Anthropic"]), ["#AI", "#ХиймэлОюун", "#ClaudeFable51"]);
  assert.deepEqual(hashtagsFor([], ["Google"]), ["#AI", "#ХиймэлОюун", "#Google"]);
});

test("buildPost: гарчиг + lead + холбоос + hashtag", () => {
  const post = buildPost({
    titleMn: "OpenAI GPT-6 Astra-г танилцууллаа",
    summaryMn: "Шинэ модель өмнөхөөсөө хоёр дахин хурдан. Үнэ нь мөн буурчээ.",
    bodyMn: "Дэлгэрэнгүй нь ийм.",
    link: articleLink("openai-gpt-6-astra", "https://ainews.mn/"),
    modelNames: ["GPT-6 Astra"],
    companyNames: ["OpenAI"],
  });

  assert.equal(
    post,
    [
      "OpenAI GPT-6 Astra-г танилцууллаа",
      "",
      "Шинэ модель өмнөхөөсөө хоёр дахин хурдан. Үнэ нь мөн буурчээ. Дэлгэрэнгүй нь ийм.",
      "",
      "👉 https://ainews.mn/medee/openai-gpt-6-astra",
      "",
      "#AI #ХиймэлОюун #GPT6Astra",
    ].join("\n"),
  );
});

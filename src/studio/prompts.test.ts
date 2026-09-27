import assert from "node:assert/strict";
import test from "node:test";
import {
  answeredFields, askedAlready, briefUser, BRIEF_FIELDS, BRIEF_SCHEMA, DECIDE_OPTION,
  emptyFields, FREE_OPTION, isDecide, orderDirections, questionUser, withExtras,
  type StudioBrief, type StudioDirection,
} from "./prompts.api";

test("сонголтод «Та шийд» ба «Өөрөө бичих» нэмэгдэнэ", () => {
  const out = withExtras(["дулаан", "албан ёсны", " "]);
  assert.deepEqual(out, ["дулаан", "албан ёсны", DECIDE_OPTION, FREE_OPTION]);
});

test("давхардсан сонголт нэг л удаа", () => {
  assert.deepEqual(withExtras([DECIDE_OPTION, "а"]), [DECIDE_OPTION, "а", FREE_OPTION]);
});

test("«Та шийд» гэдгийг таана", () => {
  assert.equal(isDecide(DECIDE_OPTION), true);
  assert.equal(isDecide(" дулаан "), false);
});

test("хариулсан талбарууд — хоосныг тооцохгүй", () => {
  assert.deepEqual(answeredFields({ goal: "зар", tone: "  ", audience: "залуус" }), ["goal", "audience"]);
});

test("дахин асуухыг хориглох жагсаалт нь асуусан + хариулсны нэгдэл", () => {
  const asked = askedAlready(
    [[{ field: "goal", question: "?", options: [] }]],
    { tone: "дулаан" },
  );
  assert.deepEqual(asked.sort(), ["goal", "tone"]);
});

test("мэдэгдсэн талбарыг prompt-д «БҮҮ АСУУ» гэж дамжуулна", () => {
  const u = questionUser({ request: "видео", format: "VIDEO", known: ["goal", "tone"], round: 0 });
  assert.match(u, /БҮҮ АСУУ/);
  assert.match(u, /goal, tone/);
  assert.match(u, /Раунд: 1\/2/);
});

test("мэдэгдсэн зүйл байхгүй бол «БҮҮ АСУУ» мөр гарахгүй", () => {
  const u = questionUser({ request: "видео", format: "VIDEO", known: [], round: 0 });
  assert.ok(!u.includes("БҮҮ АСУУ"));
});

test("«Та шийд» хариултыг brief-ийн prompt-д бичихгүй", () => {
  const u = briefUser({
    request: "зар", format: "IMAGE", aspect: "4:5",
    answers: { tone: DECIDE_OPTION, audience: "залуу эцэг эхчүүд" },
  });
  assert.ok(!u.includes(DECIDE_OPTION));
  assert.match(u, /залуу эцэг эхчүүд/);
  assert.match(u, /Харьцаа: 4:5/);
});

test("чиглэлүүд safe → creative → bold дарааллаар", () => {
  const list: StudioDirection[] = [
    { key: "bold", title: "б", idea: "", why: "" },
    { key: "safe", title: "а", idea: "", why: "" },
  ];
  assert.deepEqual(orderDirections(list).map((d) => d.key), ["safe", "bold"]);
});

test("brief-ийн хоосон талбарыг илрүүлнэ", () => {
  const partial: Partial<StudioBrief> = { goal: "зар", audience: " " };
  const empty = emptyFields(partial);
  assert.ok(empty.includes("audience"));
  assert.ok(!empty.includes("goal"));
  assert.equal(empty.length, BRIEF_FIELDS.length - 1);
});

test("brief схем бүх талбарыг шаардана", () => {
  assert.deepEqual(BRIEF_SCHEMA.required, BRIEF_FIELDS);
  assert.equal(BRIEF_SCHEMA.additionalProperties, false);
});

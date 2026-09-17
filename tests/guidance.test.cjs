const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const guides = require("../app/src/main/assets/exercise-guidance.js");
const entries = JSON.parse(
  fs
    .readFileSync("app/src/main/assets/catalog.js", "utf8")
    .replace(/^window\.MOVEMENTS\s*=\s*/, "")
    .replace(/;\s*$/, ""),
);

test("80 个常用动作各有发力、要点和误区，说明不会错绑旧动作或遗漏变式", () => {
  assert.deepEqual(Object.keys(guides).sort(), entries.map((e) => e.id).sort());
  const distinct = new Set();
  for (const e of entries) {
    const g = guides[e.id];
    assert.equal(g.steps.length, 3, e.name);
    assert.equal(g.mistakes.length, 2, e.name);
    for (const text of [g.focus, ...g.steps, ...g.mistakes]) {
      assert.equal(typeof text, "string", e.name);
      assert.ok(text.trim().length >= 8 && text.length <= 180, e.name);
    }
    distinct.add(JSON.stringify(g));
  }
  assert.equal(distinct.size, 80, "变式须有对应说明，不能用整段通用话术替代");
});

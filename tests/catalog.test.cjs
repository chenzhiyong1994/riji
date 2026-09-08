const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const assets = path.resolve(__dirname, "../app/src/main/assets");
const text = fs.readFileSync(path.join(assets, "catalog.js"), "utf8");
const entries = JSON.parse(
  text.replace(/^window\.MOVEMENTS\s*=\s*/, "").replace(/;\s*$/, ""),
);
test("精简库仅保留 80 个常用动作，旧编号与记录方式保留且无旧配图引用", () => {
  assert.equal(entries.length, 80);
  const legacy = JSON.parse(
    fs
      .readFileSync(path.join(assets, "legacy-catalog.js"), "utf8")
      .replace(/^[\s\S]*?window\.LEGACY_MOVEMENTS\s*=\s*/, "")
      .replace(/;\s*$/, ""),
  );
  const all = [...entries, ...legacy];
  assert.equal(all.length, 1191);
  assert.equal(new Set(all.map((e) => e.id)).size, 1191);
  assert.equal(legacy.find((e) => e.id === "plan-king").mode, "weight");
  assert.equal(entries.find((e) => e.id === "plank_recorder").mode, "time");
  assert.ok(
    !entries.some((e) => /泽奇|杰弗森|颈后|Tabata|TRX|布拉德福德/.test(e.name)),
  );
  for (const id of [
    "benchpress",
    "squat",
    "pulldown",
    "romaniadeadlift",
    "sit_cable_row",
    "shoulderpress",
    "dumbbellcurl",
    "vbar_pulldown",
  ])
    assert.ok(
      entries.some((e) => e.id === id),
      `缺少常用动作 ${id}`,
    );
  for (const e of all) {
    assert.ok(e.name && e.category);
    for (const field of ["image", "thumb", "media"])
      assert.equal(e[field], undefined, e.id + ":" + field);
  }
  assert.equal(entries.find((e) => e.id === "benchpress").name, "杠铃卧推");
  assert.equal(
    entries.find(
      (e) => e.id === "21411301-Walk-Elliptical-Cross-Trainer_Cardio_180",
    ).mode,
    "time",
  );
});

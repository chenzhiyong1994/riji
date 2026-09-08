const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const assets = path.resolve(__dirname, "../app/src/main/assets");
const text = fs.readFileSync(path.join(assets, "catalog.js"), "utf8");
const entries = JSON.parse(
  text.replace(/^window\.MOVEMENTS\s*=\s*/, "").replace(/;\s*$/, ""),
);
test("精简库仅保留 80 个常用动作，旧编号仍可解析且配图许可不丢失", () => {
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
  assert.equal(entries.filter((e) => e.image).length, 31);
  assert.equal(all.filter((e) => e.image).length, 32);
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
    if (!e.image) {
      assert.equal(e.thumb, undefined);
      assert.equal(e.media, undefined);
      continue;
    }
    for (const field of ["image", "thumb"]) {
      assert.match(e[field], /^movements\/repdb-[a-z0-9-]+\.webp$/);
      assert.ok(
        fs.statSync(path.join(assets, e[field])).size > 0,
        e.name + ":" + field,
      );
    }
  }
  assert.equal(entries.find((e) => e.id === "benchpress").name, "杠铃卧推");
  assert.match(
    entries.find((e) => e.id === "benchpress").image,
    /repdb-bench-press/,
  );
  assert.equal(
    entries.find((e) => e.id === "incline-benchpress").image,
    undefined,
  );
  assert.equal(
    entries.find(
      (e) => e.id === "21411301-Walk-Elliptical-Cross-Trainer_Cardio_180",
    ).mode,
    "time",
  );
});

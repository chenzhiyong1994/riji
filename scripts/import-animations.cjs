// 将本项目制作的候选动图按现役动作 ID 导入，保留原目录和训练数据。
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const assets = path.join(root, "app/src/main/assets");
const source = path.join(root, "art/exercise-library");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const context = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(assets, "catalog.js"), "utf8"),
  context,
);
const specs = read(path.join(source, "specs.json"));
const production = read(path.join(source, "production-validation.json"));
assert.equal(production.complete, true);
assert.equal(specs.length, 80);
assert.equal(
  JSON.stringify(specs.map((s) => s.id)),
  JSON.stringify(context.window.MOVEMENTS.map((e) => e.id)),
);
const catalog = {},
  files = [],
  copies = [];
for (const spec of specs) {
  assert.match(spec.slug, /^[a-z0-9_-]+$/);
  const folder = path.join(source, "output", spec.slug);
  const record = read(path.join(folder, "validation.json"));
  assert.equal(record.id, spec.id);
  assert.equal(record.animation.frames, 72);
  assert.equal(record.animation.durationMs, 3000);
  const media = {
    index: spec.index,
    source: "Riji / MakeHuman CC0",
    review: "pending",
  };
  for (const kind of ["animation", "poster", "thumb"]) {
    const bytes = fs.readFileSync(path.join(folder, kind + ".webp"));
    assert.equal(sha(bytes), record[kind].sha256);
    assert.equal(bytes.length, record[kind].bytes);
    const target = `animations/${spec.slug}/${kind}.webp`;
    media[kind] = target;
    files.push({
      path: target,
      exerciseId: spec.id,
      kind,
      sha256: sha(bytes),
      size: bytes.length,
    });
    copies.push({ target, bytes });
  }
  catalog[spec.id] = media;
}
const licensePath = "licenses/makehuman-cc0.txt";
const license = fs.readFileSync(
  path.join(
    root,
    "art/muscle-preview/refined-curl/source/makehuman/LICENSE.ASSETS.md",
  ),
);
copies.push({ target: licensePath, bytes: license });
// 全部来源校验成功后才写入；不移除既有静态图，也不改写动作及备份格式。
for (const { target, bytes } of copies) {
  const file = path.join(assets, target);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}
fs.writeFileSync(
  path.join(assets, "animation-catalog.js"),
  "window.EXERCISE_ANIMATIONS = " + JSON.stringify(catalog, null, 2) + ";\n",
);
fs.writeFileSync(
  path.join(assets, "animation-manifest.json"),
  JSON.stringify(
    {
      version: 1,
      count: 80,
      poseAcceptance: "pending_user_review",
      sourceRevision: production.sourceRevision,
      sourceManifestSha256: production.sourceManifestSha256,
      license: "CC0-1.0 (MakeHuman core graphics assets)",
      licensePath,
      licenseSha256: sha(license),
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    imported: 80,
    files: files.length,
    bytes: files.reduce((n, f) => n + f.size, 0),
  }),
);

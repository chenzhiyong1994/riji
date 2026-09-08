const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const removed = new Set(require("./fixtures/removed-media-sha256.json").sha256);
const assets = path.resolve(__dirname, "../app/src/main/assets");

test("安装包资源不再包含从原 APK 提取的图片或动画", () => {
  const found = [];
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) walk(file);
      else if (/\.(gif|webp|png|jpe?g|mp4)$/i.test(item.name)) {
        const sha = crypto
          .createHash("sha256")
          .update(fs.readFileSync(file))
          .digest("hex");
        if (removed.has(sha)) found.push(path.relative(assets, file));
      }
    }
  }
  walk(assets);
  assert.equal(
    found.length,
    0,
    `仍包含 ${found.length} 份原版媒体，首个：${found[0]}`,
  );
});

test("每张配图均对应固定来源、完整许可及未修改的原图指纹", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(assets, "media-manifest.json"), "utf8"),
  );
  const entries = JSON.parse(
    fs
      .readFileSync(path.join(assets, "catalog.js"), "utf8")
      .replace(/^window\.MOVEMENTS\s*=\s*/, "")
      .replace(/;\s*$/, ""),
  );
  entries.push(
    ...JSON.parse(
      fs
        .readFileSync(path.join(assets, "legacy-catalog.js"), "utf8")
        .replace(/^[\s\S]*?window\.LEGACY_MOVEMENTS\s*=\s*/, "")
        .replace(/;\s*$/, ""),
    ),
  );
  const sha256 = (file) =>
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(assets, file)))
      .digest("hex");
  assert.equal(manifest.matches.length, 32);
  assert.equal(manifest.files.length, 61);
  assert.match(
    manifest.licenseUrl,
    /RepDB\/exercise-dataset\/blob\/[a-f0-9]{40}\/LICENSE-DATA\.md$/,
  );
  assert.equal(sha256("licenses/repdb-free-tier.md"), manifest.licenseSha256);
  const registered = new Set(manifest.files.map((file) => file.path));
  assert.equal(registered.size, manifest.files.length);
  for (const file of manifest.files) {
    assert.ok(
      file.sourceUrl.startsWith(
        `https://raw.githubusercontent.com/RepDB/exercise-dataset/${manifest.revision}/images/flat/`,
      ),
    );
    assert.equal(sha256(file.path), file.sha256);
    assert.equal(fs.statSync(path.join(assets, file.path)).size, file.size);
  }
  assert.ok(
    manifest.files.reduce((sum, file) => sum + file.size, 0) < 2 * 1024 * 1024,
    "轻量配图应低于 2 MiB",
  );
  const actual = fs
    .readdirSync(path.join(assets, "movements"))
    .map((file) => "movements/" + file);
  assert.deepEqual(
    actual.sort(),
    [...registered].sort(),
    "不得额外打包未登记图片",
  );
  for (const entry of entries.filter((e) => e.image)) {
    const match = manifest.matches.find((m) => m.exerciseId === entry.id);
    assert.ok(match);
    assert.equal(entry.media.source, "RepDB");
    assert.deepEqual(entry.media.poses, match.poses);
    for (const file of [
      entry.image,
      entry.thumb,
      ...entry.media.poses.map((pose) => pose.path),
    ])
      assert.ok(registered.has(file));
  }
});

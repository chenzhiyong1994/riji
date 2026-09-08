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

test("已移除的静态图库不得通过改名或复制重新打包", () => {
  const denied = new Set(
    require("./fixtures/removed-repdb-sha256.json").sha256,
  );
  assert.equal(denied.size, 61);
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) walk(file);
      else {
        assert.doesNotMatch(item.name, /repdb/i, file);
        const bytes = fs.readFileSync(file);
        const sha = crypto.createHash("sha256").update(bytes).digest("hex");
        assert.ok(!denied.has(sha), path.relative(assets, file));
        if (/\.(js|json|html|css|md|txt)$/i.test(file))
          assert.doesNotMatch(bytes.toString("utf8"), /repdb/i, file);
      }
    }
  }
  walk(assets);
  assert.ok(!fs.existsSync(path.join(assets, "media-manifest.json")));
});

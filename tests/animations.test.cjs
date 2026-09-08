const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const assets = path.resolve(__dirname, "../app/src/main/assets");
const source = path.resolve(__dirname, "../art/exercise-library");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

test("80 个现役动作逐一绑定原候选动图；安装包只包含登记媒体", () => {
  const context = { window: {} };
  for (const file of ["catalog.js", "animation-catalog.js"])
    vm.runInNewContext(
      fs.readFileSync(path.join(assets, file), "utf8"),
      context,
    );
  const catalog = context.window.EXERCISE_ANIMATIONS;
  const manifest = read(path.join(assets, "animation-manifest.json"));
  const specs = read(path.join(source, "specs.json"));
  assert.equal(Object.keys(catalog).length, 80);
  assert.equal(manifest.count, 80);
  assert.equal(manifest.files.length, 240);
  assert.equal(manifest.poseAcceptance, "pending_user_review");
  assert.equal(
    JSON.stringify(Object.keys(catalog).sort()),
    JSON.stringify(context.window.MOVEMENTS.map((e) => e.id).sort()),
  );
  const registered = new Map(manifest.files.map((f) => [f.path, f]));
  assert.equal(registered.size, 240);
  const animations = new Set();
  for (const spec of specs) {
    const entry = catalog[spec.id];
    assert.equal(entry.index, spec.index);
    for (const kind of ["animation", "poster", "thumb"]) {
      const file = registered.get(entry[kind]);
      assert.ok(file, spec.id + " " + kind);
      assert.equal(file.exerciseId, spec.id);
      assert.equal(file.kind, kind);
      const bytes = fs.readFileSync(path.join(assets, file.path));
      assert.equal(hash(bytes), file.sha256);
      assert.equal(bytes.length, file.size);
      assert.equal(
        hash(
          fs.readFileSync(
            path.join(source, "output", spec.slug, kind + ".webp"),
          ),
        ),
        file.sha256,
      );
      assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
      let frames = 0,
        duration = 0,
        loop = null;
      for (let offset = 12; offset < bytes.length; ) {
        const chunk = bytes.toString("ascii", offset, offset + 4),
          size = bytes.readUInt32LE(offset + 4);
        if (chunk === "ANIM") loop = bytes.readUInt16LE(offset + 12);
        if (chunk === "ANMF") {
          frames++;
          duration += bytes.readUIntLE(offset + 20, 3);
        }
        offset += 8 + size + (size % 2);
      }
      assert.equal(frames, kind === "animation" ? 72 : 0);
      if (kind === "animation") {
        assert.equal(duration, 3000);
        assert.equal(loop, 0);
        animations.add(file.sha256);
      }
    }
  }
  assert.equal(animations.size, 80);
  assert.equal(
    hash(fs.readFileSync(path.join(assets, manifest.licensePath))),
    manifest.licenseSha256,
  );
  const expected = [...registered.keys()];
  const actual = [];
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) walk(file);
      else if (/\.(gif|webp|png|jpe?g|mp4)$/i.test(file))
        actual.push(path.relative(assets, file).replaceAll("\\", "/"));
    }
  }
  walk(assets);
  assert.deepEqual(actual.sort(), expected.sort());
});

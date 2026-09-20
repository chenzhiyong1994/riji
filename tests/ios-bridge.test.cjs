const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function bridge(reply) {
  const calls = [];
  const window = {
    prompt(name, payload) {
      assert.equal(name, "__RIJI_NATIVE__");
      const request = JSON.parse(payload);
      calls.push(request);
      return reply(request);
    },
  };
  vm.runInNewContext(fs.readFileSync("ios/Riji/native-bridge.js", "utf8"), {
    window,
  });
  return { store: window.NativeStore, calls };
}

test("iOS 保存只有在原生磁盘写入成功后才返回成功，失败不能冒充已保存", () => {
  let persisted = '{"sessions":[]}';
  const { store } = bridge(({ method, value }) => {
    if (method === "load")
      return JSON.stringify({ ok: true, value: persisted });
    if (value.includes("reject"))
      return JSON.stringify({ ok: false, error: "磁盘已满" });
    persisted = value;
    return JSON.stringify({ ok: true, value: true });
  });
  assert.equal(store.load(), persisted);
  assert.equal(store.save('{"sessions":[1]}'), true);
  assert.equal(store.load(), '{"sessions":[1]}');
  assert.throws(() => store.save('{"reject":true}'), /磁盘已满/);
  assert.equal(store.load(), '{"sessions":[1]}');
  assert.throws(() => bridge(() => null).store.save("{}"), /本地存储/);
});

test("iOS 备份内容中的中文、引号和脚本样式文本原样传递", () => {
  const { store, calls } = bridge(() =>
    JSON.stringify({ ok: true, value: null }),
  );
  const backup = '{"name":"日跻\\n\\\"</script>"}';
  store.exportBackup(backup);
  store.importBackup();
  store.setTheme(true);
  assert.deepEqual(calls, [
    { method: "exportBackup", value: backup },
    { method: "importBackup", value: null },
    { method: "setTheme", value: true },
  ]);
});

(() => {
  "use strict";
  // WKUIDelegate acknowledges the atomic write before the shared UI updates.
  function call(method, value = null) {
    const raw = window.prompt(
      "__RIJI_NATIVE__",
      JSON.stringify({ method, value }),
    );
    if (!raw) throw Error("本地存储连接中断，请重新打开 App");
    const result = JSON.parse(raw);
    if (!result.ok) throw Error(result.error || "本地文件操作失败");
    return result.value;
  }
  Object.defineProperty(window, "NativeStore", {
    value: Object.freeze({
      load: () => call("load"),
      save: (value) => call("save", value),
      exportBackup: (value) => call("exportBackup", value),
      importBackup: () => call("importBackup"),
      setTheme: (value) => call("setTheme", value),
    }),
    writable: false,
    configurable: false,
  });
})();

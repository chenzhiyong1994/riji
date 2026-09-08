const { _android } = require("playwright");
const { expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const C = require("../app/src/main/assets/core.js");
(async () => {
  const device = (await _android.devices()).find(
    (d) => d.serial() === (process.env.ANDROID_SERIAL || "emulator-5554"),
  );
  if (!device) throw Error("指定模拟器不在线");
  let page = await (await device.webView({ pkg: "local.jilian.app" })).page();
  const before = await page.evaluate(() => NativeStore.load());
  if (
    before &&
    JSON.stringify(C.restore(before)) !== JSON.stringify(C.initialState())
  )
    throw Error("只在空白测试安装中运行，不覆盖已有训练数据");
  const click = (action) =>
    page.locator(`[data-action="${action}"]`).first().click();
  await click("newWorkout");
  await page.locator("#new-title").fill("NATIVE-QA");
  await click("startWorkout");
  await page.locator('[data-action="pick"][data-id="benchpress"]').click();
  await click("confirmPicker");
  await page.locator('[data-field="weight"]').first().fill("40");
  await page.locator('[data-field="reps"]').first().fill("12");
  await click("toggleSet");
  let saved = JSON.parse(await page.evaluate(() => NativeStore.load()));
  assert.equal(C.workoutStats(saved.active).volume, 480);
  await device.shell("am force-stop local.jilian.app");
  await device.shell("am start -n local.jilian.app/.MainActivity");
  page = await (await device.webView({ pkg: "local.jilian.app" })).page();
  await expect(page.locator('[data-field="weight"]').first()).toHaveValue("40");
  await expect(page.locator(".check.done")).toHaveCount(1);
  await click("finish");
  await click("confirmFinish");
  await page.locator('[data-tab="history"]').click();
  await expect(page.locator(".summary")).toContainText("480");
  await page.screenshot({ path: "qa/android-history.png" });
  saved = JSON.parse(await page.evaluate(() => NativeStore.load()));
  assert.equal(saved.sessions.length, 1);
  assert.equal(saved.sessions[0].exercises[0].sets.length, 1);
  await page.locator('[data-tab="movements"]').click();
  await page.locator('[data-action="detail"][data-id="benchpress"]').click();
  await expect(page.locator(".detail-image").first()).toBeVisible();
  assert.equal(
    await page
      .locator(".detail-image")
      .evaluateAll(
        (images) =>
          images.length > 0 &&
          images.every((e) => e.complete && e.naturalWidth > 0),
      ),
    true,
  );
  await device.shell("input keyevent 4");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const next = C.initialState();
  const ok = await page.evaluate(
    (state) => NativeStore.save(state),
    JSON.stringify(next),
  );
  assert.equal(ok, true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "训练", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "qa/android-clean-home.png" });
  fs.writeFileSync(
    "qa/android-smoke.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "native_save",
          "process_restart_restore",
          "finish_and_statistics",
          "offline_animation",
          "android_back",
          "blank_final_state",
        ],
        device: device.serial(),
      },
      null,
      2,
    ),
  );
  console.log(
    "Android smoke passed: native storage, process restart, offline images, back gesture, clean final state",
  );
  await device.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

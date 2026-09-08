const { test, expect } = require("@playwright/test");
const C = require("../../app/src/main/assets/core.js");
const click = (page, action) =>
  page.locator(`[data-action="${action}"]`).first().click();

test("精简库与旧模版共存，旧动作只在已用旧动作中出现", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tab="movements"]').click();
  await expect(page.locator(".library-summary")).toContainText("80 个常用动作");
  await page.screenshot({ path: "qa/library-compact.png", fullPage: true });
  await page.locator('[data-action="category"][data-value="全部"]').click();
  await page.locator("#movement-search").fill("泽奇");
  await expect(page.locator("#movement-results")).toContainText("没有找到动作");
  const state = C.initialState();
  state.plans = [
    {
      id: "legacy-plan",
      name: "旧版腿训练",
      exerciseIds: ["15451201-Barbell-full-Zercher-Squat_Thighs.gif"],
    },
  ];
  await page.locator("#import-file").setInputFiles({
    name: "迹练旧备份.json",
    mimeType: "application/json",
    buffer: Buffer.from(C.exportBackup(state)),
  });
  await click(page, "applyImport");
  await page
    .locator('[data-action="category"][data-value="已用旧动作"]')
    .click();
  await expect(page.locator("#movement-results")).toContainText("泽奇深蹲");
  await page.locator('[data-tab="training"]').click();
  await page.getByRole("button", { name: /旧版腿训练/ }).click();
  await expect(page.getByRole("dialog")).toContainText("泽奇深蹲");
  await click(page, "startPlan");
  await expect(page.locator(".exercise-card")).toContainText("泽奇深蹲");
  await page.reload();
  await expect(page.locator(".exercise-card")).toContainText("泽奇深蹲");
});

test("自定义动作能编辑、按次数记录、删除并保留训练历史", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/");
  await page.locator('[data-tab="movements"]').click();
  await page.getByRole("button", { name: "自定义动作", exact: true }).click();
  await page.locator("#custom-name").fill("我的台阶训练");
  await page.locator("#custom-category").selectOption("腿");
  await page.locator("#custom-mode").selectOption("reps");
  await page.locator("#custom-notes").fill("台阶第 2 档，左右交替");
  await page.screenshot({ path: "qa/library-custom.png", fullPage: true });
  await click(page, "saveCustom");
  await page.getByRole("button", { name: /我的台阶训练.*自重/ }).click();
  await expect(page.getByRole("dialog")).toContainText("台阶第 2 档，左右交替");
  await click(page, "editCustom");
  await page.locator("#custom-name").fill("自定台阶上步");
  await click(page, "saveCustom");
  await page.getByRole("button", { name: /自定台阶上步.*自重/ }).click();
  await page.getByRole("dialog").locator('[data-action="quickAdd"]').click();
  await expect(page.locator('[data-field="weight"]')).toHaveCount(0);
  await page.locator('[data-field="reps"]').first().fill("12");
  await click(page, "toggleSet");
  await click(page, "finish");
  await click(page, "confirmFinish");
  await page.locator('[data-tab="movements"]').click();
  await page.getByRole("button", { name: /自定台阶上步.*自重/ }).click();
  await expect(page.getByRole("dialog")).toContainText("12");
  await click(page, "editCustom");
  await expect(page.locator("#custom-mode")).toBeDisabled();
  await page.locator("#custom-name").fill("我的新名称");
  await click(page, "saveCustom");
  await page.getByRole("button", { name: /我的新名称.*自重/ }).click();
  await click(page, "deleteCustom");
  await click(page, "confirmDeleteCustom");
  await expect(page.locator("#movement-results")).not.toContainText(
    "我的新名称",
  );
  await page.reload();
  await page.locator('[data-tab="history"]').click();
  await expect(page.locator(".history-item")).toContainText("自定台阶上步");
  await page.locator(".history-item").first().click();
  await expect(page.locator(".saved-set")).toContainText("12 次");
  await expect(page.locator(".saved-set")).not.toContainText("kg");
  await click(page, "close");
  await page.locator('[data-tab="movements"]').click();
  await page.locator('[data-action="category"][data-value="已删除"]').click();
  await page.getByRole("button", { name: /我的新名称.*自重/ }).click();
  await click(page, "restoreCustom");
  await click(page, "close");
  await page.locator('[data-action="category"][data-value="自定义"]').click();
  await expect(page.locator("#movement-results")).toContainText("我的新名称");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("选动作时能直接新建计时动作，返回和保存都保留已选项", async ({ page }) => {
  await page.goto("/");
  await click(page, "newWorkout");
  await click(page, "startWorkout");
  await page.locator('[data-action="pick"][data-id="benchpress"]').click();
  await click(page, "customFromPicker");
  await click(page, "close");
  await expect(page.locator("#confirm-picker")).toHaveText("添加已选（1）");
  await click(page, "customFromPicker");
  await page.locator("#custom-name").fill("我的耐力保持");
  await page.locator("#custom-category").selectOption("核心");
  await page.locator("#custom-mode").selectOption("time");
  await page.locator("#custom-notes").fill("<保持> 30 秒\n保持自己的节奏");
  await click(page, "saveCustom");
  await expect(page.locator("#confirm-picker")).toHaveText("添加已选（2）");
  await click(page, "confirmPicker");
  await expect(page.locator(".exercise-card")).toHaveCount(2);
  const customCard = page.locator(".exercise-card").nth(1);
  await expect(customCard.locator('[data-field="weight"]')).toHaveCount(0);
  await customCard.locator('[data-field="seconds"]').first().fill("30");
  await customCard.locator('[data-action="toggleSet"]').first().click();
  await page.reload();
  await expect(page.locator('[data-field="seconds"]').first()).toHaveValue(
    "30",
  );
  await page
    .locator(".exercise-card")
    .nth(1)
    .locator('[data-action="detail"]')
    .click();
  await expect(page.locator(".exercise-notes")).toContainText("<保持> 30 秒");
  await expect(page.locator(".exercise-notes img")).toHaveCount(0);
});

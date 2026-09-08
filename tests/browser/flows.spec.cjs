const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const click = (p, a) => p.locator(`[data-action="${a}"]`).first().click();
test("训练记录、重启恢复、统计及备份可完整往返", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const external = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:8766") &&
      !r.url().startsWith("blob:")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "训练", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "qa/01-training.png", fullPage: true });
  await click(page, "newWorkout");
  await page.locator("#new-title").fill("测试推训练");
  await click(page, "startWorkout");
  await page.locator("#picker-search").fill("杠铃卧推");
  await page.locator('[data-action="pick"][data-id="benchpress"]').click();
  await click(page, "confirmPicker");
  await page.locator('[data-field="weight"]').nth(0).fill("60");
  await page.locator('[data-field="reps"]').nth(0).fill("10");
  await page.locator('[data-action="toggleSet"]').nth(0).click();
  await page.locator('[data-field="weight"]').nth(1).fill("70");
  await page.locator('[data-field="reps"]').nth(1).fill("8");
  await page.locator('[data-action="toggleSet"]').nth(1).click();
  await page.locator('[data-field="weight"]').nth(2).fill("999");
  await page.locator('[data-field="reps"]').nth(2).click();
  await click(page, "addSet");
  await expect(page.locator('[data-field="weight"]')).toHaveCount(4);
  await expect(page.locator('[data-field="weight"]').nth(3)).toHaveValue("999");
  await page.locator('[data-action="removeSet"]').nth(3).click();
  await expect(page.locator(".rest-bar")).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-field="weight"]').nth(0)).toHaveValue("60");
  await expect(page.locator(".check.done")).toHaveCount(2);
  await page.screenshot({ path: "qa/02-workout.png", fullPage: true });
  await click(page, "finish");
  await click(page, "confirmFinish");
  await expect(page.getByText("测试推训练", { exact: true })).toBeVisible();
  await page.locator('[data-tab="history"]').click();
  await expect(page.locator(".summary")).toContainText("1,160");
  await page.screenshot({ path: "qa/03-history.png", fullPage: true });
  await click(page, "stats");
  await expect(page.getByRole("dialog")).toContainText("70 kg");
  await click(page, "close");
  await page.locator('[data-tab="me"]').click();
  await page.screenshot({ path: "qa/04-me.png", fullPage: true });
  const downloadPromise = page.waitForEvent("download");
  await click(page, "export");
  const download = await downloadPromise;
  const text = fs.readFileSync(await download.path(), "utf8"),
    backup = JSON.parse(text);
  expect(backup.data.sessions[0].exercises[0].sets).toHaveLength(2);
  await page.locator("#import-file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await expect(page.getByRole("dialog", { name: "导入备份" })).toBeVisible();
  await click(page, "applyImport");
  await page.reload();
  await page.locator('[data-tab="history"]').click();
  await expect(page.locator(".summary")).toContainText("1,160");
  const before = await page.evaluate(() =>
    localStorage.getItem("jilian-state"),
  );
  await page.locator("#import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"jilian-backup","version":1,"data":{}}'),
  });
  await expect(page.locator("#toast")).toContainText("备份");
  expect(await page.evaluate(() => localStorage.getItem("jilian-state"))).toBe(
    before,
  );
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("动作搜索、离线演示、收藏、自定义动作与模版编辑", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('[data-tab="movements"]').click();
  await page.locator("#movement-search").fill("卧推");
  await page.screenshot({ path: "qa/05-movements.png", fullPage: true });
  await page.locator('[data-action="detail"][data-id="benchpress"]').click();
  await expect(page.locator(".detail-image")).toHaveCount(1);
  await expect(page.locator(".detail-image").first()).toBeVisible();
  expect(
    await page
      .locator(".detail-image")
      .evaluateAll((images) =>
        images.every((e) => e.complete && e.naturalWidth > 0),
      ),
  ).toBe(true);
  await page.screenshot({ path: "qa/06-detail.png", fullPage: true });
  await click(page, "favorite");
  await expect(page.getByRole("dialog")).toContainText("已收藏");
  await click(page, "close");
  await click(page, "customExercise");
  await page.locator("#custom-name").fill("测试自定义动作");
  await click(page, "saveCustom");
  await expect(page.locator("#movement-results")).toContainText(
    "测试自定义动作",
  );
  await page.reload();
  await page.locator('[data-tab="movements"]').click();
  await page.locator('[data-action="category"][data-value="自定义"]').click();
  await expect(page.locator("#movement-results")).toContainText(
    "测试自定义动作",
  );
  await page.locator('[data-tab="training"]').click();
  await click(page, "newPlan");
  await page.locator("#plan-name").fill("我的推训练");
  await click(page, "planPicker");
  await page.locator('[data-action="pick"][data-id="benchpress"]').click();
  await page
    .locator('[data-action="pick"][data-id="incline-benchpress"]')
    .click();
  await click(page, "confirmPicker");
  await click(page, "savePlan");
  await page.getByRole("button", { name: /我的推训练/ }).click();
  await click(page, "editPlan");
  await click(page, "planUp");
  await click(page, "savePlan");
  await page.getByRole("button", { name: /我的推训练/ }).click();
  await click(page, "startPlan");
  await expect(page.locator(".exercise-card")).toHaveCount(2);
  await expect(page.locator(".exercise-card").first()).toContainText(
    "上斜杠铃卧推",
  );
  await page.locator('[data-tab="me"]').click();
  await click(page, "theme");
  await expect(page.locator("body")).toHaveClass("light");
  await page.screenshot({ path: "qa/07-light.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("小屏布局无横向溢出，身体数据可保存和删除", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  for (const tab of ["training", "movements", "history", "me"]) {
    await page.locator(`[data-tab="${tab}"]`).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await click(page, "body");
  await page.locator("#body-weight").fill("70.5");
  await page.locator("#body-waist").fill("82");
  await click(page, "saveBody");
  await expect(page.getByRole("dialog")).toContainText("70.5 kg");
  await click(page, "deleteBody");
  await click(page, "confirmDeleteBody");
  await expect(page.getByRole("dialog")).not.toContainText("70.5 kg");
});

const { test, expect } = require("@playwright/test");
const click = (page, action) =>
  page.locator(`[data-action="${action}"]`).first().click();

test("按经验目标筛选模板，添加多日计划并修改，重启与备份后按目标开始", async ({
  page,
}) => {
  await page.goto("/");
  await click(page, "templates");
  await page.getByLabel("训练经验").selectOption("入门");
  await page.getByLabel("训练目标").selectOption("建立习惯");
  await expect(page.locator(".program-card")).toHaveCount(2);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /健身房入门/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("全身 B");
  await click(page, "addProgram");
  await expect(
    page.getByRole("dialog", { name: "已添加到我的计划" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /编辑 全身 A/ }).click();
  await page.getByLabel("计划名称").fill("我的入门 A");
  await page.getByLabel("计划说明").fill("周一训练，先热身");
  await page.getByLabel("腿举 组数").fill("3");
  await page.getByLabel("腿举 次数").fill("8");
  await page.getByLabel("腿举 休息秒数").fill("120");
  await click(page, "planUp");
  await click(page, "savePlan");
  await page.reload();
  await page.getByRole("button", { name: /我的入门 A/ }).click();
  await expect(page.getByRole("dialog")).toContainText("3 组 × 8 次");
  await click(page, "startPlan");
  await expect(page.locator(".exercise-card").first()).toContainText(
    "器械推胸",
  );
  const leg = page.locator(".exercise-card").filter({ hasText: "腿举" });
  await expect(leg.locator('[data-field="reps"]')).toHaveCount(3);
  await expect(leg.locator('[data-field="reps"]').first()).toHaveValue("8");
  await leg.locator('[data-action="toggleSet"]').first().click();
  await expect(page.locator(".rest-bar")).toContainText("02:00");
  await page.reload();
  await expect(page.locator("#workout-notes")).toHaveValue("周一训练，先热身");
  await page.locator('[data-tab="me"]').click();
  const downloaded = page.waitForEvent("download");
  await click(page, "export");
  const file = await downloaded;
  await page.locator("#import-file").setInputFiles(await file.path());
  await click(page, "applyImport");
  await page.reload();
  await expect(page.locator(".check.done")).toHaveCount(1);
  await click(page, "templates");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /健身房入门/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("2 组 × 10 次");
  await click(page, "addProgram");
  await click(page, "close");
  await expect(
    page.getByRole("button", { name: /健身房入门 · 全身 B \(2\)/ }),
  ).toBeVisible();
  await expect(page.locator(".check.done")).toHaveCount(1);
});

test("模板筛选空状态可重置，窄屏与浅色布局可用，取消编辑不保存", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page.locator('[data-tab="me"]').click();
  await click(page, "theme");
  await page.locator('[data-tab="training"]').click();
  await click(page, "templates");
  await page.getByLabel("训练经验").selectOption("进阶");
  await page.getByLabel("训练目标").selectOption("建立习惯");
  await expect(page.getByText("没有符合条件的模板")).toBeVisible();
  await click(page, "resetTemplateFilters");
  await expect(page.locator(".program-card")).toHaveCount(8);
  await page.screenshot({ path: "qa/templates-light-320.png" });
  await page.getByRole("button", { name: /居家徒手起步/ }).click();
  await page.screenshot({ path: "qa/template-detail-light-320.png" });
  await click(page, "addProgram");
  await page.getByRole("button", { name: /编辑 基础活动/ }).click();
  await page.getByLabel("平板支撑 秒数").fill("25");
  await click(page, "planPicker");
  await click(page, "confirmPicker");
  await expect(page.getByLabel("平板支撑 秒数")).toHaveValue("25");
  await page.screenshot({ path: "qa/plan-edit-light-320.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".sheet")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await click(page, "close");
  await page.getByRole("button", { name: /居家徒手起步 · 基础活动/ }).click();
  await expect(page.getByRole("dialog")).toContainText("2 组 × 20 秒");
});

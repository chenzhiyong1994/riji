const { test, expect } = require("@playwright/test");

test("常用动作显示本地动画；自定义动作使用缺省图且可完成训练", async ({
  page,
}) => {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/");
  await page.locator('[data-tab="movements"]').click();
  await expect(page.locator(".filter-counter")).toHaveText(
    "12 个动作 · 12 项配图",
  );
  await page.locator('[data-action="detail"][data-id="benchpress"]').click();
  await expect(page.locator(".detail-image")).toHaveCount(1);
  await expect(page.locator(".media-credit")).toContainText("MakeHuman CC0");
  await expect
    .poll(() =>
      page
        .locator(".detail-image")
        .evaluateAll((images) =>
          images.every((image) => image.complete && image.naturalWidth === 768),
        ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "qa/animations-detail-320.png" });
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-action="customExercise"]').click();
  await page.locator("#custom-name").fill("自定义无图动作");
  await page.locator('[data-action="saveCustom"]').click();
  const missing = page.locator('[data-action="detail"][data-id^="custom-"]');
  await expect(missing.locator(".thumb-placeholder")).toHaveCount(1);
  await missing.click();
  await expect(page.locator(".media-empty")).toContainText("暂无动作图片");
  await expect(page.locator(".detail-image")).toHaveCount(0);
  await page.screenshot({ path: "qa/lightweight-placeholder.png" });
  await page.getByRole("dialog").locator('[data-action="quickAdd"]').click();
  await expect(page.locator(".exercise-card")).toContainText("自定义无图动作");
  await page.locator('[data-field="weight"]').first().fill("20");
  await page.locator('[data-action="toggleSet"]').first().click();
  await page.locator('[data-action="finish"]').click();
  await page.locator('[data-action="confirmFinish"]').click();
  await page.reload();
  await page.locator('[data-tab="history"]').click();
  await expect(page.locator(".summary")).toContainText("200");
  await expect(page.locator(".history-item")).toContainText("自定义无图动作");
  await page.locator('[data-tab="me"]').click();
  await page.locator('[data-action="about"]').click();
  await expect(page.getByRole("dialog")).toContainText(
    "80 个动作已配备离线动画",
  );
  await expect(page.getByRole("dialog")).toContainText(
    "RepDB Free Tier License v1.0",
  );
  expect(failures).toEqual([]);
});

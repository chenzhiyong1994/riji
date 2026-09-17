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
  await expect(page.locator(".media-credit")).toHaveText(
    "动画仅作示意，可能存在变形。请对照动作要点，不要模仿异常关节角度或器械位置。",
  );
  await expect(page.getByRole("dialog")).not.toContainText(/RepDB|MakeHuman/i);
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
  await expect(page.getByRole("dialog")).not.toContainText(/RepDB|MakeHuman/i);
  await page.screenshot({ path: "qa/remove-repdb/about-1.0.6.png" });
  expect(failures).toEqual([]);
});

test("旧平板支撑复用离线动画，收藏与重量记录保持兼容", async ({ page }) => {
  const C = require("../../app/src/main/assets/core.js");
  const state = C.initialState();
  state.favorites = ["plan-king"];
  const stored = JSON.stringify(state);
  await page.addInitScript(
    (value) => localStorage.setItem("jilian-state", value),
    stored,
  );
  const failedRequests = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(response.url());
  });
  await page.goto("/");
  await page.locator('[data-tab="me"]').click();
  await page.locator('[data-action="showFavorites"]').click();
  await page.locator('[data-action="detail"][data-id="plan-king"]').click();
  await expect(page.locator(".motion-image")).toHaveCount(1);
  const expected = await page.evaluate(
    () => window.EXERCISE_ANIMATIONS.plank_recorder.animation,
  );
  await expect(page.locator(".motion-image")).toHaveAttribute("src", expected);
  await expect
    .poll(() =>
      page
        .locator(".motion-image")
        .evaluate((image) => image.complete && image.naturalWidth === 768),
    )
    .toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("jilian-state"))).toBe(
    stored,
  );
  await page.getByRole("dialog").locator('[data-action="quickAdd"]').click();
  await expect(page.locator('[data-field="weight"]')).toHaveCount(3);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("jilian-state")),
  );
  expect(saved.favorites).toEqual(["plan-king"]);
  expect(saved.active.exercises[0].exerciseId).toBe("plan-king");
  expect(failedRequests).toEqual([]);
});

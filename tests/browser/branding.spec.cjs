const { test, expect } = require("@playwright/test");
const C = require("../../app/src/main/assets/core.js");

async function holdClock(page) {
  await page.clock.install({ time: new Date("2026-09-08T08:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-08T08:00:01Z"));
}

test("欢迎页自动进入训练，保留原数据，页面切换不重复展示", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await holdClock(page);
  const state = C.initialState();
  state.plans = [
    { id: "saved-plan", name: "已有模版", exerciseIds: ["benchpress"] },
  ];
  const stored = JSON.stringify(state);
  await page.addInitScript(
    (value) => localStorage.setItem("jilian-state", value),
    stored,
  );
  await page.goto("/");
  await expect(page.locator("#welcome")).toBeVisible();
  await expect(page.locator("#app")).toHaveAttribute("inert", "");
  expect(
    await page
      .locator(".welcome-emblem img")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  await page.clock.runFor(800);
  await page.screenshot({
    path: "qa/branding-1.0.5/welcome-dark.png",
    animations: "disabled",
  });
  await page.clock.runFor(700);
  await expect(page.locator("#welcome")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "训练", exact: true }),
  ).toBeVisible();
  await page.locator('[data-tab="me"]').click();
  await expect(page.locator("main")).toContainText("累计训练");
  await expect(page.locator("main")).not.toContainText(
    /日跻|RIJI|如月之恒|无需账号/,
  );
  await page.screenshot({
    path: "qa/branding-1.0.5/me-dark.png",
    fullPage: true,
  });
  await page.locator('[data-action="allPlans"]').click();
  await expect(
    page.getByRole("heading", { name: "训练", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /已有模版/ }).click();
  await expect(page.getByRole("dialog")).toContainText("已有模版");
  await page.keyboard.press("Escape");
  await page.locator('[data-tab="training"]').click();
  await expect(page.locator("#welcome")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("jilian-state"))).toBe(
    stored,
  );
  expect(errors).toEqual([]);
});

test("欢迎页可以轻触、键盘或 Android 返回立即跳过，后台恢复不重播", async ({
  page,
}) => {
  await holdClock(page);
  await page.goto("/");
  await page.locator("#welcome").click();
  await expect(page.locator("#welcome")).toHaveCount(0);
  await page.reload();
  await page.locator("#welcome").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#welcome")).toHaveCount(0);
  await page.reload();
  expect(await page.evaluate(() => window.handleBack())).toBe(true);
  await expect(page.locator("#welcome")).toHaveCount(0);
  await page.reload();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#welcome")).toHaveCount(0);
  await expect(page.locator("#app")).not.toHaveAttribute("inert");
});

test("浅色欢迎页尊重减少动态效果，小屏与横屏内容不重叠", async ({ page }) => {
  await holdClock(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const state = C.initialState();
  state.settings.theme = "light";
  await page.addInitScript(
    (value) => localStorage.setItem("jilian-state", value),
    JSON.stringify(state),
  );
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await expect(page.locator("body")).toHaveClass(/\blight\b/);
  await expect(page.locator(".welcome-emblem")).toHaveCSS(
    "animation-name",
    "none",
  );
  for (const [width, height] of [
    [320, 568],
    [812, 375],
  ]) {
    await page.setViewportSize({ width, height });
    const main = await page.locator(".welcome-main").boundingBox();
    const footer = await page.locator(".welcome-footer").boundingBox();
    expect(main.y).toBeGreaterThanOrEqual(0);
    expect(main.y + main.height).toBeLessThan(footer.y);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await page.screenshot({
      path: `qa/branding-1.0.5/welcome-light-${width}.png`,
    });
  }
  await page.clock.runFor(1200);
  await expect(page.locator("#welcome")).toHaveCount(0);
  await page.locator('[data-tab="me"]').click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.screenshot({
    path: "qa/branding-1.0.5/me-light-320.png",
    fullPage: true,
  });
});

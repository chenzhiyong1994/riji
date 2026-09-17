const { test, expect } = require("@playwright/test");
const C = require("../../app/src/main/assets/core.js");

test("动作要点离线展示，窄屏可读，查看说明不改用户数据", async ({ page }) => {
  const external = [],
    errors = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:8766")) external.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator('[data-tab="movements"]').click();
  await page.locator('[data-action="detail"][data-id="benchpress"]').click();
  await expect(page.locator(".media-credit")).toContainText("可能存在变形");
  const guide = page.getByRole("region", { name: "动作要点与误区" });
  await expect(guide).toContainText("拇指环握");
  await expect(guide.getByRole("heading", { name: "常见误区" })).toBeVisible();
  await guide.screenshot({ path: "qa/guidance-bench-dark-320.png" });
  expect(
    await page
      .locator(".detail-scroll")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-action="category"][data-value="有氧"]').click();
  await page
    .locator('[data-action="detail"][data-id="22621301-Rowing-machine"]')
    .click();
  await expect(guide).toContainText("腿先蹬");
  await expect(guide).toContainText("回程先伸臂");
  await page.locator('[data-action="close"]').click();
  expect(
    await page.evaluate(() => localStorage.getItem("jilian-state")),
  ).toBeNull();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("深浅色详情的长内容独立滚动，标题与操作栏始终可用", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const theme of ["dark", "light"]) {
    if (theme === "light") {
      await page.locator('[data-tab="me"]').click();
      await page.locator('[data-action="theme"]').click();
    }
    await page.locator('[data-tab="movements"]').click();
    const stored = await page.evaluate(() =>
      localStorage.getItem("jilian-state"),
    );
    await page.locator('[data-action="detail"][data-id="benchpress"]').click();
    const dialog = page.getByRole("dialog");
    const scroll = page.locator(".detail-scroll");
    const close = dialog.getByRole("button", { name: "关闭", exact: true });
    const add = dialog.getByRole("button", { name: "加入训练", exact: true });
    await expect(add).toHaveCSS("background-color", "rgb(89, 178, 105)");
    for (const [width, height] of [
      [320, 740],
      [412, 850],
      [812, 375],
    ]) {
      await page.setViewportSize({ width, height });
      await scroll.evaluate((el) => {
        el.scrollTop = 0;
      });
      const headerBefore = await page.locator(".sheet-header").boundingBox();
      const footerBefore = await page.locator(".detail-footer").boundingBox();
      const body = await scroll.boundingBox();
      expect(body.y).toBeGreaterThanOrEqual(
        headerBefore.y + headerBefore.height - 1,
      );
      expect(body.y + body.height).toBeLessThanOrEqual(footerBefore.y + 1);
      expect(footerBefore.y + footerBefore.height).toBeLessThanOrEqual(
        height + 1,
      );
      expect(
        await scroll.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: `qa/layout-1.1.2/${theme}-${width}-top.png`,
      });
      await scroll.evaluate((el) => {
        const guide = el.querySelector(".exercise-guide");
        el.scrollTop +=
          guide.getBoundingClientRect().top -
          el.getBoundingClientRect().top -
          20;
      });
      await page.screenshot({
        path: `qa/layout-1.1.2/${theme}-${width}-guide.png`,
      });
      await page.locator(".guide-mistakes").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `qa/layout-1.1.2/${theme}-${width}-mistakes.png`,
      });
      await scroll.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      expect(await page.locator(".sheet-header").boundingBox()).toEqual(
        headerBefore,
      );
      expect(await page.locator(".detail-footer").boundingBox()).toEqual(
        footerBefore,
      );
      for (const control of [close, add]) {
        expect(
          await control.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return el.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            );
          }),
        ).toBe(true);
      }
    }
    await close.click();
    await expect(dialog).toHaveCount(0);
    expect(
      await page.evaluate(() => localStorage.getItem("jilian-state")),
    ).toBe(stored);
  }
  await page.locator('[data-action="detail"][data-id="benchpress"]').click();
  await page.locator(".detail-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "加入训练", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toContainText("杠铃卧推");
});

test("旧平板支撑共用要点，自定义说明保留且不套用内置指导", async ({ page }) => {
  const state = C.initialState();
  state.settings.theme = "light";
  state.favorites = ["plan-king"];
  state.customExercises = [
    {
      id: "custom-guide",
      name: "我的自定义动作——站姿弹力带肩部控制与稳定练习",
      category: "核心",
      equipment: "自重",
      parts: ["核心"],
      mode: "time",
      archived: false,
      notes: "<保持> 呼吸\n按个人安排练习\n".repeat(30),
    },
  ];
  const raw = JSON.stringify(state);
  await page.addInitScript(
    (raw) => localStorage.setItem("jilian-state", raw),
    raw,
  );
  await page.goto("/");
  await page.locator('[data-tab="movements"]').click();
  await page
    .locator('[data-action="category"][data-value="已用旧动作"]')
    .click();
  await page.locator('[data-action="detail"][data-id="plan-king"]').click();
  await expect(page.locator(".exercise-guide")).toContainText("腹部与臀部");
  await page
    .locator(".exercise-guide")
    .screenshot({ path: "qa/guidance-plank-light.png" });
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-action="category"][data-value="自定义"]').click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('[data-action="detail"][data-id="custom-guide"]').click();
  await expect(page.locator(".exercise-guide")).toHaveCount(0);
  await expect(page.locator(".exercise-notes")).toContainText("<保持> 呼吸");
  await expect(page.locator(".exercise-notes img")).toHaveCount(0);
  await page.locator(".detail-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(
    page.getByRole("button", { name: "编辑动作", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "关闭", exact: true }),
  ).toBeInViewport();
  expect(
    await page
      .locator(".detail-scroll")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: "qa/layout-1.1.2/custom-long-320.png" });
  expect(await page.evaluate(() => localStorage.getItem("jilian-state"))).toBe(
    raw,
  );
});

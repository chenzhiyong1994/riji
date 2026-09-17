const { test, expect } = require("@playwright/test");
const crypto = require("node:crypto");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

test("列表只加载缩略图，详情动图真实播放、暂停并在关闭后释放", async ({
  page,
}) => {
  const animations = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/animation.webp"))
      animations.push(request.url());
  });
  await page.goto("/");
  await page.locator('[data-tab="movements"]').click();
  expect(animations).toHaveLength(0);
  await page.locator('[data-action="detail"][data-id="benchpress"]').click();
  const image = page.locator(".motion-image");
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty("naturalWidth", 768);
  const toggle = page.getByRole("button", { name: "暂停动画", exact: true });
  const imageBox = await image.boundingBox();
  const toggleBox = await toggle.boundingBox();
  expect(toggleBox.width).toBeGreaterThanOrEqual(44);
  expect(toggleBox.height).toBeGreaterThanOrEqual(44);
  expect(toggleBox.x).toBeGreaterThanOrEqual(imageBox.x);
  expect(toggleBox.y).toBeGreaterThanOrEqual(imageBox.y);
  expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(
    imageBox.x + imageBox.width,
  );
  expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(
    imageBox.y + imageBox.height,
  );
  await expect(page.locator(".motion-player")).not.toContainText(
    /3 秒循环|红色肌群高亮|静态封面/,
  );
  const first = hash(await image.screenshot());
  await page.waitForTimeout(450);
  expect(hash(await image.screenshot())).not.toBe(first);
  await page.getByRole("button", { name: "暂停动画", exact: true }).click();
  await expect(image).toHaveAttribute("src", /poster\.webp$/);
  await image.evaluate((image) => image.decode());
  const paused = hash(await image.screenshot());
  await page.waitForTimeout(450);
  expect(hash(await image.screenshot())).toBe(paused);
  await page.getByRole("button", { name: "播放动画", exact: true }).click();
  await expect(image).toHaveAttribute("src", /animation\.webp$/);
  await page.evaluate(() => window.pauseExerciseAnimation());
  await expect(image).toHaveAttribute("src", /poster\.webp$/);
  await page.locator('[data-action="close"]').click();
  await expect(image).toHaveCount(0);
  expect(animations.every((url) => url.includes("01-press-flat-barbell"))).toBe(
    true,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("jilian-state")),
  ).toBeNull();
});

test("减少动态效果时显示封面，仍可手动播放；80 项均可打开对应动画", async ({
  page,
}) => {
  test.setTimeout(120000);
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator('[data-tab="movements"]').click();
  await page.locator('[data-action="category"][data-value="全部"]').click();
  const entries = await page.evaluate(() =>
    MOVEMENTS.map(({ id, name }) => ({ id, name })),
  );
  expect(entries).toHaveLength(80);
  for (const entry of entries) {
    await page.locator("#movement-search").fill(entry.name);
    await page.locator(`[data-action="detail"][data-id="${entry.id}"]`).click();
    const image = page.locator(".motion-image");
    await expect(image).toHaveAttribute("src", /poster\.webp$/);
    await page.getByRole("button", { name: "播放动画", exact: true }).click();
    await expect(image).toHaveAttribute("src", /animation\.webp$/);
    await expect(image).toHaveJSProperty("naturalWidth", 768);
    await expect(image).toHaveJSProperty("naturalHeight", 896);
    const guide = page.getByRole("region", { name: "动作要点与误区" });
    await expect(guide.locator("ol li")).toHaveCount(3);
    await expect(guide.locator("ul li")).toHaveCount(2);
    await expect(
      guide.getByRole("heading", { name: "发力重点" }),
    ).toBeAttached();
    await page.locator('[data-action="close"]').click();
  }
  expect(failures).toEqual([]);
});

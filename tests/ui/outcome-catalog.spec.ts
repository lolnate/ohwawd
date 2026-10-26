import { test, expect } from "./assignment-fixture";

async function openCatalog(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  await page.getByRole("link", { name: "Outcome catalog", exact: true }).click();
  await expect(page.locator("#outcome-catalog-title")).toBeFocused();
  return page.locator("#outcome-catalog");
}

test("composable saved-data filters, owner modes, sorting and reset preserve planning inputs", async ({ page, assignment }) => {
  await assignment.seedCatalog();
  await page.clock.install({ time: new Date("2026-11-06T12:00:00Z") });
  const original = await assignment.board();
  const writes: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" && request.url().includes("/api/")) writes.push(request.url()); });
  const catalog = await openCatalog(page);
  await expect(catalog.getByRole("status")).toHaveText("55 of 55 outcomes");
  await catalog.getByLabel("Owner", { exact: true }).selectOption("owner:all");
  await expect(catalog.locator(".catalog-title")).toHaveText(["Owner All"]);
  await catalog.getByLabel("Owner", { exact: true }).selectOption("owner:none");
  await expect(catalog.locator(".catalog-title")).toHaveText(["Owner None"]);
  await catalog.getByLabel("Owner", { exact: true }).selectOption("none");
  await expect(catalog.getByRole("status")).toHaveText("26 of 55 outcomes · Filters active");
  await catalog.getByRole("button", { name: "Clear filters" }).click();
  await catalog.getByLabel("Search outcomes", { exact: true }).fill(" catalog WEB adoption ");
  await catalog.getByLabel("Owner", { exact: true }).selectOption("owner:engineering");
  await catalog.getByLabel("Stream", { exact: true }).selectOption("core");
  await catalog.getByLabel("Projects", { exact: true }).selectOption("optional");
  await catalog.getByLabel("Target date", { exact: true }).selectOption("next30");
  await expect(catalog.getByRole("status")).toHaveText("1 of 55 outcomes · Filters active");
  await expect(catalog.locator(".catalog-row")).toContainText("0 required · 2 optional");
  await catalog.getByLabel("Sort outcomes").selectOption("newest");
  await catalog.getByRole("button", { name: "Clear filters" }).click();
  await expect(catalog.getByLabel("Sort outcomes")).toHaveValue("newest");
  await expect(catalog.locator(".catalog-title").first()).toHaveText("Launch");
  await catalog.getByLabel("Sort outcomes").selectOption("neededBy");
  await expect(catalog.locator(".catalog-title").first()).toHaveText("Owner All");
  await catalog.getByLabel("Search outcomes", { exact: true }).fill("nothing matches");
  await expect(catalog.getByRole("status")).toHaveText("0 of 55 outcomes · Filters active");
  await expect(catalog).toContainText("No outcomes match these filters");
  await catalog.getByRole("button", { name: "Clear filters" }).click();
  expect(writes).toEqual([]);
  const saved = await assignment.board();
  expect(saved.sequenceToken).toBe(original.sequenceToken);
  expect(saved.ownershipToken).toBe(original.ownershipToken);
  expect(saved.links).toEqual(original.links);
  expect(saved.forecast).toEqual(original.forecast);
});

test("query survives view switches and saved-data refresh, including disappearing facets", async ({ page, assignment }) => {
  await assignment.seedCatalog();
  const catalog = await openCatalog(page);
  await catalog.getByLabel("Owner", { exact: true }).selectOption("owner:engineering");
  await catalog.getByLabel("Stream", { exact: true }).selectOption("core");
  await catalog.getByLabel("Sort outcomes").selectOption("newest");
  await page.getByRole("button", { name: /^Board/ }).click();
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  await expect(catalog.getByRole("status")).toHaveText("1 of 55 outcomes · Filters active");
  await catalog.getByRole("button", { name: "Catalog launch", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Manage projects", exact: true }).click();
  await assignment.clearCatalogOwner();
  await page.getByRole("dialog").getByLabel("API foundation requirement").selectOption("minimum");
  await page.getByRole("dialog").getByRole("button", { name: "Save links", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Links saved.");
  await page.getByRole("dialog").getByRole("button", { name: "Close outcome" }).click();
  await expect(catalog.getByRole("status")).toHaveText("0 of 55 outcomes · Filters active");
  await expect(catalog.getByLabel("Owner", { exact: true })).toHaveValue("owner:engineering");
  await expect(catalog.getByLabel("Owner", { exact: true }).locator("option:checked")).toHaveText("Unavailable owner: engineering");
  await expect(catalog.getByLabel("Stream", { exact: true })).toHaveValue("core");
  await expect(catalog.getByLabel("Sort outcomes")).toHaveValue("newest");
  await page.reload();
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  await expect(catalog.getByRole("status")).toHaveText("55 of 55 outcomes");
  await expect(catalog.getByLabel("Sort outcomes")).toHaveValue("name");
});

test("date filters advance at team midnight and visibility return without resetting criteria", async ({ page, assignment }) => {
  await assignment.seedCatalog();
  await page.clock.install({ time: new Date("2026-11-06T07:59:58Z") });
  const catalog = await openCatalog(page);
  await catalog.getByLabel("Target date", { exact: true }).selectOption("past");
  await expect(catalog.getByRole("status")).toHaveText("0 of 55 outcomes · Filters active");
  await page.clock.runFor(2100);
  await expect(catalog.locator(".catalog-title")).toHaveText(["Owner All"]);
  await page.clock.setSystemTime(new Date("2026-11-07T08:00:01Z"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(catalog.locator(".catalog-title")).toHaveText(["Catalog launch", "Owner All"]);
  await expect(catalog.getByLabel("Target date", { exact: true })).toHaveValue("past");
});

test("definitions load independently of forecast failure; loading and retryable errors are distinct", async ({ page, assignment }) => {
  await assignment.seedCatalog();
  await page.route("**/api/board", (route) => route.fulfill({ status: 503, json: { error: "Forecast unavailable" } }));
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/state", async (route) => { await waiting; await route.fulfill({ status: 503, json: { error: "Definitions unavailable" } }); });
  await page.goto("/");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  const catalog = page.locator("#outcome-catalog");
  await expect(catalog).toContainText("Loading outcomes…");
  await expect(catalog).not.toContainText("No outcomes yet");
  release();
  await expect(catalog.getByRole("alert")).toContainText("Could not load outcomes");
  await page.unroute("**/api/state");
  await catalog.getByRole("button", { name: "Retry catalog load" }).click();
  await expect(catalog.getByRole("status")).toHaveText("55 of 55 outcomes");
  await expect(catalog.locator(".catalog-health").first()).toContainText("Unavailable");
  await catalog.getByLabel("Search outcomes", { exact: true }).fill("Catalog launch");
  await expect(catalog.getByRole("status")).toHaveText("1 of 55 outcomes · Filters active");
  // A successful write followed by a failed definitions read retains the last good catalog.
  await catalog.getByRole("button", { name: "Catalog launch", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Manage projects", exact: true }).click();
  await page.getByRole("dialog").getByLabel("API foundation requirement").selectOption("minimum");
  await page.route("**/api/state", (route) => route.fulfill({ status: 503, json: { error: "Refresh unavailable" } }));
  await page.getByRole("dialog").getByRole("button", { name: "Save links", exact: true }).click();
  await expect(catalog.getByRole("alert")).toContainText("Showing the last successfully loaded catalog");
  await expect(catalog.getByRole("status")).toHaveText("1 of 55 outcomes · Filters active");
});

for (const width of [1440, 768, 390]) {
  test(`all 55 rows are reachable and metadata fits at ${width}px`, async ({ page, assignment }) => {
    await assignment.seedCatalog();
    await page.setViewportSize({ width, height: 900 });
    const catalog = await openCatalog(page);
    await expect(catalog.locator(".catalog-row")).toHaveCount(55);
    await expect(catalog.getByLabel("Search outcomes", { exact: true })).toBeVisible();
    await catalog.getByLabel("Search outcomes", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(catalog.getByLabel("Sort outcomes")).toBeFocused();
    const first = catalog.locator(".catalog-row").first();
    const last = catalog.locator(".catalog-row").last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    expect(await last.locator(".catalog-title").getAttribute("title")).toHaveLength(197);
    for (const cell of await last.locator(".catalog-cell, .catalog-row-actions").all()) {
      const bounds = (await cell.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    expect(await catalog.locator(".catalog-list").evaluate((list) => getComputedStyle(list).overflowY)).toBe("visible");
    if (width === 1440) {
      const bounds = (await first.boundingBox())!;
      expect(bounds.height).toBeGreaterThanOrEqual(64);
      expect(bounds.height).toBeLessThanOrEqual(88);
    }
    await catalog.screenshot({ path: test.info().outputPath(`catalog-${width}.png`) });
    await expect(catalog.locator(".catalog-columns")).toContainText("Health");
    await expect(page.locator("#outcome-delivery")).toHaveCount(0);
  });
}

import { test, expect } from "./assignment-fixture";

test("month/week timeline fits several months and keeps project labels sticky during horizontal scroll", async ({ page, assignment }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const region = page.getByRole("region", { name: /^Core forecast timeline/ });
  const table = region.locator("table");
  await expect(table.locator(".timeline-months")).toContainText("Nov 2026");
  await expect(table.locator(".timeline-months")).toContainText("Dec 2026");
  await expect(table.locator(".timeline-cycle-context")).toContainText("C1");
  const geometry = await region.evaluate((element) => ({ viewport: element.clientWidth, total: element.scrollWidth,
    label: element.querySelector(".timeline-project-heading")!.getBoundingClientRect().width,
    week: element.querySelector(".timeline-weeks th")!.getBoundingClientRect().width }));
  expect(geometry.total).toBeGreaterThan(geometry.viewport);
  expect(geometry.week).toBeCloseTo(80, 0);
  expect((geometry.viewport - geometry.label) / geometry.week).toBeGreaterThan(8);
  expect((geometry.viewport - geometry.label) / geometry.week).toBeLessThan(15);
  if (process.env.TIMELINE_SCREENSHOT) await region.screenshot({ path: process.env.TIMELINE_SCREENSHOT });
  await region.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const rowHeading = table.locator("tbody tr").first().locator("th");
  const before = await rowHeading.boundingBox();
  await region.evaluate((element) => { element.scrollLeft = 600; });
  const after = await rowHeading.boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  expect((await assignment.board()).holidayWeeks).toHaveLength(3);
});

test("holiday bands edit real weekly capacity and a 100% override restores the default budget", async ({ page, assignment }) => {
  await page.goto("/");
  const region = page.getByRole("region", { name: /^Core forecast timeline/ });
  for (const start of ["2026-11-23", "2026-12-21", "2026-12-28"]) {
    const header = region.locator(`.timeline-weeks [data-week-start="${start}"]`);
    await expect(header).toHaveClass(/reduced-week/);
    await expect(header).toContainText("50%");
    await expect(region.locator(`tbody tr`).first().locator(`[data-week-band="${start}"]`)).toHaveClass(/reduced-week/);
  }
  expect((await assignment.board()).forecast.cycles[0].available).toBe(12);
  await region.getByRole("button", { name: "Edit week of 2026-11-23", exact: true }).click();
  const editor = page.locator("#calendar-availability");
  await expect(editor.getByLabel("Week starting (Monday)")).toHaveValue("2026-11-23");
  await expect(editor.getByLabel("Week availability %")).toHaveValue("50");
  await editor.getByLabel("Week availability %").fill("0");
  await editor.getByRole("button", { name: "Save week availability" }).click();
  await expect(page.getByRole("status")).toContainText("Week availability saved");
  expect((await assignment.board()).forecast.cycles[0].available).toBe(4);
  await expect(region.locator('.timeline-weeks [data-week-start="2026-11-23"]')).toContainText("0%");
  await editor.getByLabel("Week availability %").fill("100");
  await editor.getByRole("button", { name: "Save week availability" }).click();
  await expect(region.locator('.timeline-weeks [data-week-start="2026-11-23"]')).toContainText("100%");
  expect((await assignment.board()).forecast.cycles[0].available).toBe(20);
  await editor.getByRole("button", { name: "Remove override for 2026-11-23" }).click();
  await expect(region.locator('.timeline-weeks [data-week-start="2026-11-23"]')).toContainText("50%");
  await page.reload();
  await expect(region.locator('.timeline-weeks [data-week-start="2026-12-21"]')).toContainText("50%");
});

test("partial forecasts stop at the planning horizon and successor rows explain their blockers", async ({ page, assignment }) => {
  await assignment.setDemand("a", 1000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const core = page.getByRole("region", { name: /^Core forecast timeline/ });
  const row = core.locator('[data-timeline-project="linear:a"]');
  const bar = row.locator(".calendar-project-bar.continuing");
  await expect(bar).toContainText("Continues");
  await expect(bar).toHaveClass(/uses-projected-cycles/);
  const [barBox, trackBox] = await Promise.all([bar.boundingBox(), row.locator(".timeline-track").boundingBox()]);
  expect(barBox!.x + barBox!.width).toBeLessThanOrEqual(trackBox!.x + trackBox!.width + 1);
  await expect(bar).toHaveAttribute("title", /continues beyond the simulated calendar/);
  const successor = page.getByRole("region", { name: /^Delivery forecast timeline/ }).locator('[data-timeline-project="linear:c"]');
  await expect(successor.locator("th")).toContainText("After API foundation");
  await expect(successor.locator(".calendar-row-reason")).toContainText("Waiting for API foundation");
  await expect(successor.locator(".calendar-project-bar")).toHaveCount(0);
  await expect(core.locator(".timeline-week-band.projected-calendar").first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

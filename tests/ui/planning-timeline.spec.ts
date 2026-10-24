import { test, expect } from "./assignment-fixture";

test("scoped bars and all shadows resize and align from the primary stream's capacity", async ({ page, assignment }) => {
  await assignment.shareProjects();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const bars = page.locator('[data-timeline-project="linear:a"].calendar-project-bar');
  const primary = bars.filter({ hasText: /pts/ });
  const geometry = async () => {
    await expect(bars).toHaveCount(3);
    const positions = await bars.evaluateAll((elements) => elements.map((element) => {
      const bar = element as HTMLElement;
      return { left: bar.style.left, width: bar.style.width, pixels: bar.getBoundingClientRect().width };
    }));
    for (const position of positions) expect(position).toEqual(positions[0]);
    return positions[0];
  };
  await expect(primary).toHaveAttribute("title", /finishes at cycle end 2026-11-26/);
  const initial = await geometry(); // 5 points fit the first cycle's 6-point primary budget.
  await assignment.setDemand("a", 15);
  await page.reload();
  await expect(primary).toHaveAttribute("title", /finishes at cycle end 2026-12-03/);
  const estimated = await geometry();
  expect(estimated.pixels).toBeCloseTo(initial.pixels * 2, 0);
  expect(estimated.left).toBe(initial.left);
  await primary.click();
  const drawer = page.getByRole("dialog", { name: "API foundation", exact: true });
  await drawer.getByLabel("Extra scope points").fill("10");
  await drawer.getByRole("button", { name: "Save extra scope", exact: true }).click();
  await expect(drawer.getByRole("status")).toContainText("extra scope saved");
  await page.keyboard.press("Escape");
  await expect(primary).toHaveClass(/provisional/);
  await expect(primary).toHaveAttribute("title", /25 pts counted here.*finishes at cycle end 2026-12-10/);
  const manual = await geometry();
  expect(manual.pixels).toBeCloseTo(initial.pixels * 3, 0);
  await assignment.setCapacity(20, 0.25); // Other streams cannot supply the primary's missing budget.
  await page.reload();
  await expect(primary).toHaveAttribute("title", /finishes at cycle end 2027-01-07/);
  const reduced = await geometry();
  expect(reduced.pixels).toBeCloseTo(initial.pixels * 7, 0);
  expect(reduced.left).toBe(initial.left);
  await assignment.setDemand("a", null);
  await page.reload();
  await expect(bars).toHaveCount(0); // Newly unknown demand is not covered by the old extra-scope baseline.
  await expect(page.locator('[data-timeline-project="linear:a"].unscheduled-project')).toHaveCount(3);
});

test("missing or zero primary capacity never invents a progress bar", async ({ page, assignment }) => {
  await assignment.shareProjects();
  for (const baseline of [null, 0]) {
    await assignment.setCapacity(baseline);
    await page.goto("/");
    await expect(page.locator('[data-timeline-project="linear:a"].calendar-project-bar')).toHaveCount(0);
    if (baseline !== null) await expect(page.locator('[data-timeline-project="linear:a"].unscheduled-project')).toHaveCount(3);
    expect((await assignment.board()).forecast.packages.find((item) => item.id === "linear:a")!.finish).toBeNull();
  }
});

test("continuing bars stop at the last simulated progress rather than unused calendar", async ({ page, assignment }) => {
  await assignment.configureCycles({ enabled: false, importedCount: 3 });
  await assignment.setDemand("a", 1000);
  // The first cycle still has some capacity; every date in later cycles has none.
  for (const week of ["2026-11-23", "2026-11-30", "2026-12-07"]) await assignment.setWeekAvailability(week, 0);
  await page.goto("/");
  const bar = page.locator('[data-timeline-project="linear:a"].calendar-project-bar');
  await expect(bar).toHaveClass(/continuing/);
  const width = await bar.evaluate((element) => element.getBoundingClientRect().width);
  expect(width).toBeCloseTo(80, 0); // One calendar week of progress, not all three simulated cycles.
  expect((await assignment.board()).forecast.packages.find((item) => item.id === "linear:a")!.finish).toBeNull();
});

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
  const bar = core.locator('[data-timeline-project="linear:a"].calendar-project-bar.continuing');
  await expect(bar).toContainText("Continues");
  await expect(bar).toHaveClass(/uses-projected-cycles/);
  const [barBox, trackBox] = await Promise.all([bar.boundingBox(), core.locator(".timeline-track").first().boundingBox()]);
  expect(barBox!.x + barBox!.width).toBeLessThanOrEqual(trackBox!.x + trackBox!.width + 1);
  await expect(bar).toHaveAttribute("title", /continues beyond the simulated calendar/);
  const successor = page.getByRole("region", { name: /^Delivery forecast timeline/ }).locator('[data-timeline-project="linear:c"]');
  await expect(successor).toContainText("After API foundation");
  await expect(successor).toContainText("Waiting for API foundation");
  await expect(successor).not.toHaveClass(/calendar-project-bar/);
  await expect(core.locator(".timeline-week-band.projected-calendar").first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

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
  await expect(primary).toHaveAttribute("title", /uses 83% of its final cycle ending 2026-11-26/);
  const initial = await geometry(); // 5 points consume 5/6 of the holiday-weighted first cycle.
  await assignment.setDemand("a", 15);
  await page.reload();
  await expect(primary).toHaveAttribute("title", /uses 100% of its final cycle ending 2026-12-03/);
  const estimated = await geometry();
  expect(estimated.pixels / initial.pixels).toBeCloseTo(12 / 5, 1);
  expect(estimated.left).toBe(initial.left);
  await primary.click();
  const drawer = page.getByRole("dialog", { name: "API foundation", exact: true });
  await drawer.getByLabel("Extra scope points").fill("10");
  await drawer.getByRole("button", { name: "Save extra scope", exact: true }).click();
  await expect(drawer.getByRole("status")).toContainText("extra scope saved");
  await page.keyboard.press("Escape");
  await expect(primary).toHaveClass(/provisional/);
  await expect(primary).toHaveAttribute("title", /25 pts counted here.*uses 100% of its final cycle ending 2026-12-10/);
  const manual = await geometry();
  expect(manual.pixels / initial.pixels).toBeCloseTo(18 / 5, 1);
  await assignment.setCapacity(20, 0.25); // Other streams cannot supply the primary's missing budget.
  await page.reload();
  await expect(primary).toHaveAttribute("title", /uses 44% of its final cycle ending 2027-01-07/);
  const reduced = await geometry();
  expect(reduced.pixels / initial.pixels).toBeCloseTo(116 / 15, 1);
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
  const bar = page.locator('[data-timeline-project="linear:a"].calendar-project-bar.counted-project');
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
  const bar = table.locator("tbody tr").first().locator(".calendar-project-bar").first();
  const before = await rowHeading.boundingBox();
  const barBefore = await bar.boundingBox();
  await region.evaluate((element, scrollLeft) => { element.scrollLeft = scrollLeft; }, Math.max(1, barBefore!.x - before!.x - 20));
  const [after, barAfter] = await Promise.all([rowHeading.boundingBox(), bar.boundingBox()]);
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);
  expect(barAfter!.x).toBeLessThan(after!.x + after!.width);
  const overlapOwner = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("th")?.className,
    { x: Math.max(after!.x, barAfter!.x) + 1, y: barAfter!.y + barAfter!.height / 2 });
  expect(overlapOwner).toContain("timeline-project-heading");
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
  await expect(successor).toContainText("ROLL");
  await expect(successor).not.toHaveClass(/calendar-project-bar/);
  await expect(successor).toHaveAttribute("aria-label", /Rollout.*After API foundation/);
  await expect(page.locator('[data-dependency-from="linear:a"][data-dependency-to="linear:c"]')).toHaveCount(0);
  await expect(core.locator(".timeline-week-band.projected-calendar").first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("aggregate remaining scope draws a fractional sequential bar and connector without wait prose", async ({ page, assignment }) => {
  await assignment.shareProjects(); await assignment.activateRoadmap(); await assignment.setRemainingScope("a", 106); await assignment.setDemand("a", null);
  await assignment.setCapacity(150, .2); await assignment.setHolidaysEnabled(false); await page.goto("/");
  const core = page.getByRole("region", { name: /^Core forecast timeline/ });
  const owned = core.locator('[data-timeline-project="linear:a"].counted-project');
  await expect(owned).toHaveAttribute("data-finish-fraction", String(16 / 30));
  const delivery = page.getByRole("region", { name: /^Delivery forecast timeline/ });
  const launch = delivery.locator('[data-timeline-outcome="00000000-0000-4000-8000-000000000001"]');
  const reference = launch.locator('[data-timeline-project="linear:a"].shared-project');
  const successor = launch.locator('[data-timeline-project="linear:c"]');
  const weekWidth = await core.locator(".timeline-weeks th").first().evaluate((element) => element.getBoundingClientRect().width);
  const [ownedBox, referenceBox, successorBox] = await Promise.all([owned.boundingBox(), reference.boundingBox(), successor.boundingBox()]);
  expect(ownedBox!.width / weekWidth).toBeCloseTo(106 / 30, 1); expect(referenceBox!.width).toBeCloseTo(ownedBox!.width, 0);
  expect(referenceBox!.x + referenceBox!.width).toBeLessThanOrEqual(successorBox!.x + 1);
  await expect(launch.locator('[data-dependency-from="linear:a"][data-dependency-to="linear:c"]')).toHaveCount(1);
  await expect(page.locator("[data-outcome-wait]")).toHaveCount(0); await expect(page.getByText(/^Waiting for /)).toHaveCount(0);
  await reference.click(); await expect(page.getByRole("dialog", { name: "API foundation", exact: true })).toContainText("106 pts");
  await page.keyboard.press("Escape");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 }); await core.scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    if (process.env.ACCEPTANCE_SCREENSHOT_PREFIX) await page.screenshot({ path: `${process.env.ACCEPTANCE_SCREENSHOT_PREFIX}-capacity-timeline-${width}.png` });
    await launch.scrollIntoViewIfNeeded();
    if (process.env.ACCEPTANCE_SCREENSHOT_PREFIX) await page.screenshot({ path: `${process.env.ACCEPTANCE_SCREENSHOT_PREFIX}-dependency-timeline-${width}.png` });
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" }); await reference.focus(); await expect(reference).toBeFocused();
  await expect(launch.locator('[data-dependency-from="linear:a"][data-dependency-to="linear:c"]')).not.toHaveCSS("stroke", "none");
});

test("tiny fractional bars retain an accurate visual span and a minimum pointer target", async ({ page, assignment }) => {
  await assignment.setRemainingScope("a", .3); await assignment.setDemand("a", null); await assignment.setHolidaysEnabled(false); await page.goto("/");
  const bar = page.getByRole("region", { name: /^Core forecast timeline/ }).locator('[data-timeline-project="linear:a"].counted-project');
  const box = await bar.boundingBox();
  expect(box!.width).toBeLessThan(4);
  const target = await page.evaluate(({ x, y }) => (document.elementFromPoint(x, y)?.closest("button") as HTMLElement | null)?.dataset.timelineProject,
    { x: box!.x + 10, y: box!.y + box!.height / 2 });
  expect(target).toBe("linear:a");
  await page.mouse.click(box!.x + 10, box!.y + box!.height / 2);
  await expect(page.getByRole("dialog", { name: "API foundation", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  for (const edge of ["start", "end"] as const) {
    await bar.evaluate((element, value) => {
      const item = element as HTMLElement; item.dataset.hitEdge = value;
      item.style.left = value === "start" ? "0" : "auto"; item.style.right = value === "end" ? "0" : "auto";
    }, edge);
    await bar.scrollIntoViewIfNeeded();
    const [edgeBox, track] = await Promise.all([bar.boundingBox(), bar.locator("xpath=..").boundingBox()]);
    expect(edge === "start" ? edgeBox!.x : edgeBox!.x + edgeBox!.width).toBeCloseTo(edge === "start" ? track!.x : track!.x + track!.width, 0);
    const edgeTarget = await page.evaluate(({ x, y }) => (document.elementFromPoint(x, y)?.closest("button") as HTMLElement | null)?.dataset.timelineProject,
      { x: edge === "start" ? edgeBox!.x + 23 : edgeBox!.x + edgeBox!.width - 23, y: edgeBox!.y + edgeBox!.height / 2 });
    expect(edgeTarget, edge).toBe("linear:a");
  }
});

test("immediate prerequisites reuse forecast geometry and connect locally without duplicate charge", async ({ page, assignment }, testInfo) => {
  await assignment.seedDerivedChain(); await page.goto("/");
  const launch = page.locator('[data-timeline-outcome="00000000-0000-4000-8000-000000000001"]');
  const prerequisite = launch.locator('[data-timeline-project="linear:a"][data-derived-prerequisite="true"]');
  const successor = launch.locator('[data-timeline-project="linear:c"]');
  await expect(prerequisite).toContainText("Prerequisite"); await expect(prerequisite).toHaveAttribute("title", /Immediate prerequisite for Rollout.*Required for delivery/);
  await expect(successor).toHaveAttribute("title", /After API foundation/);
  const connector = launch.locator('[data-dependency-from="linear:a"][data-dependency-to="linear:c"]'); await expect(connector).toHaveCount(1);
  await expect(launch.locator('[data-dependency-from="linear:b"][data-dependency-to="linear:a"]')).toHaveCount(1);
  await expect(launch.locator('[data-timeline-project="linear:b"]')).toHaveAttribute("title", /Required for delivery/);
  await expect(page.locator('[data-timeline-project="linear:a"].counted-project')).toHaveCount(1);
  const region = page.getByRole("region", { name: /^Delivery forecast timeline/ });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 }); await region.evaluate((element) => { element.scrollLeft = 0; });
    const [priorBox, successorBox, connectorBox, trackBox] = await Promise.all([prerequisite.boundingBox(), successor.boundingBox(), connector.boundingBox(), launch.locator(".outcome-timeline-track").boundingBox()]);
    const endpoints = await connector.evaluate((element) => { const path = element as SVGPathElement, matrix = path.getScreenCTM()!;
      const point = (value: number) => { const item = path.getPointAtLength(value).matrixTransform(matrix); return { x: item.x, y: item.y }; };
      return { start: point(0), end: point(path.getTotalLength()) }; });
    expect(priorBox!.x + priorBox!.width).toBeLessThanOrEqual(successorBox!.x + 1);
    expect(endpoints.start.x).toBeCloseTo(priorBox!.x + priorBox!.width, 0); expect(endpoints.end.x).toBeLessThanOrEqual(successorBox!.x + 1); expect(Math.abs(successorBox!.x - endpoints.end.x)).toBeLessThan(7);
    expect(connectorBox!.y).toBeGreaterThanOrEqual(trackBox!.y); expect(connectorBox!.y + connectorBox!.height).toBeLessThanOrEqual(trackBox!.y + trackBox!.height);
    await launch.scrollIntoViewIfNeeded(); await page.screenshot({ path: testInfo.outputPath(`dependency-timeline-${width}.png`) });
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" }); await prerequisite.focus(); await expect(prerequisite).toBeFocused();
  await expect(connector).not.toHaveCSS("stroke", "none");
  const beforeScroll = await Promise.all([prerequisite.boundingBox(), connector.boundingBox()]); await region.evaluate((element) => { element.scrollLeft = 160; });
  const afterScroll = await Promise.all([prerequisite.boundingBox(), connector.boundingBox()]);
  expect(afterScroll[0]!.x - beforeScroll[0]!.x).toBeCloseTo(afterScroll[1]!.x - beforeScroll[1]!.x, 0);
  await prerequisite.click(); await expect(page.getByRole("dialog", { name: "API foundation", exact: true })).toBeVisible();
});

test("optional contributions and their derived prerequisites stay optional without a fabricated connector", async ({ page, assignment }) => {
  await assignment.shareProjects(); await assignment.seedOptionalDerived(); await page.goto("/");
  const foundation = page.locator('[data-timeline-outcome="00000000-0000-4000-8000-000000000002"]');
  const contribution = foundation.locator('[data-timeline-project="linear:b"]');
  const prerequisite = foundation.locator('[data-timeline-project="linear:d"][data-derived-prerequisite="true"]');
  await expect(contribution).toHaveAttribute("aria-label", /Optional context for this outcome/);
  await expect(prerequisite).toHaveAttribute("aria-label", /Prerequisite reference.*Optional context for this outcome/);
  await expect(prerequisite).not.toHaveAttribute("aria-label", /Required for delivery/);
  await expect(foundation.locator('[data-dependency-from="linear:d"][data-dependency-to="linear:b"]')).toHaveCount(0);
});

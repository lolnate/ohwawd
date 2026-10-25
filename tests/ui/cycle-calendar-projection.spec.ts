import { test, expect } from "./assignment-fixture";

test("week headers use visible Cycle 46 rather than internal ordinal 1 and continue beyond four imports", async ({ page, assignment }) => {
  await assignment.configureCycles({ visibleOffset: 45, importedCount: 4 });
  await page.goto("/");
  const timeline = page.getByRole("region", { name: /^Core forecast timeline/ });
  const context = timeline.locator(".timeline-cycle-context");
  await expect(context.locator("th").first()).toHaveText("C46");
  await expect(context).toContainText("C49");
  await expect(context.locator(".projected-cycle-label").filter({ hasText: "C50*" }).first()).toBeAttached();
  await expect(timeline.locator('[data-week-band="2026-12-21"]').first()).toHaveClass(/projected-calendar/);
  await expect(page.locator("#stream-core .calendar-legend")).toContainText("Projected from Linear cadence");
  const board = await assignment.board();
  expect(board.linearCycles).toHaveLength(4);
  expect(board.linearCycles[0].number).toBe(1);
  expect(board.linearCycles[0].name).toBe("Cycle 46");
  expect(board.planningCycles.filter((cycle) => cycle.projected).length).toBeGreaterThan(4);
});

test("projected cycles enable provisional delivery and retain editable weekly holiday capacity", async ({ page, assignment }) => {
  await assignment.configureCycles({ visibleOffset: 45, importedCount: 4 });
  await assignment.setDemand("a", 60);
  await page.goto("/");
  await page.locator("#stream-work-core > summary").click();
  const project = page.locator('[data-project-id="linear:a"]');
  await expect(project).toContainText("projected cycle dates");
  const before = await assignment.board();
  expect(before.forecast.packages.find((item) => item.id === "linear:a")!.calendarProjected).toBe(true);
  expect(before.forecast.outcomes[0].status).toBe("provisional");
  expect(before.forecast.cycles.find((cycle) => cycle.name === "Cycle 50")!.available).toBe(12);
  const calendar = page.locator("#cycle-calendar-settings");
  await calendar.locator("summary").first().click();
  await expect(calendar.getByRole("button", { name: "2026-12-18, Projected Cycle 50", exact: true })).toBeDisabled();
  await page.getByRole("region", { name: /^Core forecast timeline/ }).getByRole("button", { name: "Edit week of 2026-12-21", exact: true }).click();
  const editor = page.locator("#calendar-availability");
  await expect(editor.getByLabel("Week availability %")).toHaveValue("50");
  await editor.getByLabel("Week availability %").fill("100");
  await editor.getByRole("button", { name: "Save week availability" }).click();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true }).getByRole("status")).toContainText("Week availability saved");
  const after = await assignment.board();
  expect(after.forecast.cycles.find((cycle) => cycle.name === "Cycle 50")!.projected).toBe(true);
  expect(after.forecast.cycles.find((cycle) => cycle.name === "Cycle 50")!.available).toBe(20);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  await expect(page.locator("#outcome-delivery")).toContainText("projected cycles");
  await expect(page.locator("#outcome-delivery")).toContainText("provisional");
});

test("disabled cadence retains imported labels and explains genuinely unsupported future weeks", async ({ page, assignment }) => {
  await assignment.configureCycles({ visibleOffset: 45, importedCount: 4, enabled: false });
  await page.goto("/");
  const timeline = page.getByRole("region", { name: /^Core forecast timeline/ });
  await expect(timeline.locator(".timeline-cycle-context th").first()).toHaveText("C46");
  await expect(timeline.locator(".projected-cycle-label")).toHaveCount(0);
  await expect(page.locator("#stream-core .calendar-coverage-note")).toContainText("Linear cycles are not enabled");
  await expect(timeline.locator(".timeline-week-band.no-calendar").first()).toBeAttached();
  expect((await assignment.board()).calendarProjection.projectedCount).toBe(0);
});

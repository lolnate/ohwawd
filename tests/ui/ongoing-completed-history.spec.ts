import { test, expect } from "./assignment-fixture";

test.beforeEach(async ({ assignment }) => {
  await assignment.activateRoadmap();
  await assignment.seedOngoingWork();
});

test("shows six actual completed cycles, recent and attention values, sticky labels, and coverage", async ({ page }) => {
  await page.goto("/");
  const history = page.getByRole("region", { name: "Completed work by actual Linear cycle" });
  const table = history.getByRole("table", { name: "Completed work by actual Linear cycle, Issues" });
  await expect(table.getByRole("columnheader")).toHaveCount(7);
  await expect(table.getByRole("columnheader", { name: "Cycle 43" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Vector Cycle 47" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Horizon Cycle 48" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Cycle 41" })).toHaveCount(0);
  await expect(table.locator('[data-history-row="project:b"]')).toContainText("Web experience");
  await expect(table.getByRole("button", { name: "Inspect Web experience, Horizon, cycle 48: Issues 2 issues; 2 issues; 1 unestimated issue" })).toHaveText("2");
  await expect(table.locator('[data-history-row="needs-classification"]')).toContainText("AttentionNeeds classification");
  await expect(table.locator('[data-history-row="no-project"]')).toContainText("AttentionNo project");
  await expect(history.getByRole("note")).toContainText("1 completed issue falls outside imported completed cycle dates");
  await expect(history.getByRole("button", { name: "Show older cycles (2)" })).toBeVisible();
  expect(await table.locator("tbody .history-row-label").first().evaluate((element) => getComputedStyle(element).position)).toBe("sticky");

  await table.getByRole("button", { name: "Inspect Needs classification, Vector, cycle 47: Issues 1 issue; 1 issue; 1 unestimated issue" }).click();
  const dialog = page.getByRole("dialog", { name: "Needs classification" });
  await expect(dialog).toContainText("ENG-504");
  await dialog.getByRole("button", { name: "Close and review classification controls" }).click();
  await expect(page.locator("#ongoing-needs-classification-title")).toBeFocused();
});

test("reveals retained frozen cycles without changing recent values", async ({ page }) => {
  await page.goto("/");
  const history = page.getByRole("region", { name: "Completed work by actual Linear cycle" });
  const recent = history.getByRole("button", { name: /Inspect Web experience, Horizon, cycle 48/ });
  await expect(recent).toHaveText("2");
  await history.getByRole("button", { name: "Show older cycles (2)" }).click();
  const table = history.getByRole("table", { name: /Completed work by actual Linear cycle/ });
  await expect(table.getByRole("columnheader")).toHaveCount(9);
  await expect(table.getByRole("columnheader", { name: "Ignition Cycle 41" })).toBeVisible();
  await expect(table.getByRole("button", { name: "Inspect API foundation, Ignition, cycle 41: Issues 2 issues; 2 issues; 1 unestimated issue" })).toHaveText("2");
  await expect(history.getByRole("button", { name: /Inspect Web experience, Horizon, cycle 48/ })).toHaveText("2");
});

test("switches exact values and one global intensity scale to known points", async ({ page }) => {
  await page.goto("/");
  const history = page.getByRole("region", { name: "Completed work by actual Linear cycle" });
  const issueCell = history.getByRole("button", { name: "Inspect Web experience, Horizon, cycle 48: Issues 2 issues; 2 issues; 1 unestimated issue" });
  const noProjectIssue = history.getByRole("button", { name: "Inspect No project, Cycle 46: Issues 1 issue; 1 issue; 0 unestimated issues" });
  await expect(issueCell).toHaveText("2");
  await expect(noProjectIssue).toHaveText("1");
  expect(await issueCell.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(await noProjectIssue.evaluate((element) => getComputedStyle(element).backgroundColor));

  await history.getByRole("radio", { name: "Points" }).check();
  const pointsCell = history.getByRole("button", { name: "Inspect Web experience, Horizon, cycle 48: Points 3 known points; 2 issues; 1 unestimated issue" });
  await expect(pointsCell).toHaveText("3");
  await expect(history.getByRole("button", { name: "Inspect No project, Cycle 46: Points 2 known points; 1 issue; 0 unestimated issues" })).toHaveText("2");
  await expect(history.getByRole("table", { name: "Completed work by actual Linear cycle, Points" })).toBeVisible();
});

test("history inspection loads lazily from keyboard and restores cell focus", async ({ page }) => {
  await page.goto("/");
  const history = page.getByRole("region", { name: "Completed work by actual Linear cycle" });
  await history.getByRole("button", { name: "Show older cycles (2)" }).click();
  const trigger = history.getByRole("button", { name: "Inspect API foundation, Ignition, cycle 41: Issues 2 issues; 2 issues; 1 unestimated issue" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "API foundation" });
  await expect(dialog).toContainText("Ongoing completed work · Ignition, cycle 41");
  await expect(dialog).toContainText("ENG-501");
  await expect(dialog).toContainText("Frozen known completion");
  await expect(dialog).toContainText("5 estimated pts · Source workflow: completed");
  await expect(dialog).toContainText("ENG-502");
  await expect(dialog).toContainText("Unestimated · Source workflow: completed");
  await expect(dialog.getByRole("link", { name: "Open ENG-501 in Linear" })).toHaveAttribute("href", "https://linear.app/issue/ENG-501");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("older-history errors retry and the matrix remains contained at 390px", async ({ page, assignment }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  assignment.failNextHistoryRead();
  await page.goto("/");
  const history = page.getByRole("region", { name: "Completed work by actual Linear cycle" });
  await history.getByRole("button", { name: "Show older cycles (2)" }).click();
  await expect(history.getByRole("alert")).toContainText("Completed history temporarily unavailable");
  await history.getByRole("button", { name: "Retry older cycles" }).click();
  await expect(history.getByRole("columnheader", { name: "Ignition Cycle 41" })).toBeVisible();
  const scroll = history.getByLabel("Completed work history matrix; scroll horizontally for more cycles");
  expect(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("forced colors and reduced motion preserve cell differentiation", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/");
  const history = page.getByRole("region", { name: "Completed work by actual Linear cycle" });
  const populated = history.getByRole("button", { name: /Inspect Web experience, Horizon/ });
  const zero = history.locator(".history-zero").first();
  await expect(populated).toBeVisible();
  expect(await populated.evaluate((element) => getComputedStyle(element).borderStyle)).toBe("solid");
  expect(await zero.evaluate((element) => getComputedStyle(element).borderStyle)).toContain("dashed");
  expect(await populated.evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.001);
});

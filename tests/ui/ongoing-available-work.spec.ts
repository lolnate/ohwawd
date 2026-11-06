import { test, expect } from "./assignment-fixture";

test.beforeEach(async ({ assignment }) => {
  await assignment.activateRoadmap();
  await assignment.seedOngoingWork();
});

test("sorts Ready work, retains zero-Ready rows, prints exact values, and uses issue-count geometry", async ({ page }) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: "Ongoing work" });
  const rows = section.locator('tbody [data-ongoing-row^="ongoing:"]');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("API foundation");
  await expect(rows.nth(1)).toContainText("Web experience");
  await expect(rows.nth(2)).toContainText("Rollout");
  await expect(rows.nth(2)).toContainText("Ready 0 issues");
  await expect(rows.nth(0)).toContainText("Ready 2 issues · 3 known pts · 1 unestimated issue");
  await expect(rows.nth(0)).toContainText("Blocked 1 issue · 99 known pts · 0 unestimated issues");
  await expect(rows.nth(0)).toContainText("1 issue in progress");

  const widths = await rows.nth(0).locator(".available-segment").evaluateAll((segments) => segments.map((segment) => segment.getBoundingClientRect().width));
  expect(widths[0]).toBeGreaterThan(widths[1] * 1.8);
  expect(Math.abs(widths[1] - widths[2])).toBeLessThan(3);
  const singleIssueSegment = rows.nth(2).locator(".available-segment");
  expect((await singleIssueSegment.boundingBox())?.width).toBeGreaterThanOrEqual(107);
  expect((await singleIssueSegment.locator("span").boundingBox())?.height).toBeLessThan(24);

  const attention = section.getByRole("region", { name: "Needs classification" });
  await expect(attention).toContainText("Attention · excluded from Ongoing totals");
  await expect(attention).toContainText("Discovery");
  await expect(attention.getByRole("button", { name: "Save local classification" })).toBeVisible();
});

test("shows the available-work empty state", async ({ page, assignment }) => {
  await assignment.clearOngoingWork();
  await page.goto("/");
  const section = page.getByRole("region", { name: "Ongoing work" });
  await expect(section).toContainText("No projects are currently classified Ongoing");
  await expect(section.getByRole("table", { name: "Ongoing available work" })).toHaveCount(0);
});

test("keyboard inspection exposes source evidence and restores trigger focus", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Inspect API foundation Blocked work: 1 issue · 99 known pts · 0 unestimated issues" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "API foundation" });
  await expect(dialog).toContainText("ENG-103");
  await expect(dialog).toContainText("Blocked high estimate");
  await expect(dialog).toContainText("99 estimated pts · Source workflow: unstarted");
  await expect(dialog).toContainText("Unavailable source context");
  await expect(dialog).toContainText("external-blocker");
  await expect(dialog.getByRole("link", { name: "Open ENG-103 in Linear" })).toHaveAttribute("href", "https://linear.app/issue/ENG-103");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("failed lazy loads retain context, retry, and contain the Board at 390px", async ({ page, assignment }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  assignment.failNextOngoingRead();
  await page.goto("/");
  const section = page.getByRole("region", { name: "Ongoing work" });
  const trigger = section.getByRole("button", { name: /Inspect API foundation Ready work/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "API foundation" });
  await expect(dialog.getByRole("alert")).toContainText("Issue evidence temporarily unavailable");
  await dialog.getByRole("button", { name: "Retry issue inspection" }).click();
  await expect(dialog).toContainText("ENG-101");
  await dialog.getByRole("button", { name: "Close issue inspection" }).click();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  expect(await page.locator("#project-streams").evaluate((streams, ongoing) => !!(streams.compareDocumentPosition(ongoing as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await section.elementHandle())).toBe(true);
  expect(await section.evaluate((ongoing, triage) => !!(ongoing.compareDocumentPosition(triage as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await page.locator("#board-roadmap-triage-title").elementHandle())).toBe(true);
});

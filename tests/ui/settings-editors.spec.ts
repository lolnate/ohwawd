import type { Page } from "@playwright/test";
import { test, expect } from "./assignment-fixture";

const settings = (page: Page) => page.getByRole("dialog", { name: "Settings", exact: true });
async function openSettings(page: Page, section = "Capacity assumptions") {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await selectSection(page, section);
  await expect(settings(page).locator("form")).toBeVisible();
}
async function selectSection(page: Page, name: string) {
  await settings(page).getByRole("navigation").getByRole("button", { name, exact: true }).click();
}

test("section drafts survive navigation and unrelated saves; dismissal discards only unsaved edits", async ({ page, assignment }) => {
  await assignment.setExtraScope("b", 2);
  await page.goto("/");
  await openSettings(page);
  await settings(page).getByLabel("Manual baseline (optional)").fill("35");
  await selectSection(page, "Weekly availability and holidays");
  await settings(page).getByLabel("Week starting (Monday)").fill("2026-11-25");
  await expect(settings(page).getByLabel("Week starting (Monday)")).toHaveValue("2026-11-23");
  await settings(page).getByLabel("Week availability %").fill("75");
  await settings(page).getByLabel("Week label (optional)").fill("Team leave");
  await selectSection(page, "Scope readiness");
  await settings(page).getByLabel("Scope projects (days before start)").fill("30");
  await settings(page).getByRole("button", { name: "Save scoping window" }).click();
  await expect(settings(page).getByRole("status")).toContainText("Scoping window saved");
  const saved = await assignment.board();
  expect(saved.capacity.baseline).toBe(20);
  expect(saved.capacity.scoping_lead_days).toBe(30);
  expect(saved.scoping.find((item) => item.packageId === "linear:b")?.status).toBe("needs_scoping");
  expect(saved.weeklyAdjustments).toHaveLength(0);
  await selectSection(page, "Capacity assumptions");
  await expect(settings(page).getByLabel("Manual baseline (optional)")).toHaveValue("35");
  await selectSection(page, "Weekly availability and holidays");
  await expect(settings(page).getByLabel("Week availability %")).toHaveValue("75");
  await expect(settings(page).getByLabel("Week label (optional)")).toHaveValue("Team leave");
  await page.keyboard.press("Escape");
  await openSettings(page);
  await expect(settings(page).getByLabel("Manual baseline (optional)")).toHaveValue("20");
  await selectSection(page, "Scope readiness");
  await expect(settings(page).getByLabel("Scope projects (days before start)")).toHaveValue("30");
  await page.keyboard.press("Escape");
  await expect(page.locator('#sequencing-board #capacity-settings, #sequencing-board #scoping-settings, #sequencing-board #calendar-availability')).toHaveCount(0);
});

test("capacity validation retains inputs and saved assumptions update Outcomes without a reload", async ({ page, assignment }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  const initialDate = (await assignment.board()).forecast.outcomes[0].endDate!;
  await openSettings(page);
  await settings(page).getByLabel("Manual baseline (optional)").fill("10");
  await settings(page).getByLabel("Manual baseline source / override reason").fill("");
  await settings(page).getByRole("button", { name: "Save capacity", exact: true }).click();
  await expect(settings(page).getByRole("alert")).toContainText("Explain the provisional baseline");
  await expect(settings(page).getByLabel("Manual baseline (optional)")).toHaveValue("10");
  expect((await assignment.board()).capacity.baseline).toBe(20);
  await settings(page).getByLabel("Manual baseline source / override reason").fill("Reduced delivery capacity");
  await settings(page).getByLabel("Reserve points/cycle").fill("1");
  await settings(page).getByLabel("Forecast horizon (cycles)").fill("8");
  // The successful PUT already contains the recalculated board. A failed
  // background GET must not put the old delivery forecast back on screen.
  await page.route("**/api/board", (route) => route.request().method() === "GET" ? route.fulfill({ status: 503, json: { error: "Background read unavailable" } }) : route.fallback());
  await settings(page).getByRole("button", { name: "Save capacity", exact: true }).click();
  await expect(settings(page).getByRole("status")).toContainText("Capacity profile saved");
  const changed = await assignment.board();
  expect(changed.capacity).toMatchObject({ baseline: 10, reserve: 1, horizon: 8 });
  expect(changed.forecast.outcomes[0].endDate).not.toBe(initialDate);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Outcome delivery", exact: true })).toContainText(changed.forecast.outcomes[0].endDate!);
  await page.unroute("**/api/board");
  await openSettings(page);
  await expect(settings(page)).toContainText("Effective baseline: 10 points/cycle");
  await expect(settings(page).getByLabel("Forecast horizon (cycles)")).toHaveValue("8");
});

test("capacity evidence permits an observed median and rejects a blank baseline without evidence", async ({ page, assignment }) => {
  await page.goto("/");
  await openSettings(page);
  await settings(page).getByLabel("Manual baseline (optional)").fill("");
  await settings(page).getByRole("button", { name: "Save capacity", exact: true }).click();
  await expect(settings(page).getByRole("alert")).toContainText("Fewer than three comparable");
  expect((await assignment.board()).capacity.baseline).toBe(20);
  await page.keyboard.press("Escape");
  await assignment.observeCapacity();
  await openSettings(page);
  await expect(settings(page)).toContainText("Observed median: 20 points/cycle from 3 cycles");
  await settings(page).getByText("Comparable completed cycles", { exact: true }).click();
  await expect(settings(page)).toContainText("18 completed points");
  await settings(page).getByLabel("Manual baseline (optional)").fill("");
  await settings(page).getByRole("button", { name: "Save capacity", exact: true }).click();
  await expect(settings(page).getByRole("status")).toContainText("Capacity profile saved");
  expect((await assignment.board()).capacity.baseline).toBeNull();
  await expect(settings(page)).toContainText("Linear observations");
});

test("weekly defaults, overrides, removals, and cycle fallback remain separate assumptions", async ({ page, assignment }) => {
  await assignment.setCycleAvailability(.4);
  await page.goto("/");
  await openSettings(page, "Weekly availability and holidays");
  await settings(page).getByLabel("Week starting (Monday)").fill("2026-11-30");
  await expect(settings(page).getByLabel("Week availability %")).toHaveValue("40");
  await settings(page).getByLabel("Week starting (Monday)").fill("2026-11-23");
  await expect(settings(page).getByLabel("Week availability %")).toHaveValue("50");
  await settings(page).getByLabel("Week availability %").fill("75");
  await settings(page).getByLabel(/US Thanksgiving/).uncheck();
  await expect(settings(page).getByRole("status")).toContainText("Holiday availability updated");
  await expect(settings(page).getByLabel("Week availability %")).toHaveValue("75");
  expect((await assignment.board()).capacity.holidays_enabled).toBe(false);
  await settings(page).getByRole("button", { name: "Save week availability" }).click();
  await expect(settings(page).getByRole("status")).toContainText("Week availability saved");
  expect((await assignment.board()).weeklyAdjustments[0].availability).toBe(.75);
  await settings(page).getByRole("button", { name: "Remove override for 2026-11-23" }).click();
  await expect(settings(page).getByLabel("Week availability %")).toHaveValue("40");
  await settings(page).getByLabel(/US Thanksgiving/).check();
  await expect(settings(page).getByLabel("Week availability %")).toHaveValue("50");
  expect((await assignment.board()).weeklyAdjustments).toHaveLength(0);
});

test("load failures offer retry and failed writes retain the editable draft", async ({ page, assignment }) => {
  await page.goto("/");
  await openSettings(page);
  await settings(page).getByRole("button", { name: "Close Settings" }).click();
  let failLoad = true;
  let failSave = true;
  await page.route("**/api/board", async (route) => {
    if (route.request().method() === "GET" && failLoad && await settings(page).isVisible()) { failLoad = false; return route.fulfill({ status: 503, json: { error: "Settings temporarily unavailable" } }); }
    if (route.request().method() === "PUT" && failSave) { failSave = false; return route.fulfill({ status: 503, json: { error: "Save temporarily unavailable" } }); }
    return route.fallback();
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(settings(page).getByRole("alert")).toContainText("Settings temporarily unavailable");
  await expect(settings(page).locator("form")).toHaveCount(0);
  await settings(page).getByRole("button", { name: "Retry loading settings" }).click();
  await selectSection(page, "Scope readiness");
  await settings(page).getByLabel("Scope projects (days before start)").fill("33");
  await settings(page).getByRole("button", { name: "Save scoping window" }).click();
  await expect(settings(page).getByRole("alert")).toContainText("Save temporarily unavailable");
  await expect(settings(page).getByLabel("Scope projects (days before start)")).toHaveValue("33");
  expect((await assignment.board()).capacity.scoping_lead_days).toBe(14);
  await settings(page).getByRole("button", { name: "Save scoping window" }).click();
  await expect(settings(page).getByRole("status")).toContainText("Scoping window saved");
  expect((await assignment.board()).capacity.scoping_lead_days).toBe(33);
});

test("closing and reopening during a submitted write waits for one canonical completion", async ({ page, assignment }) => {
  await page.goto("/");
  await openSettings(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let writes = 0;
  await page.route("**/api/board", async (route) => {
    if (route.request().method() === "PUT") { writes++; await gate; }
    await route.fallback();
  });
  await settings(page).getByLabel("Manual baseline (optional)").fill("30");
  await settings(page).getByRole("button", { name: "Save capacity", exact: true }).click();
  await expect(settings(page).getByRole("button", { name: "Save capacity", exact: true })).toBeDisabled();
  await settings(page).getByRole("button", { name: "Close Settings" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(settings(page).getByRole("status")).toContainText("Finishing the previous settings save");
  await expect(settings(page).locator("form")).toHaveCount(0);
  release();
  await expect(settings(page).getByLabel("Manual baseline (optional)")).toHaveValue("30");
  expect(writes).toBe(1);
  expect((await assignment.board()).capacity.baseline).toBe(30);
});

test("late responses from a dismissed opening cannot reset a newer opening", async ({ page, assignment }) => {
  await page.goto("/");
  await openSettings(page);
  await settings(page).getByRole("button", { name: "Close Settings" }).click();
  const stale = await assignment.board();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let first = true;
  await page.route("**/api/board", async (route) => {
    // Board also reads this endpoint during workspace startup. Delay the first
    // Settings read, rather than accidentally capturing a background Board read.
    if (route.request().method() === "GET" && first && await settings(page).isVisible()) { first = false; await gate; await route.fulfill({ json: stale }); }
    else await route.fallback();
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(settings(page).getByRole("status")).toContainText("Loading settings");
  await page.keyboard.press("Escape");
  await assignment.setCapacity(35);
  await openSettings(page);
  await expect(settings(page).getByLabel("Manual baseline (optional)")).toHaveValue("35");
  release();
  await settings(page).getByLabel("Manual baseline (optional)").fill("36");
  await expect(settings(page).getByLabel("Manual baseline (optional)")).toHaveValue("36");
});

test("a failed workspace refresh is reported as saved and retry does not submit again", async ({ page, assignment }) => {
  await page.goto("/");
  await openSettings(page, "Scope readiness");
  let failRefresh = true;
  let writes = 0;
  await page.route("**/api/state", (route) => failRefresh ? route.fulfill({ status: 503, json: { error: "Workspace offline" } }) : route.fallback());
  await page.route("**/api/board", (route) => { if (route.request().method() === "PUT") writes++; return route.fallback(); });
  await settings(page).getByLabel("Scope projects (days before start)").fill("42");
  await settings(page).getByRole("button", { name: "Save scoping window" }).click();
  await expect(settings(page).getByRole("status")).toContainText("Scoping window saved");
  await expect(settings(page).getByRole("alert")).toContainText("Settings were saved");
  expect((await assignment.board()).capacity.scoping_lead_days).toBe(42);
  failRefresh = false;
  await settings(page).getByRole("button", { name: "Retry workspace refresh" }).click();
  await expect(settings(page).getByRole("alert")).toHaveCount(0);
  expect(writes).toBe(1);
});

test("contextual entry focuses baseline and timeline weeks and restores the originating controls", async ({ page, assignment }) => {
  await assignment.setCapacity(null);
  await page.goto("/");
  const setup = page.getByRole("button", { name: /Set capacity baseline/ });
  await setup.click();
  await expect(settings(page).getByLabel("Manual baseline (optional)")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(setup).toBeFocused();
  const project = page.locator('.unscheduled-project[data-timeline-project="linear:a"]').first();
  await project.click();
  const drawer = page.getByRole("dialog", { name: "API foundation", exact: true });
  await drawer.getByRole("button", { name: "Review stream capacity", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(settings(page).getByLabel("Manual baseline (optional)")).toBeFocused();
  await settings(page).getByLabel("Manual baseline (optional)").fill("20");
  await settings(page).getByRole("button", { name: "Save capacity", exact: true }).click();
  await expect(settings(page).getByRole("status")).toContainText("Capacity profile saved");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  const week = page.getByRole("region", { name: /^Core forecast timeline/ }).getByRole("button", { name: "Edit week of 2026-11-23", exact: true });
  for (let index = 0; index < 2; index++) {
    await week.focus(); await page.keyboard.press("Enter");
    await expect(settings(page).getByLabel("Week starting (Monday)")).toHaveValue("2026-11-23");
    await expect(settings(page).getByLabel("Week starting (Monday)")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(week).toBeFocused();
  }
  await page.getByRole("button", { name: /^Scenarios/ }).click();
  await expect(page.locator(".scenario-readiness")).toContainText("Board ready to capture");
});

test("invalid weekly and scoping values do not write; a rejected holiday toggle rolls back", async ({ page, assignment }) => {
  await page.goto("/");
  await openSettings(page, "Scope readiness");
  const lead = settings(page).getByLabel("Scope projects (days before start)");
  for (const value of ["-1", "1.5", "366"]) {
    await lead.fill(value);
    await settings(page).getByRole("button", { name: "Save scoping window" }).click();
    expect(await lead.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(false);
  }
  expect((await assignment.board()).capacity.scoping_lead_days).toBe(14);
  await selectSection(page, "Weekly availability and holidays");
  await settings(page).getByLabel("Week starting (Monday)").fill("2026-11-23");
  await settings(page).getByLabel("Week availability %").fill("101");
  await settings(page).getByRole("button", { name: "Save week availability" }).click();
  expect((await assignment.board()).weeklyAdjustments).toHaveLength(0);
  await page.route("**/api/board", (route) => route.request().method() === "PUT" ? route.fulfill({ status: 503, json: { error: "Holiday change rejected" } }) : route.fallback());
  await settings(page).getByLabel(/US Thanksgiving/).click();
  await expect(settings(page).getByRole("alert")).toContainText("Holiday change rejected");
  await expect(settings(page).getByLabel(/US Thanksgiving/)).toBeChecked();
  expect((await assignment.board()).capacity.holidays_enabled).toBe(true);
});

test("scenario readiness and dirty state refresh; scenario activation restores Settings without altering published assumptions", async ({ page, assignment }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Scenarios/ }).click();
  await page.getByLabel("Scenario name").fill("Original assumptions");
  await page.getByRole("button", { name: "Create from board" }).click();
  await expect(page.getByRole("status")).toContainText("Scenario draft created");
  await page.getByLabel("Decision rationale").fill("Original scope window");
  await page.getByRole("button", { name: "Publish revision" }).click();
  await expect(page.getByRole("status")).toContainText("Immutable revision published");
  await openSettings(page, "Scope readiness");
  await settings(page).getByLabel("Scope projects (days before start)").fill("30");
  await settings(page).getByRole("button", { name: "Save scoping window" }).click();
  await expect(settings(page).getByRole("status")).toContainText("Scoping window saved");
  await page.keyboard.press("Escape");
  await expect(page.locator(".publish-box")).toContainText("The board has unsaved changes");
  await page.getByLabel("Scenario name").fill("Longer scope window");
  await page.getByRole("button", { name: "Create from board" }).click();
  await expect(page.locator(".scenario-draft h3")).toHaveText("Longer scope window");
  await page.getByLabel("Selected draft").selectOption({ label: "Original assumptions" });
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Load draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft loaded onto the board");
  await openSettings(page, "Scope readiness");
  await expect(settings(page).getByLabel("Scope projects (days before start)")).toHaveValue("14");
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "From", exact: true }).selectOption({ label: "Original assumptions r1" });
  await page.getByRole("combobox", { name: "To", exact: true }).selectOption({ label: "Longer scope window draft" });
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator(".comparison").first()).toContainText("Scope projects 14 → 30 days before start");
  expect((await assignment.board()).capacity.scoping_lead_days).toBe(14);
});

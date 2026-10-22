import { test, expect } from "./assignment-fixture";

test("configurable stream lanes immediately follow Planning attention, followed by stream management", async ({ page, assignment }) => {
  await page.goto("/");
  const board = page.locator("#sequencing-board");
  await expect(board.locator("#project-streams > .stream-lane")).toHaveCount(2);
  expect(await board.locator(".action-center").evaluate((element) => element.nextElementSibling?.id)).toBe("project-streams");
  expect(await board.locator("#project-streams").evaluate((element) => element.nextElementSibling?.classList.contains("stream-manager"))).toBe(true);
  await expect(board.getByRole("heading", { name: "Outcome delivery" })).toHaveCount(0);
  const manager = board.locator(".stream-manager");
  await manager.locator("summary").first().click();
  await expect(manager).toContainText("Each stream runs one project at a time");
  await expect(manager.getByLabel("WIP limit")).toHaveCount(0);
  await manager.getByLabel("Name", { exact: true }).fill("New focus");
  await manager.getByRole("button", { name: "Add at 0%" }).click();
  await expect(board.locator("#project-streams > .stream-lane")).toHaveCount(3);
  await expect(board.getByRole("heading", { name: "New focus", exact: true })).toBeVisible();
  await expect(board.locator("#project-streams")).toContainText("1 project at a time");
  expect((await assignment.board()).streams).toHaveLength(3);
  expect(await board.locator("#project-streams").evaluate((element) => element.nextElementSibling?.classList.contains("stream-manager"))).toBe(true);
});

test("Outcome delivery belongs to Outcomes and shares editing, links, deletion and fresh board forecasts", async ({ page, assignment }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  const delivery = page.getByRole("region", { name: "Outcome delivery", exact: true });
  await expect(delivery).toBeVisible();
  const initialDate = (await assignment.board()).forecast.outcomes[0].endDate!;
  await expect(delivery).toContainText(initialDate);
  await delivery.getByRole("button", { name: "Links", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Launch", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await delivery.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Outcome title", { exact: true }).filter({ visible: true })).toBeFocused();
  const editor = page.locator(".outcome-card .outcome-form");
  await editor.getByLabel("Outcome title").fill("Launch readiness");
  await editor.getByRole("button", { name: "Save outcome" }).click();
  await expect(delivery).toContainText("Launch readiness");
  await expect(page.locator("#outcome-catalog").getByRole("heading", { name: "Launch readiness" })).toBeVisible();
  await page.getByRole("button", { name: /^Board/ }).click();
  await page.locator("#stream-work-core > summary").click();
  await page.getByRole("button", { name: "Move Web experience up", exact: true }).click();
  await expect(page.locator("#sequencing-board").getByRole("status")).toContainText("Web experience moved");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  const changedDate = (await assignment.board()).forecast.outcomes[0].endDate!;
  expect(changedDate).not.toBe(initialDate);
  await expect(delivery).toContainText(changedDate);
  page.once("dialog", (dialog) => void dialog.accept());
  await delivery.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(delivery).toContainText("Add an outcome, then link its minimum-required projects.");
  await expect(page.locator("#outcome-catalog")).toContainText("No outcomes yet");
});

test("new outcomes and their project links are created together in the outcome modal", async ({ page, assignment }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  const catalog = page.locator("#outcome-catalog");
  await catalog.getByRole("button", { name: "Add outcome", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Add outcome", exact: true });
  await expect(modal).toBeVisible();
  await modal.getByLabel("Outcome title", { exact: true }).fill("Onboarding complete");
  const apiFoundation = modal.getByRole("checkbox", { name: /API foundation/ });
  await apiFoundation.check();
  await expect(apiFoundation).toBeChecked();
  await modal.getByLabel("API foundation requirement").selectOption("optional");
  await modal.getByRole("button", { name: "Create outcome", exact: true }).click();
  await expect(modal).toHaveCount(0);
  const outcome = catalog.locator(".outcome-card").filter({ has: page.getByRole("heading", { name: "Onboarding complete", exact: true }) });
  await expect(outcome).toContainText("API foundation");
  await expect(outcome).toContainText("optional");
  const board = await assignment.board();
  const created = board.outcomes.find((item) => item.title === "Onboarding complete");
  expect(created).toBeTruthy();
  expect(board.links).toContainEqual({ outcome_id: created!.id, project_id: "a", requirement: "optional" });
});

test("planning blockers open Outcomes and Resolve blocker returns to the right project scope editor", async ({ page, assignment }) => {
  await assignment.requireProject("a");
  await assignment.setDemand("a", null);
  await assignment.pauseUnassigned();
  await page.goto("/");
  await page.getByRole("button", { name: /Forecast blockers remain/ }).click();
  await expect(page.getByRole("button", { name: /^Outcomes/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Outcome delivery", exact: true })).toBeFocused();
  const delivery = page.getByRole("region", { name: "Outcome delivery", exact: true });
  await delivery.getByRole("button", { name: "Resolve blocker" }).click();
  await expect(page.getByRole("button", { name: /^Board/ })).toHaveAttribute("aria-current", "page");
  const project = page.locator('[data-project-id="linear:a"]');
  await expect(project.getByLabel("Extra scope points")).toBeFocused();
  await project.getByLabel("Extra scope points").fill("5");
  await project.getByRole("button", { name: "Save extra scope" }).click();
  await expect(page.getByRole("status")).toContainText("extra scope saved");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  await expect(delivery.getByRole("button", { name: "Resolve blocker" })).toHaveCount(0);
  await expect(delivery).toContainText("provisional");
});

test("cycle-wide controls explain their scope and link to the separate weekly availability editor", async ({ page, assignment }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const cycles = page.locator("#cycle-calendar-settings");
  await cycles.locator("summary").first().click();
  await expect(cycles).toContainText("override availability or reserve for entire cycles");
  await expect(cycles.getByRole("heading", { name: "Whole-cycle capacity override" })).toBeVisible();
  await cycles.getByRole("button", { name: "Weekly availability and holidays", exact: true }).click();
  const weekly = page.locator("#calendar-availability");
  await expect(weekly.getByLabel("Week starting (Monday)")).toBeVisible();
  await expect(weekly).toContainText(/week override/i);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  expect((await assignment.board()).capacity.holidays_enabled).toBe(true);
});

test("Outcomes explains a forecast load failure rather than leaving delivery stuck loading", async ({ page, assignment }) => {
  await page.route("**/api/board", (route) => route.fulfill({ status: 503, json: { error: "Forecast temporarily unavailable" } }));
  await page.goto("/");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  const delivery = page.getByRole("region", { name: "Outcome delivery", exact: true });
  await expect(delivery.getByRole("alert")).toContainText("Forecast temporarily unavailable");
  await expect(delivery.getByText("Loading delivery forecasts…")).toHaveCount(0);
  expect((await assignment.board()).outcomes).toHaveLength(1);
});

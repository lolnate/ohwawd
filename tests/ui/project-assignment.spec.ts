import { test, expect } from "./assignment-fixture";

const project = (id: string) => `[data-project-id="linear:${id}"]`;

test("a source dependency conflict explains the blocker and repairs stream order explicitly", async ({ page, assignment }) => {
  await assignment.addSourceConflict();
  await page.goto("/");
  await expect(page.locator(project("a")).locator(".dependency-context")).toContainText("blocked by Web experience");
  await expect(page.locator(".sequence-conflict")).toContainText("Web experience must precede API foundation");
  await page.getByRole("button", { name: "Put blocker first", exact: true }).click();
  await expect(page.getByRole("list", { name: "Core project sequence" }).locator("article").first()).toContainText("Web experience");
  await expect(page.locator(".sequence-conflict")).toHaveCount(0);
  const board = await assignment.board();
  expect(board.forecast.packages.find((item) => item.id === "linear:a")!.start).toBe(2);
});

test("pointer drag saves queue order independently of Linear priority and survives reload", async ({ page, assignment }) => {
  await page.goto("/");
  const core = page.getByRole("list", { name: "Core project sequence" });
  await expect(core.locator("article")).toHaveCount(2);
  await expect(core.locator("article").first()).toContainText("API foundation");
  await page.getByRole("button", { name: "Drag Web experience", exact: true }).dragTo(page.locator('[data-drop-stream="core"][data-before="linear:a"]'));
  await expect(core.locator("article").first()).toContainText("Web experience");
  await expect(page.getByRole("status")).toContainText("Web experience moved to Core before API foundation");
  await expect(page.getByRole("button", { name: "Drag Web experience", exact: true })).toBeFocused();
  expect((await assignment.board()).packages.find((item) => item.project_id === "b")!.sequence_position).toBe(1);
  await page.reload();
  await expect(core.locator("article").first()).toContainText("Web experience");
  await expect(page.locator(project("b"))).toContainText("Linear priority: Urgent");
});

test("keyboard moves reject dependency reversal and location controls support cross-stream and optional deferral", async ({ page, assignment }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Drag Web experience", exact: true }).focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.getByRole("list", { name: "Core project sequence" }).locator("article").first()).toContainText("Web experience");
  const rollout = page.locator(project("c"));
  await rollout.getByText("Plan this project", { exact: true }).click();
  await rollout.getByLabel("Location", { exact: true }).selectOption("core");
  await rollout.getByLabel("Place before", { exact: true }).selectOption("linear:a");
  await expect(rollout.getByRole("button", { name: "Move / save placement" })).toBeDisabled();
  await expect(rollout.getByText(/API foundation must precede Rollout/)).toBeVisible();
  await rollout.getByLabel("Place before", { exact: true }).selectOption("");
  await rollout.getByRole("button", { name: "Move / save placement" }).click();
  await expect(page.getByRole("list", { name: "Core project sequence" }).locator("article")).toHaveCount(3);
  const api = page.locator(project("a"));
  await api.getByText("Plan this project", { exact: true }).click();
  await api.getByLabel("Location", { exact: true }).selectOption("deferred");
  await expect(api.getByLabel("Pause rationale (optional)")).toBeEmpty();
  await api.getByRole("button", { name: "Move / save placement" }).click();
  await expect(page.locator("#deferred-work").locator(project("a"))).toBeVisible();
  expect((await assignment.board()).packages.find((item) => item.project_id === "a")!.selected).toBe(false);
  await expect(page.getByLabel("Priority rank")).toHaveCount(0);
  await expect(page.getByLabel("Preferred start")).toHaveCount(0);
  await expect(page.getByLabel("Hard not-before")).toHaveCount(0);
  await expect(page.getByLabel("Must include")).toHaveCount(0);
});

test("stale drop reloads saved order and retains a usable focused project", async ({ page, assignment }) => {
  await page.goto("/");
  await expect(page.locator(project("b"))).toBeVisible();
  assignment.invalidateNextMove();
  const transfer = await page.evaluateHandle(() => { const data = new DataTransfer(); data.setData("text/plain", "linear:a"); return data; });
  await page.locator('[data-drop-stream="core"][data-before="linear:b"]').dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.locator("#sequencing-board").getByRole("alert")).toContainText("sequence or dependencies changed");
  await expect(page.getByRole("list", { name: "Core project sequence" }).locator("article").first()).toContainText("Web experience");
  await expect(page.getByRole("button", { name: "Drag API foundation", exact: true })).toBeFocused();
});

test.describe("touch controls", () => {
test.use({ hasTouch: true });
test("edit one extra budget and refresh scope attention across midnight", async ({ page, assignment }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date("2026-11-05T23:59:59Z") });
  await page.goto("/");
  await page.getByRole("button", { name: "Move Web experience up", exact: true }).tap();
  const web = page.locator(project("b"));
  await web.getByText("Plan this project", { exact: true }).tap();
  await web.getByLabel("Extra scope points").fill("6");
  await web.getByRole("button", { name: "Save extra scope" }).tap();
  await expect(web).toContainText("Scope by 2026-11-06");
  await expect(web).toContainText("provisional");
  await expect(web.getByLabel("Owner", { exact: true })).toHaveCount(0);
  await expect(web.getByLabel("Review date")).toHaveCount(0);
  assignment.time("2026-11-06T00:00:01Z");
  await page.clock.fastForward(2100);
  await expect(web.getByText("Needs scoping", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /Needs scoping · Web experience/ }).click();
  await expect(web.getByLabel("Extra scope points")).toBeVisible();
  await expect(web.getByLabel("Extra scope points")).toBeFocused();
  await expect(web.getByText(/Forecast:/)).toBeVisible();
  await page.locator("#scoping-settings > summary").click();
  await page.getByLabel("Scope projects (days before start)").fill("21");
  await page.getByRole("button", { name: "Save scoping window" }).click();
  expect((await assignment.board()).capacity.scoping_lead_days).toBe(21);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});
});

test("board changes can be saved, compared and published as v3 scenarios", async ({ page, assignment }) => {
  await page.goto("/");
  const discovery = page.locator(project("d"));
  await discovery.getByText("Plan this project", { exact: true }).click();
  await discovery.getByLabel("Extra scope points").fill("4");
  await discovery.getByRole("button", { name: "Save extra scope" }).click();
  await discovery.getByLabel("Location", { exact: true }).selectOption("delivery");
  await discovery.getByRole("button", { name: "Move / save placement" }).click();
  await expect(page.getByRole("list", { name: "Delivery project sequence" }).locator("article")).toHaveCount(2);
  await page.getByRole("button", { name: /^Scenarios/ }).click();
  await page.getByLabel("Scenario name").fill("Launch sequence");
  await page.getByRole("button", { name: "Create from board" }).click();
  await expect(page.getByRole("status")).toContainText("Scenario draft created");
  await page.getByLabel("Decision rationale").fill("Use the arranged queue and rough scope.");
  await page.getByRole("button", { name: "Publish revision" }).click();
  await expect(page.getByRole("status")).toContainText("Immutable revision published");
  await page.getByRole("button", { name: /^Board/ }).click();
  await page.getByRole("button", { name: "Move Web experience up", exact: true }).click();
  await page.getByRole("button", { name: /^Scenarios/ }).click();
  await page.getByRole("button", { name: "Save board", exact: true }).click();
  await page.getByLabel("Decision rationale").fill("Web work first.");
  await page.getByRole("button", { name: "Publish revision" }).click();
  await expect(page.getByRole("status")).toContainText("Immutable revision published");
  await page.getByRole("combobox", { name: "From", exact: true }).selectOption({ label: "Launch sequence r1" });
  await page.getByRole("combobox", { name: "To", exact: true }).selectOption({ label: "Launch sequence r2" });
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByText(/Calculation: v3 → v3/)).toBeVisible();
  await expect(page.locator(".comparison p").filter({ hasText: /Web experience.*position 2.*position 1/ })).toBeVisible();
  expect((await assignment.board()).calculationVersion).toBe("v3");
});

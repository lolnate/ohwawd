import { test, expect } from "./assignment-fixture";

const foundation = "00000000-0000-4000-8000-000000000002";
const launch = "00000000-0000-4000-8000-000000000001";
const retention = "00000000-0000-4000-8000-000000000003";

test("outcome rows show every shared appearance and switching owner updates one charge immediately", async ({ page, assignment }) => {
  await assignment.shareProjects();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const counted = page.locator(`[data-timeline-outcome="${foundation}"] [data-timeline-project="linear:a"]`);
  const reference = page.locator(`[data-timeline-outcome="${launch}"] [data-timeline-project="linear:a"]`);
  await expect(page.getByRole("columnheader", { name: /^Outcome/ })).toHaveCount(2);
  await expect(page.locator('[data-timeline-project="linear:a"]')).toHaveCount(3);
  await expect(counted).toHaveClass(/counted-project/);
  const sibling = page.locator(`[data-timeline-outcome="${foundation}"] [data-timeline-project="linear:b"]`);
  const [firstBox, secondBox] = await Promise.all([counted.boundingBox(), sibling.boundingBox()]);
  expect(Math.abs(firstBox!.y - secondBox!.y)).toBeGreaterThanOrEqual(30);
  await expect(reference).toHaveClass(/shared-project/);
  await expect(reference).toHaveAttribute("title", /Shared · 0 pts here. Counted in Foundation · Core/);
  const original = await assignment.board();
  await reference.click();
  const drawer = page.getByRole("dialog", { name: "API foundation", exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("The API foundation scope imported from Linear.");
  await expect(drawer).toContainText("5 modeled points");
  await expect(drawer.getByRole("heading", { name: "API foundation", exact: true })).toBeFocused();
  if (process.env.OUTCOME_DRAWER_SCREENSHOT) await drawer.screenshot({ path: process.env.OUTCOME_DRAWER_SCREENSHOT });
  await drawer.getByLabel("Count points toward outcome / stream").selectOption(launch);
  await expect(drawer.getByRole("status")).toContainText("capacity owner updated");
  await expect(drawer.locator(".capacity-owner-location")).toContainText("Launch · Delivery");
  await expect(reference).toHaveClass(/counted-project/);
  await expect(counted).toHaveClass(/shared-project/);
  const saved = await assignment.board();
  expect(saved.forecast.selectedKnown).toBe(original.forecast.selectedKnown);
  expect(saved.packages.filter((item) => item.project_id === "a")).toHaveLength(1);
  expect(saved.packages.find((item) => item.project_id === "a").stream_id).toBe("delivery");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(reference).toBeFocused();
  await page.reload();
  await expect(reference).toHaveClass(/counted-project/);
  await expect(counted).toHaveClass(/shared-project/);
  if (process.env.OUTCOME_SCREENSHOT) await page.locator("#project-streams").screenshot({ path: process.env.OUTCOME_SCREENSHOT });
});

test("outcomes can be unassigned and reassigned without stealing other capacity owners", async ({ page, assignment }) => {
  await assignment.shareProjects();
  await page.goto("/");
  await page.locator("#stream-work-core > summary").click();
  const group = page.locator("#stream-work-core .assignment-group").filter({ has: page.locator("strong").filter({ hasText: /^Foundation$/ }) });
  await group.getByRole("button", { name: "Unassign outcome", exact: true }).click();
  await expect(page.locator(`[data-timeline-outcome="${foundation}"]`)).toHaveCount(0);
  await expect(page.locator('[data-timeline-outcome="other:core"]')).toContainText("8 pts counted here");
  await page.getByLabel("Assign Foundation to stream", { exact: true }).selectOption("delivery");
  await expect(page.locator(`#stream-delivery [data-timeline-outcome="${foundation}"]`)).toBeVisible();
  const board = await assignment.board();
  expect(board.packages.find((project) => project.project_id === "a").capacity_outcome_id).toBe(foundation);
  expect(board.packages.find((project) => project.project_id === "a").stream_id).toBe("delivery");
  expect(board.packages.find((project) => project.project_id === "c").capacity_outcome_id).toBe(launch);
  expect(board.forecast.selectedKnown).toBe(10);
});

test("same-stream ownership, dependency navigation, stale rejection and empty outcomes remain clear", async ({ page, assignment }) => {
  await assignment.shareProjects();
  await page.goto("/");
  const reference = page.locator(`[data-timeline-outcome="${retention}"] [data-timeline-project="linear:a"]`);
  await reference.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Count points toward outcome / stream").selectOption(retention);
  await expect(drawer.getByRole("status")).toContainText("capacity owner updated");
  expect((await assignment.board()).packages.find((item) => item.project_id === "a").stream_id).toBe("core");
  await drawer.getByRole("button", { name: "ROLL · Rollout", exact: true }).click();
  await expect(drawer.getByRole("heading", { name: "Rollout", exact: true })).toBeFocused();
  await expect(drawer).toContainText("Blocked by");
  await drawer.getByRole("button", { name: "AF · API foundation", exact: true }).click();
  await assignment.changeOwner(foundation);
  await drawer.getByLabel("Count points toward outcome / stream").selectOption(launch);
  await expect(drawer.getByRole("alert")).toContainText("ownership changed");
  await expect(drawer.getByLabel("Count points toward outcome / stream")).toHaveValue(foundation);
  await drawer.getByRole("button", { name: "Close project details" }).click();
  await expect(reference).toBeFocused();
  await expect(page.locator('[data-timeline-outcome="00000000-0000-4000-8000-000000000004"]')).toContainText("No linked projects yet");
});

test.describe("touch sidebar", () => {
test.use({ hasTouch: true });
test("mobile sidebar edits scope and restores a stable focus target when its fallback row disappears", async ({ page, assignment }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const block = page.locator('[data-timeline-outcome="other:core"] [data-timeline-project="linear:a"]');
  await block.tap();
  const drawer = page.getByRole("dialog", { name: "API foundation", exact: true });
  await expect(drawer).toBeVisible();
  await drawer.getByLabel("Extra scope points").fill("4");
  await drawer.getByRole("button", { name: "Save extra scope", exact: true }).tap();
  await expect(drawer.getByRole("status")).toContainText("extra scope saved");
  await expect(drawer).toContainText("9 modeled points");
  // Deferring removes the originating timeline block entirely.
  await drawer.getByLabel("Location", { exact: true }).selectOption("deferred");
  await drawer.getByRole("button", { name: "Move / save placement" }).tap();
  await expect(drawer.locator(".capacity-owner-location")).toContainText("Deferred");
  await drawer.getByRole("button", { name: "Close project details" }).tap();
  await expect(page.locator("#project-streams h3").first()).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});
});

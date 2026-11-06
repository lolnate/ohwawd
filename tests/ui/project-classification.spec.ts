import { test, expect } from "./assignment-fixture";

test.beforeEach(async ({ assignment }) => {
  await assignment.activateRoadmap();
  await assignment.setClassification("a", "both", null);
});

test("shows exact source conflict and source-authoritative overridden local intent", async ({ page, assignment }) => {
  await assignment.setClassification("b", "roadmap", "ongoing");
  await page.goto("/");
  const needs = page.getByRole("region", { name: "Needs classification" });
  await expect(needs).toContainText("Linear label conflict: Roadmap (roadmap-a) and Ongoing (ongoing-a)");
  await expect(needs).toContainText("Unresolved");

  await page.getByRole("button", { name: /^Linear projects/ }).click();
  const row = page.locator(".project-row", { hasText: "Web experience" });
  await expect(row).toContainText("Roadmap · Linear label");
  await row.getByRole("button", { name: "Plan on Board" }).click();
  const drawer = page.getByRole("dialog", { name: "Web experience" });
  await expect(drawer).toContainText("Linear source label: Roadmap (roadmap-b)");
  await expect(drawer).toContainText("Saved local intent (Ongoing) is retained but overridden");
  await expect(drawer.getByLabel("Ongoing")).toBeChecked();
});

test("places drawer classification last without warning when local and Linear decisions agree", async ({ page, assignment }) => {
  await assignment.setClassification("b", "roadmap", "roadmap");
  await page.goto("/");
  await page.getByRole("button", { name: /^Linear projects/ }).click();
  const row = page.locator(".project-row", { hasText: "Web experience" });
  await row.getByRole("button", { name: "Plan on Board" }).click();
  const drawer = page.getByRole("dialog", { name: "Web experience" });
  await expect(drawer).toContainText("Linear source label: Roadmap");
  await expect(drawer.locator(".classification-override")).toHaveCount(0);
  const classification = drawer.locator(".project-classification");
  await expect(drawer.locator(".project-drawer-body > section").last()).toHaveClass(/project-classification/);
  expect(await classification.evaluate((element) => ({
    left: getComputedStyle(element).borderLeftWidth,
    right: getComputedStyle(element).borderRightWidth,
    radius: getComputedStyle(element).borderRadius,
  }))).toEqual({ left: "0px", right: "0px", radius: "0px" });
});

test("keyboard save refreshes classification, restores focus, persists, and contains at 390px", async ({ page, assignment }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const needs = page.getByRole("region", { name: "Needs classification" });
  const optionHeights = await needs.locator(".project-classification fieldset label").evaluateAll((labels) => labels.map((label) => label.getBoundingClientRect().height));
  expect(optionHeights.every((height) => height < 32)).toBe(true);
  await needs.getByLabel("Roadmap").focus();
  await page.keyboard.press("ArrowRight");
  await expect(needs.getByLabel("Ongoing")).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(needs.getByRole("button", { name: "Save local classification" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("API foundation local classification saved as Ongoing");
  await expect(needs).toHaveCount(0);
  await expect(page.locator("#ongoing-work-title")).toBeFocused();
  expect((await assignment.board()).packages.find((item) => item.project_id === "a")?.effective_classification).toBe("ongoing");
  await page.reload();
  expect((await assignment.board()).packages.find((item) => item.project_id === "a")?.local_classification).toBe("ongoing");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("rejected save retains the chosen draft for retry", async ({ page }) => {
  await page.goto("/");
  const needs = page.getByRole("region", { name: "Needs classification" });
  await needs.getByLabel("Ongoing").check();
  await page.route("**/api/board", (route) => route.request().method() === "PUT" && route.request().postDataJSON().type === "classification"
    ? route.fulfill({ status: 503, json: { error: "Classification save rejected" } }) : route.fallback());
  await needs.getByRole("button", { name: "Save local classification" }).click();
  await expect(page.locator('.dismissible-message[role="alert"]')).toContainText("Classification save rejected");
  await expect(needs.getByLabel("Ongoing")).toBeChecked();
  await expect(needs.getByRole("button", { name: "Save local classification" })).toBeEnabled();
  await page.unroute("**/api/board");
  await needs.getByRole("button", { name: "Save local classification" }).click();
  await expect(page.getByRole("status")).toContainText("saved as Ongoing");
});

test("stale planning conflict refreshes authority, announces conflict, and retains retry draft", async ({ page, assignment }) => {
  await page.goto("/");
  const needs = page.getByRole("region", { name: "Needs classification" });
  await needs.getByLabel("Ongoing").check();
  assignment.invalidateNextClassification();
  await needs.getByRole("button", { name: "Save local classification" }).click();
  await expect(page.locator('.dismissible-message[role="alert"]')).toContainText("planning context changed");
  await expect(needs.getByLabel("Ongoing")).toBeChecked();
  await expect(needs.getByRole("button", { name: "Save local classification" })).toBeFocused();
  await needs.getByRole("button", { name: "Save local classification" }).click();
  await expect(page.getByRole("status")).toContainText("saved as Ongoing");
});

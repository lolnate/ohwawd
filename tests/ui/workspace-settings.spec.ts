import { test, expect } from "./assignment-fixture";

const sectionNames = ["Capacity assumptions", "Scope readiness", "Weekly availability and holidays"];

test("Settings opens over every signed-in view, focuses its heading, and resets navigation on reopening", async ({ page, assignment }) => {
  await page.goto("/");
  const gear = page.getByRole("button", { name: "Settings", exact: true });
  await expect(gear).toHaveAttribute("aria-haspopup", "dialog");
  for (const name of ["Board", "Outcomes", "Linear projects", "Scenarios"]) {
    const view = page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: new RegExp(`^${name}`) });
    await view.click();
    await gear.click();
    const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
    await expect(dialog.getByRole("heading", { name: "Settings", exact: true })).toBeFocused();
    const nav = dialog.getByRole("navigation", { name: "Settings sections" });
    await expect(nav.getByRole("button", { name: sectionNames[0], exact: true })).toHaveAttribute("aria-current", "true");
    for (const section of sectionNames) {
      await nav.getByRole("button", { name: section, exact: true }).click();
      await expect(dialog.getByRole("heading", { name: section, exact: true })).toBeVisible();
      await expect(dialog.getByRole("heading", { level: 3 })).toHaveCount(1);
      await expect(dialog.getByRole("textbox")).toHaveCount(0);
    }
    await dialog.getByRole("button", { name: "Close Settings" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(gear).toBeFocused();
    await expect(view).toHaveAttribute("aria-current", "page");
  }
  expect((await assignment.board()).capacity.baseline).toBe(20);
});

test("opening Settings preserves project filters and page scroll", async ({ page, assignment }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Linear projects/ }).click();
  await page.getByRole("button", { name: /^All visible/ }).click();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("API");
  await page.locator(".project-filters .status-filter summary").click();
  await page.locator(".project-filters").getByRole("checkbox", { name: "planned", exact: true }).uncheck();
  await page.getByRole("combobox", { name: "Sort", exact: true }).selectOption("name");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toHaveValue("API");
  await expect(page.getByRole("combobox", { name: "Sort", exact: true })).toHaveValue("name");
  await expect(page.locator(".project-filters").getByRole("checkbox", { name: "planned", exact: true })).not.toBeChecked();
  await expect(page.locator(".project-filters").getByRole("checkbox", { name: "started", exact: true })).toBeChecked();
  await expect(page.locator(".project-result-summary")).toContainText("1 results");
  await page.getByRole("button", { name: /^Board/ }).click();
  await expect(page.locator("#sequencing-board")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 350));
  const scroll = await page.evaluate(() => window.scrollY);
  expect(scroll).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.mouse.wheel(0, 500);
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scroll);
  expect((await assignment.board()).capacity.baseline).toBe(20);
});

test("native modal contains focus, blocks background interaction, and protects inside clicks and drag-out", async ({ page, assignment }) => {
  await page.goto("/");
  const gear = page.getByRole("button", { name: "Settings", exact: true });
  await gear.click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press(index < 6 ? "Tab" : "Shift+Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.getByRole("button", { name: /^Outcomes/ }).evaluate((element: HTMLElement) => element.focus());
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await dialog.getByRole("heading", { name: "Capacity assumptions", exact: true }).click();
  const bounds = (await dialog.boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width - 20, bounds.y + bounds.height - 20);
  await expect(dialog).toBeVisible();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5);
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  // A backdrop click over the workspace header must not activate the view beneath it.
  const outcomes = (await page.getByRole("button", { name: /^Outcomes/ }).boundingBox())!;
  await page.mouse.click(outcomes.x + outcomes.width / 2, outcomes.y + outcomes.height / 2);
  await expect(dialog).toHaveCount(0);
  await expect(gear).toBeFocused();
  await expect(page.getByRole("button", { name: /^Board/ })).toHaveAttribute("aria-current", "page");
  await gear.click();
  await page.keyboard.press("Escape");
  await expect(gear).toBeFocused();
  expect((await assignment.board()).capacity.baseline).toBe(20);
});

test("dismissal falls back to the current header gear when the captured opener is replaced", async ({ page, assignment }) => {
  await page.goto("/");
  const gear = page.getByRole("button", { name: "Settings", exact: true });
  await gear.click();
  // Simulate replacement of a header control while the modal owns focus.
  await gear.evaluate((element) => element.replaceWith(element.cloneNode(true)));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toHaveCount(0);
  await expect(gear).toBeFocused();
  expect((await assignment.board()).capacity.baseline).toBe(20);
});

test("Settings is available before Linear connection without fabricated evidence", async ({ page, assignment }) => {
  await page.route("**/api/state", (route) => route.fulfill({ json: { connection: null, projects: [], outcomes: [], links: [], streams: [], timezone: "UTC" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(dialog).toContainText("Imported capacity evidence is not available");
  await expect(dialog).toContainText("Editing in Settings is not available yet");
  await dialog.getByRole("button", { name: "Close Settings" }).click();
  expect((await assignment.board()).capacity.baseline).toBe(20);
});

for (const width of [390, 768, 1440]) {
  test(`Settings is contained with reachable navigation and Close at ${width}px`, async ({ page, assignment }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const name of sectionNames) {
      await dialog.getByRole("button", { name, exact: true }).click();
      await expect(dialog.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await page.screenshot({ path: testInfo.outputPath(`settings-${width}.png`) });
    // Force a short viewport to exercise internal scrolling without adding fake editor content.
    await page.setViewportSize({ width, height: 320 });
    const body = dialog.locator(".workspace-settings-body");
    await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(dialog.getByRole("button", { name: "Close Settings" })).toBeInViewport();
    await dialog.getByRole("button", { name: "Close Settings" }).click();
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
    expect((await assignment.board()).capacity.baseline).toBe(20);
  });
}

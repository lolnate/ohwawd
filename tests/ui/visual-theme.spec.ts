import type { Locator } from "@playwright/test";
import { test, expect } from "./assignment-fixture";

// Check the colors actually selected by the CSS cascade, including transparent
// descendants. Palette-only checks cannot catch light text on a legacy surface.
async function expectReadableText(root: Locator) {
  const failures = await root.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].map((value) => value / 255);
    };
    const over = (front: number[], back: number[]) => front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3])).concat(1);
    const luminance = (color: number[]) => color.slice(0, 3).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const problems: { text: string; tag: string; contrast: number; color: string; background: number[] }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim() || !parent.getClientRects().length || parent.closest('.sr-only, [hidden], [aria-hidden="true"], button:disabled')) continue;
      const style = getComputedStyle(parent);
      if (style.visibility !== "visible") continue;
      const ancestors: Element[] = [];
      for (let current: Element | null = parent; current; current = current.parentElement) ancestors.unshift(current);
      let background = [1, 1, 1, 1];
      for (const ancestor of ancestors) background = over(rgba(getComputedStyle(ancestor).backgroundColor), background);
      const foreground = over(rgba(style.color), background);
      const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      const contrast = (lighter + .05) / (darker + .05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      if (contrast < (large ? 3 : 4.5)) problems.push({ text: node.textContent.trim().slice(0, 90), tag: parent.tagName, contrast, color: style.color, background });
    }
    return problems;
  });
  expect(failures, "Rendered text must contrast with its actual surface").toEqual([]);
}

for (const width of [1440, 768, 390]) {
  test(`all workspace surfaces and Settings use readable dark-theme colors at ${width}px`, async ({ page, assignment }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const saved = await assignment.board();
    await expect(page.locator("#project-streams")).toBeVisible();
    for (const tab of await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button").all()) await expect(tab).toBeInViewport();
    await expectReadableText(page.locator(".app-header"));
    await expectReadableText(page.locator("#sequencing-board"));
    await expect(page.locator(".board-summary > div").first()).toHaveCSS("background-color", "rgb(17, 28, 48)");
    await page.screenshot({ path: testInfo.outputPath(`board-${width}.png`), animations: "disabled" });

    for (const name of ["Outcomes", "Linear projects", "Scenarios"]) {
      await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: new RegExp(`^${name}`) }).click();
      const view = page.locator(".workspace-view:visible");
      await expect(view.locator(".panel").first()).toBeVisible();
      await expectReadableText(view);
      await page.screenshot({ path: testInfo.outputPath(`${name.replaceAll(" ", "-")}-${width}.png`), animations: "disabled" });
    }

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "Settings", exact: true });
    await expect(settings).toHaveCSS("background-color", "rgb(17, 28, 48)");
    await expect(settings.getByLabel("Manual baseline (optional)")).toBeVisible();
    for (const section of ["Capacity assumptions", "Scope readiness", "Weekly availability and holidays"]) {
      await settings.getByRole("navigation").getByRole("button", { name: section, exact: true }).click();
      await expectReadableText(settings);
      await page.screenshot({ path: testInfo.outputPath(`settings-${section.split(" ")[0].toLowerCase()}-${width}.png`), animations: "disabled" });
    }
    await settings.getByRole("button", { name: "Close Settings" }).hover();
    await expectReadableText(settings);
    await page.screenshot({ path: testInfo.outputPath(`settings-${width}.png`), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const after = await assignment.board();
    expect(after.forecast).toEqual(saved.forecast);
    expect(after.capacity).toEqual(saved.capacity);
  });
}

test("project details, outcome creation and linking keep readable labels, fields and actions", async ({ page, assignment }, testInfo) => {
  await page.goto("/");
  await page.locator('[data-timeline-outcome="other:core"] [data-timeline-project="linear:a"]').click();
  const drawer = page.getByRole("dialog", { name: "API foundation", exact: true });
  await expectReadableText(drawer);
  const field = drawer.getByLabel("Extra scope points");
  await field.focus();
  await expect(field).toHaveCSS("outline-style", "solid");
  await expect(field).toHaveCSS("outline-color", "rgb(255, 225, 138)");
  await expect(field).toHaveCSS("border-top-color", "rgb(99, 123, 157)");
  await expect(field).toHaveCSS("background-color", "rgb(17, 28, 48)");
  await page.screenshot({ path: testInfo.outputPath("project-drawer.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  await page.locator(".view-heading").getByRole("button", { name: "Add outcome", exact: true }).click();
  const creator = page.getByRole("dialog");
  await expectReadableText(creator);
  await creator.getByRole("button", { name: "Projects", exact: true }).click();
  await creator.getByRole("checkbox", { name: /API foundation/ }).check();
  await expectReadableText(creator);
  await page.screenshot({ path: testInfo.outputPath("outcome-creator.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.locator("#outcome-catalog").getByRole("button", { name: "Launch", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Launch", exact: true });
  await picker.getByRole("button", { name: "Projects", exact: true }).click();
  await picker.getByRole("button", { name: "Manage projects", exact: true }).click();
  await expectReadableText(picker);
  await page.screenshot({ path: testInfo.outputPath("project-picker.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  expect((await assignment.board()).capacity.baseline).toBe(20);
});

test("owned/shared projects and overlapping calendar states preserve independent visual cues", async ({ page, assignment }) => {
  await assignment.shareProjects();
  await assignment.setDemand("a", 200);
  await assignment.configureCycles({ importedCount: 4 });
  await page.goto("/");
  const owned = page.locator('.counted-project.uses-projected-cycles[data-timeline-project="linear:a"]');
  const shared = page.locator('.shared-project.uses-projected-cycles[data-timeline-project="linear:a"]').first();
  await expect(owned).toHaveCSS("background-color", "rgb(21, 85, 104)");
  await expect(owned).toHaveCSS("border-top-style", "solid");
  await expect(owned).toContainText("*");
  await expect(shared).toHaveCSS("background-color", "rgb(20, 28, 45)");
  await expect(shared).toHaveCSS("border-top-style", "dashed");
  await expectReadableText(owned);
  await expectReadableText(shared);
  const overlapping = page.locator(".timeline-week-band.reduced-week.projected-calendar").first();
  await expect(overlapping).toHaveCSS("background-color", "rgb(51, 40, 23)");
  await expect(overlapping).not.toHaveCSS("background-image", "none");
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await owned.focus();
  await expect(owned).toHaveCSS("outline-style", "solid");
  await expect(owned).toHaveCSS("border-top-style", "solid");
  await expect(shared).toHaveCSS("border-top-style", "dashed");
  const transition = await owned.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(transition.split(",").every((value) => parseFloat(value) < .001)).toBe(true);
});

test("authentication and load failures remain legible without external font services", async ({ page }) => {
  const externalFonts: string[] = [];
  page.on("request", (request) => { if (request.resourceType() === "font" && new URL(request.url()).origin !== new URL(page.url()).origin) externalFonts.push(request.url()); });
  await page.route("**/api/session", (route) => route.fulfill({ json: { authenticated: false } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your private planning space" })).toBeVisible();
  await expectReadableText(page.locator("main"));
  expect(externalFonts).toEqual([]);
  await page.route("**/api/session", (route) => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/board", (route) => route.fulfill({ status: 503, json: { error: "Forecast temporarily unavailable" } }));
  await page.reload();
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  const catalog = page.locator("#outcome-catalog");
  await expect(catalog.getByRole("alert")).toBeVisible();
  await expectReadableText(catalog);
});

test("enlarged text reflows without losing the Settings close action or workspace navigation", async ({ page, assignment }) => {
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.goto("/");
  await page.addStyleTag({ content: ":root { font-size: 200%; }" });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await expectReadableText(settings);
  await expect(settings.getByRole("button", { name: "Close Settings" })).toBeInViewport();
  expect(await settings.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  for (const tab of await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button").all()) await expect(tab).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await assignment.board()).capacity.baseline).toBe(20);
});

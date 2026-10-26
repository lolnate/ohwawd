import { test, expect } from "./assignment-fixture";
import type { Page } from "@playwright/test";

async function open(page: Page, title = "Launch") {
  await page.goto("/");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  await page.locator(".catalog-title").filter({ hasText: title }).click();
  return page.getByRole("dialog");
}

test("Details drafts survive navigation, cancel independently, and dismiss with focus restoration", async ({ page, assignment }) => {
  const dialog = await open(page);
  await expect(dialog.locator("h2")).toBeFocused();
  const handle = await dialog.elementHandle();
  await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
  await expect(dialog.getByLabel("Outcome title")).toBeFocused();
  await dialog.getByLabel("Notes").fill("Draft notes");
  await dialog.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(dialog).toContainText("Rollout");
  await dialog.getByRole("button", { name: /Details/ }).click();
  await expect(dialog.getByLabel("Notes")).toHaveValue("Draft notes");
  expect(await handle?.evaluate((node) => node === document.querySelector("dialog[open]"))).toBe(true);
  await dialog.getByRole("button", { name: "Cancel details" }).click();
  await expect(dialog).toContainText("No notes");
  await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
  await dialog.getByLabel("Owner", { exact: true }).fill("Unsaved");
  await page.keyboard.press("Escape");
  await expect(page.locator(".catalog-title")).toBeFocused();
  await page.locator(".catalog-title").click();
  await expect(page.getByRole("dialog")).toContainText("No owner");
  expect((await assignment.board()).outcomes[0].owner).toBe("");
});

test("rejected Details writes retain drafts; refresh retry does not repeat a saved write", async ({ page, assignment }) => {
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
  await dialog.getByLabel("Owner", { exact: true }).fill("Engineering");
  await page.route("**/api/outcomes/*", (route) => route.fulfill({ status: 409, json: { error: "Rejected edit" } }));
  await dialog.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Rejected edit");
  await expect(dialog.getByLabel("Owner", { exact: true })).toHaveValue("Engineering");
  await page.unroute("**/api/outcomes/*");
  let writes = 0;
  page.on("request", (request) => { if (request.method() === "PUT" && request.url().includes("/api/outcomes/")) writes++; });
  await page.route("**/api/state", (route) => route.fulfill({ status: 503, json: { error: "Read failed" } }));
  await dialog.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(dialog).toContainText("Details saved.");
  await expect(dialog).toContainText("Outcome saved, but workspace views could not be refreshed");
  await expect(dialog).toContainText("Engineering");
  await page.unroute("**/api/state");
  await dialog.getByRole("button", { name: "Retry workspace refresh" }).click();
  await expect(dialog.getByRole("button", { name: "Retry workspace refresh" })).toHaveCount(0);
  expect(writes).toBe(1);
  expect((await assignment.board()).outcomes[0].owner).toBe("Engineering");
});

test("pending Details saves allow dismissal and cannot change a newer opening", async ({ page, assignment }) => {
  await assignment.seedCatalog();
  const dialog = await open(page, "Catalog launch");
  await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
  await dialog.getByLabel("Owner", { exact: true }).fill("Saved later");
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/outcomes/*", async (route) => { await waiting; await route.fallback(); });
  await dialog.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(dialog.getByLabel("Owner", { exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Close outcome" }).click();
  await page.locator(".catalog-title").filter({ hasText: /^Owner All$/ }).click();
  const next = page.getByRole("dialog");
  await next.getByRole("button", { name: "Edit details", exact: true }).click();
  await next.getByLabel("Notes").fill("New opening draft");
  release();
  await expect(page.getByRole("status").filter({ hasText: "Outcome details saved." })).toBeVisible();
  await expect(next.locator("h2")).toHaveText("Owner All");
  await expect(next.getByLabel("Notes")).toHaveValue("New opening draft");
  await expect(next.getByLabel("Notes")).toBeFocused();
});

test("sidebar protects drag-out, dismisses backdrop and contains keyboard focus", async ({ page, assignment }) => {
  await assignment.board();
  const dialog = await open(page);
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Delete outcome", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close outcome" })).toBeFocused();
  const rect = (await dialog.boundingBox())!;
  await page.mouse.move(rect.x + 20, 400); await page.mouse.down(); await page.mouse.move(rect.x - 20, 400); await page.mouse.up();
  await expect(dialog).toBeVisible();
  await page.mouse.click(rect.x - 20, 400);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".catalog-title")).toBeFocused();
});

test("creation validates inactive Details and transitions in the same dialog with initial links", async ({ page, assignment }) => {
  await assignment.board();
  await page.goto("/"); await page.getByRole("button", { name: /^Outcomes/ }).click();
  await page.locator(".view-heading").getByRole("button", { name: "Add outcome" }).click();
  const dialog = page.getByRole("dialog");
  const handle = await dialog.elementHandle();
  await expect(dialog.getByLabel("Outcome title")).toBeFocused();
  await dialog.getByRole("button", { name: "Projects", exact: true }).click();
  await dialog.getByLabel("API foundation", { exact: false }).first().check();
  await dialog.getByLabel("API foundation requirement").selectOption("optional");
  await dialog.getByRole("button", { name: "Create outcome" }).click();
  await expect(dialog.getByLabel("Outcome title")).toBeFocused();
  await dialog.getByLabel("Outcome title").fill("New result");
  await dialog.getByRole("button", { name: /Projects/ }).click();
  await expect(dialog.getByLabel("API foundation requirement")).toHaveValue("optional");
  await dialog.getByRole("button", { name: "Create outcome" }).click();
  await expect(dialog.locator("h2")).toHaveText("New result");
  expect(await handle?.evaluate((node) => node === document.querySelector("dialog[open]"))).toBe(true);
  await expect(dialog.getByRole("button", { name: "Edit details", exact: true })).toBeVisible();
  const saved = await assignment.board();
  const outcome = saved.outcomes.find((item) => item.title === "New result")!;
  expect(saved.links.filter((link) => link.outcome_id === outcome.id)).toEqual([{ outcome_id: outcome.id, project_id: "a", requirement: "optional" }]);
});

test("section saves and cancels preserve the other draft and Projects search context", async ({ page, assignment }) => {
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
  await dialog.getByLabel("Notes").fill("Keep this draft");
  await dialog.getByRole("button", { name: "Projects", exact: true }).click();
  await dialog.getByRole("button", { name: "Manage projects" }).click();
  await expect(dialog.getByLabel("Find a project")).toBeFocused();
  await dialog.getByLabel("Rollout requirement").selectOption("optional");
  await dialog.getByLabel("Find a project").fill("Rollout");
  await dialog.getByRole("button", { name: /Details/ }).click();
  await dialog.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(dialog).toContainText("Details saved.");
  await dialog.getByRole("button", { name: /Projects/ }).click();
  await expect(dialog.getByLabel("Find a project")).toHaveValue("Rollout");
  await expect(dialog.getByLabel("Rollout requirement")).toHaveValue("optional");
  expect((await assignment.board()).links[0].requirement).toBe("minimum");
  await dialog.getByRole("button", { name: "Cancel links" }).click();
  await expect(dialog).toContainText("Required");
  await dialog.getByRole("button", { name: "Manage projects" }).click();
  await dialog.getByLabel("Rollout requirement").selectOption("optional");
  await dialog.getByRole("button", { name: /Details/ }).click();
  await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
  await dialog.getByLabel("Owner", { exact: true }).fill("Still a draft");
  await dialog.getByRole("button", { name: /Projects/ }).click();
  await dialog.getByRole("button", { name: "Save links", exact: true }).click();
  await expect(dialog).toContainText("Links saved.");
  await dialog.getByRole("button", { name: /Details/ }).click();
  await expect(dialog.getByLabel("Owner", { exact: true })).toHaveValue("Still a draft");
  expect((await assignment.board()).outcomes[0].owner).toBe("");
});

for (const kind of ["create", "links"] as const) {
  test(`${kind} rejection retains draft and saved refresh failure retries only the read`, async ({ page, assignment }) => {
    const dialog = await open(page);
    if (kind === "create") {
      await dialog.getByRole("button", { name: "Close outcome" }).click();
      await page.locator(".view-heading").getByRole("button", { name: "Add outcome" }).click();
      await dialog.getByLabel("Outcome title").fill("Retained creation");
    } else {
      await dialog.getByRole("button", { name: "Projects", exact: true }).click();
      await dialog.getByRole("button", { name: "Manage projects" }).click();
      await dialog.getByLabel("Rollout requirement").selectOption("optional");
    }
    const path = kind === "create" ? "**/api/outcomes" : "**/api/outcomes/*/links";
    const action = kind === "create" ? "Create outcome" : "Save links";
    await page.route(path, (route) => route.fulfill({ status: 409, json: { error: "Rejected submission" } }));
    await dialog.getByRole("button", { name: action, exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Rejected submission");
    await page.unroute(path);
    let writes = 0;
    page.on("request", (request) => { if (["POST", "PUT"].includes(request.method()) && request.url().includes("/api/outcomes")) writes++; });
    await page.route("**/api/state", (route) => route.fulfill({ status: 503, json: { error: "Refresh failed" } }));
    await dialog.getByRole("button", { name: action, exact: true }).click();
    await expect(dialog).toContainText("Outcome saved, but workspace views could not be refreshed.");
    await expect(dialog.getByRole("button", { name: kind === "create" ? "Edit details" : "Manage projects", exact: true })).toBeVisible();
    await page.unroute("**/api/state");
    await dialog.getByRole("button", { name: "Retry workspace refresh" }).click();
    await expect(dialog.getByRole("button", { name: "Retry workspace refresh" })).toHaveCount(0);
    expect(writes).toBe(1);
    expect((await assignment.board()).outcomes).toHaveLength(kind === "create" ? 2 : 1);
  });
}

test("dismissed creation offers View outcome without altering a newer opening", async ({ page, assignment }) => {
  await assignment.board();
  await page.goto("/"); await page.getByRole("button", { name: /^Outcomes/ }).click();
  await page.locator(".view-heading").getByRole("button", { name: "Add outcome" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Outcome title").fill("Created later");
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/outcomes", async (route) => { await waiting; await route.fallback(); });
  await dialog.getByRole("button", { name: "Create outcome" }).click();
  await dialog.getByRole("button", { name: "Close outcome" }).click();
  await page.locator(".catalog-title").click();
  release();
  await expect(page.getByRole("status").filter({ hasText: "Outcome created." })).toBeVisible();
  await expect(dialog.locator("h2")).toHaveText("Launch");
  await dialog.getByRole("button", { name: "Close outcome" }).click();
  await page.getByRole("button", { name: "View outcome", exact: true }).click();
  await expect(dialog.locator("h2")).toHaveText("Created later");
});

test("hidden and unavailable links survive filtered editing until explicitly removed", async ({ page, assignment }) => {
  await assignment.seedCatalog();
  await page.route("**/api/state", async (route) => {
    // The cached project may disappear while its saved link remains available.
    const board = await assignment.board();
    await route.fulfill({ json: { outcomes: board.outcomes, projects: board.packages.filter((item) => item.project_id !== "a").map((item) => ({ ...item, id: item.project_id })), links: board.links, streams: board.streams, timezone: board.timezone, connection: null } });
  });
  const dialog = await open(page, "Catalog launch");
  await dialog.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(dialog).toContainText("Unavailable project");
  await expect(dialog).toContainText("Hidden");
  await dialog.getByRole("button", { name: "Manage projects" }).click();
  await dialog.getByLabel("Find a project").fill("no match");
  await expect(dialog).toContainText("2 selected");
  await dialog.getByRole("button", { name: "Remove unavailable project a" }).click();
  await expect(dialog).toContainText("1 selected");
  let payload: unknown;
  await page.route("**/api/outcomes/*/links", async (route) => { payload = route.request().postDataJSON(); await route.fulfill({ status: 409, json: { error: "Try again" } }); });
  await dialog.getByRole("button", { name: "Save links", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Try again");
  expect(payload).toEqual({ links: [{ projectId: "b", requirement: "optional" }] });
  await expect(dialog.getByLabel("Find a project")).toHaveValue("no match");
});

test("filtered edits preserve query, counts and page position with outside-filter inspection", async ({ page, assignment }) => {
  await assignment.seedCatalog();
  const dialog = await open(page, "Catalog launch");
  await dialog.getByRole("button", { name: "Close outcome" }).click();
  const catalog = page.locator("#outcome-catalog");
  await catalog.getByLabel("Search outcomes", { exact: true }).fill("Catalog launch");
  await catalog.getByLabel("Owner", { exact: true }).selectOption("owner:engineering");
  await catalog.getByLabel("Stream", { exact: true }).selectOption("core");
  await catalog.getByLabel("Sort outcomes").selectOption("newest");
  await catalog.locator(".catalog-title").click();
  const scroll = await page.evaluate(() => scrollY);
  await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
  await dialog.getByLabel("Owner", { exact: true }).fill("Product");
  await expect(dialog.getByRole("button", { name: "Delete outcome" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(dialog).toContainText("Outside current filters");
  await expect(catalog.getByRole("status")).toHaveText("0 of 55 outcomes · Filters active");
  await dialog.getByRole("button", { name: "Close outcome" }).click();
  await expect(page.locator("#outcome-catalog-title")).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await expect(catalog.getByLabel("Sort outcomes")).toHaveValue("newest");
});

test("filtered creation stays open outside filters and deletion recovers next-result focus", async ({ page, assignment }) => {
  await assignment.seedCatalog();
  await page.goto("/"); await page.getByRole("button", { name: /^Outcomes/ }).click();
  const catalog = page.locator("#outcome-catalog");
  await catalog.getByLabel("Search outcomes", { exact: true }).fill("Catalog outcome");
  await catalog.getByLabel("Owner", { exact: true }).selectOption("owner:product");
  await page.locator(".view-heading").getByRole("button", { name: "Add outcome" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Outcome title").fill("Outside query");
  await dialog.getByRole("button", { name: "Create outcome" }).click();
  await expect(dialog).toContainText("Outside current filters");
  await expect(catalog.getByRole("status")).toHaveText("25 of 56 outcomes · Filters active");
  await dialog.getByRole("button", { name: "Close outcome" }).click();
  const next = await catalog.locator(".catalog-title").nth(1).textContent();
  await catalog.locator(".catalog-title").first().click();
  page.once("dialog", (confirm) => void confirm.accept());
  await dialog.getByRole("button", { name: "Delete outcome", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(catalog.locator(".catalog-title").first()).toHaveText(next!);
  await expect(catalog.locator(".catalog-title").first()).toBeFocused();
  await expect(catalog.getByRole("status")).toHaveText("24 of 55 outcomes · Filters active");
  expect((await assignment.board()).outcomes).toHaveLength(55);
});

test("successful external refresh closes removed outcomes while failed refresh retains inspection", async ({ page, assignment }) => {
  const dialog = await open(page);
  let removed = false;
  let failed = true;
  await page.route("**/api/state", async (route) => {
    if (failed) await route.fulfill({ status: 503, json: { error: "Read unavailable" } });
    else if (removed) await route.fulfill({ json: { outcomes: [], links: [], projects: [], streams: [], timezone: "UTC", connection: null } });
    else await route.fallback();
  });
  await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
  await dialog.getByLabel("Owner", { exact: true }).fill("Saved owner");
  await dialog.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(dialog).toContainText("Outcome saved, but workspace views could not be refreshed");
  failed = false; removed = true;
  await dialog.getByRole("button", { name: "Retry workspace refresh" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Outcome was removed" })).toBeVisible();
  await expect(page.locator("#outcome-catalog-title")).toBeFocused();
  expect((await assignment.board()).outcomes[0].owner).toBe("Saved owner");
});

test("stale planning tokens retain both section drafts and explicit refresh allows reviewed retry", async ({ page, assignment }) => {
  await assignment.activateRoadmap();
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
  await dialog.getByLabel("Notes").fill("Keep this metadata draft");
  await dialog.getByRole("button", { name: "Projects", exact: true }).click();
  await dialog.getByRole("button", { name: "Manage projects" }).click();
  await dialog.getByLabel("Rollout requirement").selectOption("optional");
  await assignment.setDemand("c", 7);
  await dialog.getByRole("button", { name: "Save links", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("planning context changed");
  await expect(dialog.getByLabel("Rollout requirement")).toHaveValue("optional");
  await dialog.getByRole("button", { name: "Review latest planning context" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Workspace refreshed." })).toBeVisible();
  await dialog.getByRole("button", { name: "Save links", exact: true }).click();
  await expect(dialog).toContainText("Links saved.");
  await dialog.getByRole("button", { name: /Details/ }).click();
  await expect(dialog.getByLabel("Notes")).toHaveValue("Keep this metadata draft");
  expect((await assignment.board()).links[0].requirement).toBe("optional");
});

test("removing an owning link reports excluded candidate work in the shared sidebar workflow", async ({ page, assignment }) => {
  await assignment.activateRoadmap();
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "Projects", exact: true }).click();
  await dialog.getByRole("button", { name: "Manage projects" }).click();
  await dialog.getByRole("checkbox", { name: /Rollout/ }).uncheck();
  await dialog.getByRole("button", { name: "Save links", exact: true }).click();
  await expect(dialog).toContainText("Links saved.");
  await dialog.getByRole("button", { name: "Close outcome" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Needs assignment: Rollout" })).toContainText("future demand is excluded");
  await expect(page.locator("#outcome-needs-assignment")).toContainText("Rollout");
  const project = (await assignment.board()).packages.find((item) => item.project_id === "c")!;
  expect([project.roadmap_state, project.selected, project.capacity_outcome_id, project.stream_id]).toEqual(["candidate", false, null, null]);
});

test("saved Details uses actual evidence to complete and reopen across Board and catalog", async ({ page, assignment }) => {
  await assignment.activateRoadmap(); let dialog = await open(page);
  await expect(dialog).toContainText("Required work is not actually complete yet");
  await expect(dialog.getByRole("button", { name: "Mark complete", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Close outcome" }).click();
  await assignment.setProjectCompleted("c", true); await assignment.setProjectCompleted("a", true);
  dialog = await open(page); const handle = await dialog.elementHandle();
  await expect(dialog).toContainText("Open · Ready to mark complete");
  await dialog.getByRole("button", { name: "Mark complete", exact: true }).click();
  await expect(dialog).toContainText("Outcome marked complete."); await expect(dialog).toContainText(/Completed .*\d/);
  expect(await handle!.evaluate((element) => element === document.querySelector("dialog[open]"))).toBe(true);
  await dialog.getByRole("button", { name: "Close outcome" }).click();
  const catalogRow = page.locator(".catalog-row").filter({ has: page.getByRole("button", { name: "Launch", exact: true }) });
  await expect(catalogRow).toContainText("Completed");
  await page.getByRole("button", { name: /^Board/ }).click();
  let boardTitle = page.locator('#board-outcome-title-00000000-0000-4000-8000-000000000001');
  await expect(page.locator('[data-timeline-outcome="00000000-0000-4000-8000-000000000001"]')).toContainText("Completed");
  await boardTitle.click(); dialog = page.getByRole("dialog"); const placement = dialog.locator(".outcome-placement");
  await placement.getByLabel("Destination stream for Launch").selectOption(""); await placement.getByRole("button", { name: "Apply Board placement" }).click();
  await dialog.getByRole("button", { name: "Close outcome" }).click();
  const unassigned = page.locator(".unassigned-outcome-controls").filter({ hasText: "Launch" }); await expect(unassigned).toContainText("Completed");
  boardTitle = unassigned.locator('#board-outcome-title-00000000-0000-4000-8000-000000000001'); await boardTitle.click(); dialog = page.getByRole("dialog"); await dialog.getByRole("button", { name: "Reopen outcome" }).click();
  await expect(dialog).toContainText("Outcome reopened."); await expect(dialog).toContainText("Open · Ready to mark complete");
  await dialog.getByText("Lifecycle history (2)").click(); await expect(dialog.getByText(/Completed by Owner/)).toBeVisible(); await expect(dialog.getByText(/Reopened by Owner/)).toBeVisible();
  if (process.env.ACCEPTANCE_SCREENSHOT_PREFIX) { await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: `${process.env.ACCEPTANCE_SCREENSHOT_PREFIX}-lifecycle-history-390.png` }); }
  await dialog.getByRole("button", { name: "Close outcome" }).click(); await expect(boardTitle).toBeFocused();
});

test("completion actions stay disabled for independent drafts and optional-only saved scope", async ({ page, assignment }) => {
  await assignment.setProjectCompleted("c", true); await assignment.setProjectCompleted("a", true);
  const dialog = await open(page); const complete = dialog.getByRole("button", { name: "Mark complete", exact: true }); await expect(complete).toBeEnabled();
  await dialog.getByRole("button", { name: "Edit details", exact: true }).click(); await dialog.getByLabel("Notes").fill("Unsaved completion context");
  await expect(complete).toBeDisabled(); await expect(dialog).toContainText("Save or cancel changes in Details and Projects");
  await dialog.getByRole("button", { name: "Cancel details" }).click(); await dialog.getByRole("button", { name: "Projects", exact: true }).click();
  await dialog.getByRole("button", { name: "Manage projects" }).click(); await dialog.getByLabel("Rollout requirement").selectOption("optional");
  await dialog.getByRole("button", { name: /Details/ }).click(); await expect(complete).toBeDisabled();
  await dialog.getByRole("button", { name: /Projects/ }).click(); await dialog.getByRole("button", { name: "Save links" }).click();
  await dialog.getByRole("button", { name: /Details/ }).click();
  await expect(dialog).toContainText("Open · Unplanned"); await expect(dialog).toContainText("define at least one minimum-required project"); await expect(complete).toBeDisabled();
});

test("completion blockers hand off to project inspection without stacking dialogs", async ({ page, assignment }) => {
  await assignment.board();
  const dialog = await open(page); await dialog.getByRole("button", { name: "Inspect Rollout", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(1); await expect(page.getByRole("dialog", { name: "Rollout", exact: true })).toBeVisible();
});

test("stale completion evidence refreshes in place and completed source changes stay sticky until reopen", async ({ page, assignment }) => {
  await assignment.setProjectCompleted("c", true); await assignment.setProjectCompleted("a", true);
  let dialog = await open(page); await expect(dialog.getByRole("button", { name: "Mark complete", exact: true })).toBeEnabled();
  await assignment.setProjectCompleted("c", false); await dialog.getByRole("button", { name: "Mark complete", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("evidence or lifecycle state changed");
  await expect(dialog.getByRole("heading", { name: "Completion" })).toBeFocused();
  await expect(dialog).toContainText("Required work is not actually complete yet"); await expect(dialog.getByRole("button", { name: "Mark complete", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Close outcome" }).click(); await assignment.setProjectCompleted("c", true);
  dialog = await open(page); await dialog.getByRole("button", { name: "Mark complete", exact: true }).click();
  await assignment.setProjectCompleted("c", false); await dialog.getByRole("button", { name: "Close outcome" }).click(); dialog = await open(page);
  await expect(dialog).toContainText("Completed"); await expect(dialog).toContainText("Review completion needed");
  await expect(dialog.getByRole("button", { name: "Reopen outcome" })).toBeEnabled(); await dialog.getByRole("button", { name: "Reopen outcome" }).click();
  await expect(dialog).toContainText("Required work is not actually complete yet");
});

test("required-link changes latch review markers across Details, Board and catalog", async ({ page, assignment }, testInfo) => {
  await assignment.activateRoadmap(); await assignment.setProjectCompleted("c", true); await assignment.setProjectCompleted("a", true);
  await page.setViewportSize({ width: 390, height: 900 }); let dialog = await open(page); await dialog.getByRole("button", { name: "Mark complete", exact: true }).click();
  await dialog.getByRole("button", { name: "Projects", exact: true }).click(); await dialog.getByRole("button", { name: "Manage projects" }).click();
  await dialog.getByLabel("Rollout requirement").selectOption("optional"); await dialog.getByRole("button", { name: "Save links" }).click(); await dialog.getByRole("button", { name: /Details/ }).click();
  await expect(dialog).toContainText("Review completion needed"); await expect(dialog).toContainText("Required delivery scope changed after completion");
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true); await page.screenshot({ path: testInfo.outputPath("lifecycle-review-390.png") });
  await dialog.getByRole("button", { name: "Close outcome" }).click();
  const catalogRow = page.locator(".catalog-row").filter({ has: page.getByRole("button", { name: "Launch", exact: true }) });
  await expect(catalogRow).toContainText("Review completion needed");
  await page.getByRole("button", { name: /^Board/ }).click(); await expect(page.locator('[data-timeline-outcome="00000000-0000-4000-8000-000000000001"]')).toContainText("Review completion needed");
});

test("saved completion survives refresh failure and retry performs no second lifecycle write", async ({ page, assignment }) => {
  await assignment.setProjectCompleted("c", true); await assignment.setProjectCompleted("a", true);
  const dialog = await open(page); let writes = 0;
  page.on("request", (request) => { if (request.method() === "PUT" && request.url().endsWith("/completion")) writes++; });
  await page.route("**/api/state", (route) => route.fulfill({ status: 503, json: { error: "Refresh failed" } }));
  await dialog.getByRole("button", { name: "Mark complete", exact: true }).click();
  await expect(dialog).toContainText("Completed"); await expect(dialog).toContainText("Outcome saved, but workspace views could not be refreshed");
  await page.unroute("**/api/state"); await dialog.getByRole("button", { name: "Retry workspace refresh" }).click();
  await expect(dialog.getByRole("button", { name: "Retry workspace refresh" })).toHaveCount(0); expect(writes).toBe(1);
});

test("dismissed completion finishes without replacing or focusing a newer outcome opening", async ({ page, assignment }) => {
  await assignment.shareProjects(); await assignment.setProjectCompleted("c", true); await assignment.setProjectCompleted("a", true);
  let dialog = await open(page); let release!: () => void; const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/outcomes/*/completion", async (route) => { await waiting; await route.fallback(); });
  await dialog.getByRole("button", { name: "Mark complete", exact: true }).click(); await expect(dialog.getByRole("button", { name: "Close outcome" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Close outcome" }).click(); await page.locator(".catalog-title").filter({ hasText: /^Foundation$/ }).click();
  dialog = page.getByRole("dialog"); await expect(dialog.getByRole("button", { name: "Mark complete", exact: true })).toBeDisabled(); await expect(dialog.getByRole("status")).toContainText("Another outcome change is finishing"); await dialog.getByRole("button", { name: "Edit details", exact: true }).click(); await dialog.getByLabel("Notes").fill("Newer opening draft");
  release(); await expect(page.getByRole("status").filter({ hasText: "Outcome marked complete." })).toBeVisible();
  await expect(dialog.locator("h2")).toHaveText("Foundation"); await expect(dialog.getByLabel("Notes")).toHaveValue("Newer opening draft"); await expect(dialog.getByLabel("Notes")).toBeFocused();
});

for (const width of [1440, 768, 390]) {
  test(`sidebar long-content visual and keyboard walkthrough at ${width}px`, async ({ page, assignment }, testInfo) => {
    await assignment.seedCatalog();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/"); await page.getByRole("button", { name: /^Outcomes/ }).click();
    await page.locator(".catalog-title").last().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Close outcome" })).toBeInViewport();
    await expect(dialog.locator("h2")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Close outcome" })).toBeFocused();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`sidebar-details-${width}.png`) });
    await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
    await dialog.getByLabel("Notes").fill("Long notes stay in the opening draft. ".repeat(100));
    await dialog.getByRole("button", { name: "Projects", exact: true }).click();
    await dialog.getByRole("button", { name: "Manage projects" }).click();
    await dialog.getByRole("checkbox", { name: /API foundation/ }).check();
    await expect(dialog.getByRole("button", { name: /Details · unsaved/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Projects · unsaved/ })).toHaveAttribute("aria-current", "true");
    await dialog.getByRole("button", { name: "Save links", exact: true }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole("button", { name: "Save links", exact: true })).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "Close outcome" })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`sidebar-projects-${width}.png`) });
    await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
    await page.keyboard.press("Tab");
    await dialog.getByRole("button", { name: /Details · unsaved/ }).focus();
    await expect(dialog.getByRole("button", { name: /Details · unsaved/ })).toHaveCSS("outline-style", "solid");
    await expect(dialog.getByRole("button", { name: /Projects · unsaved/ })).toHaveAttribute("aria-current", "true");
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`sidebar-forced-colors-${width}.png`) });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await page.keyboard.press("Escape");
    await expect(page.locator(".catalog-title").last()).toBeFocused();
    expect((await assignment.board()).links).toHaveLength(3);
  });
}

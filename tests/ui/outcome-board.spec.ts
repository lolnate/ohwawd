import { test, expect } from "./assignment-fixture";
import type { Locator, Page } from "@playwright/test";

const Launch = "00000000-0000-4000-8000-000000000001", Foundation = "00000000-0000-4000-8000-000000000002", Retention = "00000000-0000-4000-8000-000000000003", Empty = "00000000-0000-4000-8000-000000000004";
const row = (page: Page, id: string) => page.locator(`tr[data-timeline-outcome="${id}"]`);
const card = (page: Page, id: string) => page.locator(`[data-project-id="linear:${id}"]`);
const notice = (page: Page) => page.locator("#sequencing-board > .notice");
async function plan(project: Locator) { const detail = project.locator("details.project-plan-details"); if (!await detail.evaluate((item) => (item as HTMLDetailsElement).open)) await detail.locator(":scope > summary").click(); }
async function manage(page: Page, stream = "core") { const detail = page.locator(`#stream-work-${stream}`); if (!await detail.evaluate((item) => (item as HTMLDetailsElement).open)) await detail.locator(":scope > summary").click(); }
async function placement(page: Page, id: string, name: string) { await row(page, id).getByRole("button", { name, exact: true }).click(); return page.getByRole("dialog", { name, exact: true }).locator(".outcome-placement"); }
async function pointerDrop(page: Page, source: Locator, target: Locator) {
  await source.hover(); const start = (await source.boundingBox())!;
  await page.mouse.down(); await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2 + 10, { steps: 5 });
  await expect(target).toHaveClass(/drag-active/);
  // A source card can be taller than the viewport when its editor is expanded.
  // Keep the native drag alive while bringing the distant destination into view.
  await target.scrollIntoViewIfNeeded(); const end = (await target.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 }); await page.mouse.up();
}

test.beforeEach(async ({ assignment }) => { await assignment.shareProjects(); await assignment.seedOutcomeBoard(); await assignment.activateRoadmap(); });

test("top-level Board messages support manual dismissal and close after 20 seconds", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await row(page, Foundation).getByRole("button", { name: "Drag outcome Foundation", exact: true }).dragTo(row(page, Retention).locator('[data-drop-outcome-side="before"]'));
  const message = notice(page);
  await expect(message).toContainText("Foundation placement saved");
  await message.getByRole("button", { name: "Dismiss message" }).click();
  await expect(message).toHaveCount(0);

  await row(page, Retention).getByRole("button", { name: "Drag outcome Retention", exact: true }).dragTo(row(page, Foundation).locator('[data-drop-outcome-side="before"]'));
  await expect(message).toContainText("Retention placement saved");
  await page.clock.fastForward(19_000);
  await expect(message).toBeVisible();
  await page.clock.fastForward(1_000);
  await expect(message).toHaveCount(0);
});

test("pointer outcome order changes actual scheduling and equivalent before/after controls persist", async ({ page, assignment }) => {
  const original = await assignment.board(); expect(original.forecast.packages.find((item) => item.id === "linear:c")!.finish).toBe(3);
  await page.goto("/");
  await row(page, Foundation).getByRole("button", { name: "Drag outcome Foundation", exact: true }).dragTo(row(page, Retention).locator('[data-drop-outcome-side="before"]'));
  await expect(notice(page)).toContainText("Foundation placement saved: Core, priority 2");
  expect(await page.locator('#stream-core tr[data-timeline-outcome]').evaluateAll((items) => items.map((item) => item.getAttribute("data-timeline-outcome")))).toEqual([Launch, Foundation, Retention]);
  expect((await assignment.board()).forecast.packages.find((item) => item.id === "linear:c")!.finish).toBe(2);
  await page.reload(); await expect(row(page, Foundation)).not.toContainText("pts counted here"); const form = await placement(page, Foundation, "Foundation");
  const dialog = page.getByRole("dialog", { name: "Foundation", exact: true }); await expect(dialog.getByText("Points counted", { exact: true })).toBeVisible(); await expect(dialog.getByText("Direct projects", { exact: true })).toBeVisible();
  await expect(dialog.locator(".outcome-saved-details")).toContainText("Points counted5"); await expect(dialog.locator(".outcome-saved-details")).toContainText("Direct projects2");
  await form.getByLabel("Position for Foundation").selectOption("after"); await form.getByLabel("Move after outcome for Foundation").selectOption(Retention);
  await form.getByRole("button", { name: "Apply Board placement" }).click(); await expect(form).toContainText("Foundation placement saved");
  await dialog.getByRole("button", { name: "Edit details" }).click();
  await expect(form.getByRole("button", { name: "Apply Board placement" })).toBeDisabled(); await dialog.getByRole("button", { name: "Cancel details" }).click();
  expect((await assignment.board()).forecast.packages.find((item) => item.id === "linear:c")!.finish).toBe(3);
  expect((await assignment.board()).links).toEqual(original.links);
});

test("sidebar placement supports explicit order, stream append and an exact same-stream no-op", async ({ page, assignment }) => {
  await page.goto("/"); const form = await placement(page, Foundation, "Foundation");
  await form.getByLabel("Position for Foundation").selectOption("before"); await form.getByLabel("Move before outcome for Foundation").selectOption(Launch);
  await form.getByRole("button", { name: "Apply Board placement" }).click(); await expect(form).toContainText("Foundation placement saved");
  await form.getByLabel("Destination stream for Foundation").selectOption("delivery");
  await form.getByRole("button", { name: "Apply Board placement" }).click(); await expect(form).toContainText("Foundation placement saved");
  expect(await row(page, Foundation).locator(".outcome-board-controls").getByRole("button", { name: "Foundation", exact: true }).isVisible()).toBe(true);
  let saved = await assignment.board(); const token = saved.planningToken;
  expect(saved.packages.find((item) => item.project_id === "a")!.stream_id).toBe("delivery"); expect(saved.forecast.selectedKnown).toBe(10);
  await Promise.all([page.waitForResponse((response) => response.url().endsWith("/api/board") && response.request().method() === "PUT"), form.getByRole("button", { name: "Apply Board placement" }).click()]); await expect(form).toContainText("Foundation placement saved");
  saved = await assignment.board(); expect(saved.planningToken).toBe(token);
  await form.getByLabel("Destination stream for Foundation").selectOption(""); await form.getByRole("button", { name: "Apply Board placement" }).click();
  await expect(form).toContainText("Foundation moved to Needs assignment");
  const excluded = (await assignment.board()).packages.find((item) => item.project_id === "a")!;
  expect([excluded.roadmap_state, excluded.selected, excluded.capacity_outcome_id]).toEqual(["candidate", false, null]);
  await page.getByRole("dialog", { name: "Foundation", exact: true }).getByRole("button", { name: "Close outcome" }).click();
  const needsAssignment = page.locator(".unassigned-outcomes");
  await expect(needsAssignment.getByRole("heading", { name: "Needs Assignment", exact: true })).toBeVisible();
  await expect(needsAssignment).toContainText("Foundation");
  expect(await page.locator("#project-streams").evaluate((element) => element.nextElementSibling?.classList.contains("unassigned-outcomes"))).toBe(true);
  expect(await needsAssignment.evaluate((element) => element.nextElementSibling?.classList.contains("stream-manager"))).toBe(true);
});

for (const width of [768, 390]) {
  test(`Outcomes Needs Assignment navigation stays focused and contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await page.goto("/"); await page.getByRole("button", { name: /^Outcomes/ }).click();
    await page.getByLabel("Search outcomes", { exact: true }).fill("Retention");
    await page.getByRole("navigation", { name: "Outcome sections" }).getByRole("link", { name: "Needs Assignment", exact: true }).click();
    const section = page.locator("#outcome-needs-assignment");
    await expect(section.getByRole("heading", { name: "Needs Assignment", exact: true })).toBeFocused();
    await expect(section).toContainText("Discovery");
    await expect(page.getByLabel("Search outcomes", { exact: true })).toHaveValue("Retention");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}

test("candidate linking is explicit and include/defer/resume/dismiss/restore conserve one charge", async ({ page, assignment }) => {
  await page.goto("/");
  await expect(page.locator("#unassigned-work")).toHaveCount(0);
  await page.getByRole("button", { name: /Projects need outcomes/ }).click();
  await expect(page.getByRole("button", { name: /^Outcomes/ })).toHaveAttribute("aria-current", "page");
  const needsAssignment = page.locator("#outcome-needs-assignment");
  await expect(needsAssignment.getByRole("heading", { name: "Needs Assignment", exact: true })).toBeFocused();
  await expect(needsAssignment).toContainText("Discovery");
  await needsAssignment.getByRole("button", { name: "Assign outcome" }).click();
  await expect(page.getByRole("button", { name: /^Board/ })).toHaveAttribute("aria-current", "page");
  const candidateDrawer = page.getByRole("dialog", { name: "Discovery", exact: true }); await expect(candidateDrawer).toBeVisible();
  const candidateCard = candidateDrawer.locator("article.project-plan-card");
  await expect(candidateCard.getByRole("button", { name: "Include on roadmap", exact: true })).toBeDisabled();
  await candidateCard.getByLabel("Outcome for linking Discovery").selectOption(Retention);
  await candidateCard.getByRole("button", { name: "Open outcome Projects for linking" }).click();
  const sidebar = page.getByRole("dialog", { name: "Retention", exact: true }); await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Projects", exact: true })).toHaveAttribute("aria-current", "true");
  await sidebar.getByRole("button", { name: "Manage projects" }).click(); await sidebar.getByRole("checkbox", { name: /Discovery/ }).check();
  await sidebar.getByRole("button", { name: "Save links", exact: true }).click(); await expect(sidebar).toContainText("Links saved.");
  expect((await assignment.board()).packages.find((item) => item.project_id === "d")!.roadmap_state).toBe("candidate");
  await sidebar.getByRole("button", { name: "Close outcome" }).click();
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  await needsAssignment.getByRole("button", { name: "Assign outcome" }).click();
  const drawerCard = page.getByRole("dialog", { name: "Discovery", exact: true }).locator("article.project-plan-card");
  await drawerCard.getByLabel("Owning outcome for Discovery").selectOption(Retention); await drawerCard.getByRole("button", { name: "Include on roadmap", exact: true }).click();
  await expect(notice(page)).toContainText("Discovery included once in Retention");
  await drawerCard.getByLabel("Extra scope points").fill("4"); await drawerCard.getByRole("button", { name: "Save extra scope" }).click(); await expect(notice(page)).toContainText("Discovery extra scope saved");
  expect((await assignment.board()).forecast.selectedKnown).toBe(14);
  await drawerCard.getByRole("button", { name: "Defer project" }).click(); await expect(notice(page)).toContainText("deferred");
  expect((await assignment.board()).forecast.selectedKnown).toBe(10);
  await drawerCard.getByRole("button", { name: "Resume on roadmap" }).click(); await expect(notice(page)).toContainText("included once");
  await drawerCard.getByRole("button", { name: "Dismiss from roadmap" }).click(); await expect(notice(page)).toContainText("dismissed from roadmap");
  await drawerCard.getByRole("button", { name: "Restore candidate" }).click(); await expect(notice(page)).toContainText("restored to Needs assignment");
  const saved = await assignment.board(), discovery = saved.packages.find((item) => item.project_id === "d")!;
  expect([discovery.roadmap_state, discovery.selected, discovery.capacity_outcome_id, saved.forecast.selectedKnown]).toEqual(["candidate", false, null, 10]);
  expect(saved.packages.filter((item) => item.project_id === "d")).toHaveLength(1);
  await page.getByRole("button", { name: "Close project details" }).click(); await page.getByRole("button", { name: /^Outcomes/ }).click();
  await expect(needsAssignment).toContainText("Discovery");
});

test("wait inspection restores dismissed prerequisites through explicit ownership without duplicate capacity", async ({ page, assignment }) => {
  await assignment.changeMembership("a", "dismiss"); await page.goto("/");
  await expect(row(page, Launch).locator("details.outcome-waiting, .outcome-bypass")).toHaveCount(0);
  await row(page, Launch).locator('[data-timeline-project="linear:c"]').click();
  let drawer = page.getByRole("dialog", { name: "Rollout", exact: true }); await drawer.getByRole("button", { name: /API foundation/ }).click();
  drawer = page.getByRole("dialog", { name: "API foundation", exact: true }); await expect(drawer).toContainText("dismissed");
  await expect(drawer.getByRole("option", { name: /Other selected work/ })).toHaveCount(0);
  await drawer.getByRole("button", { name: "Restore candidate" }).click(); await expect(drawer.locator("h2")).toBeFocused();
  expect((await assignment.board()).forecast.selectedKnown).toBe(5);
  await drawer.getByLabel("Owning outcome for API foundation").selectOption(Foundation); await drawer.getByRole("button", { name: "Include on roadmap", exact: true }).click();
  await expect(drawer).toContainText("included once in Foundation");
  const saved = await assignment.board(); expect(saved.forecast.selectedKnown).toBe(10); expect(saved.forecast.outcomes.find((item) => item.id === Launch)!.finish).toBe(3);
});

test("linked-owner transfer and project drag/reorder remain scoped to the owning outcome", async ({ page, assignment }) => {
  await page.goto("/"); const links = (await assignment.board()).links;
  await row(page, Launch).locator('[data-timeline-project="linear:a"]').click();
  const drawer = page.getByRole("dialog", { name: "API foundation", exact: true });
  await drawer.getByLabel("Owning outcome for API foundation").selectOption(Retention); await drawer.getByRole("button", { name: "Transfer capacity owner" }).click();
  await expect(drawer).toContainText("capacity owner / scoped position saved in Retention"); await drawer.getByRole("button", { name: "Close project details" }).click();
  expect((await assignment.board()).links).toEqual(links); expect((await assignment.board()).forecast.selectedKnown).toBe(10);
  await expect(page.locator('.counted-project[data-timeline-project="linear:a"]')).toHaveCount(1);
  expect(await page.locator('.counted-project[data-timeline-project="linear:a"]').evaluate((item) => item.closest("tr")?.getAttribute("data-timeline-outcome"))).toBe(Retention);
  await manage(page); await card(page, "a").getByRole("button", { name: "Move API foundation up", exact: true }).click(); await expect(notice(page)).toContainText("API foundation moved");
  await plan(card(page, "a")); await expect(card(page, "a").getByLabel("Place before within API foundation owner").getByRole("option", { name: "Rollout", exact: true })).toHaveCount(0);
  const source = card(page, "a").getByRole("button", { name: "Drag API foundation", exact: true });
  const target = page.locator(`[data-owning-outcome="${Foundation}"] [data-drop-owner="${Foundation}"]`).last();
  await pointerDrop(page, source, target); await expect(notice(page)).toContainText("owner Foundation");
  expect((await assignment.board()).packages.find((item) => item.project_id === "a")!.capacity_outcome_id).toBe(Foundation);
  await manage(page, "delivery");
  const invalid = page.locator(`[data-owning-outcome="${Empty}"] [data-drop-owner="${Empty}"]`).last();
  await pointerDrop(page, card(page, "a").getByRole("button", { name: "Drag API foundation", exact: true }), invalid);
  expect((await assignment.board()).packages.find((item) => item.project_id === "a")!.capacity_outcome_id).toBe(Foundation);
  await expect(page.locator("#sequencing-board > .error")).toContainText("linked owning outcome");
});

test("stale outcome moves reload saved rank with an accessible error and usable focus", async ({ page, assignment }) => {
  await page.goto("/"); let invalidated = false;
  await page.route("**/api/board", async (route) => { if (!invalidated && route.request().method() === "PUT" && route.request().postDataJSON().type === "outcomeAssignment") { invalidated = true; await assignment.moveOutcome(Retention, "core", Launch); } await route.fallback(); });
  const form = await placement(page, Foundation, "Foundation"); await form.getByLabel("Position for Foundation").selectOption("before"); await form.getByLabel("Move before outcome for Foundation").selectOption(Launch);
  const apply = form.getByRole("button", { name: "Apply Board placement" }); await apply.click();
  await expect(form.getByRole("alert")).toContainText("outcome priority");
  expect(await page.locator('#stream-core tr[data-timeline-outcome]').evaluateAll((items) => items.map((item) => item.getAttribute("data-timeline-outcome")))).toEqual([Retention, Launch, Foundation]);
  await expect(apply).toBeFocused();
});

test("a late Board save cannot reset or steal focus from a newer outcome-sidebar draft", async ({ page, assignment }) => {
  await page.goto("/"); let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/board", async (route) => { if (route.request().method() === "PUT") await gate; await route.fallback(); });
  await row(page, Foundation).getByRole("button", { name: "Drag outcome Foundation", exact: true }).dragTo(row(page, Retention).locator('[data-drop-outcome-side="before"]'));
  await row(page, Launch).getByRole("button", { name: "Launch", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Launch", exact: true }); await dialog.getByRole("button", { name: "Edit details", exact: true }).click(); await dialog.getByLabel("Notes").fill("A newer opening draft");
  release(); await expect(notice(page)).toContainText("Foundation placement saved");
  await expect(dialog.getByLabel("Notes")).toHaveValue("A newer opening draft"); await expect(dialog.getByLabel("Notes")).toBeFocused();
  expect((await assignment.board()).outcomes.find((item) => item.id === Foundation)!.stream_position).toBe(2);
});

test("Board title/sidebar handoff preserves catalog context and deletion falls back to the stream heading", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: /^Outcomes/ }).click(); await page.getByLabel("Search outcomes", { exact: true }).fill("outside this catalog query");
  await page.getByRole("button", { name: /^Board/ }).click(); await row(page, Launch).getByRole("button", { name: "Launch", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Launch", exact: true }); await expect(dialog).toContainText("Outside current filters"); await expect(dialog.locator("h2")).toBeFocused();
  await dialog.getByRole("button", { name: "Close outcome" }).click(); await expect(page.locator(`#board-outcome-title-${Launch}`)).toBeFocused();
  await row(page, Launch).locator('[data-timeline-project="linear:a"]').click(); await page.getByRole("dialog").getByRole("button", { name: "Open outcome Foundation", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Foundation", exact: true }); await expect(dialog).toBeVisible(); await expect(page.locator("dialog[open]")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Close outcome" }).click(); await expect(page.locator("#board-stream-title-core")).toBeFocused();
  await row(page, Launch).getByRole("button", { name: "Launch", exact: true }).click();
  page.once("dialog", (confirm) => void confirm.accept()); await page.getByRole("dialog").getByRole("button", { name: "Delete outcome", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0); await expect(page.locator("#board-stream-title-core")).toBeFocused();
  await expect(page.getByRole("button", { name: /^Board/ })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: /^Outcomes/ }).click(); await expect(page.getByLabel("Search outcomes", { exact: true })).toHaveValue("outside this catalog query");
});

test("source Hide is visibility-only and off-roadmap work has explicit source/Board triage", async ({ page, assignment }) => {
  await page.goto("/"); await page.getByRole("button", { name: /^Linear projects/ }).click(); await page.getByRole("button", { name: /^All visible/ }).click();
  const web = page.locator(".project-row").filter({ hasText: "Web experience" }); await web.getByRole("button", { name: "Hide", exact: true }).click();
  await page.getByRole("button", { name: /^Hidden/ }).click(); await web.getByRole("button", { name: "Plan on Board", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Web experience", exact: true }); await expect(drawer).toContainText("Hidden from source view"); expect((await assignment.board()).forecast.selectedKnown).toBe(10);
  await drawer.getByRole("button", { name: "Dismiss from roadmap" }).click(); await expect(drawer).toContainText("dismissed");
  expect((await assignment.board()).forecast.selectedKnown).toBe(7);
  await drawer.getByRole("button", { name: "Close project details" }).click(); await page.getByRole("button", { name: /^Linear projects/ }).click();
  await web.getByRole("button", { name: "Restore", exact: true }).click(); await page.getByRole("button", { name: /^Dismissed/ }).click(); await expect(web).toBeVisible();
  await page.getByRole("button", { name: /^Needs planning/ }).click(); await expect(web).toHaveCount(0);
});

for (const width of [1440, 768, 390]) {
  test(`long and many outcome rows stay operable at ${width}px with keyboard and forced colors`, async ({ page, assignment }, testInfo) => {
    const last = await assignment.seedManyBoardOutcomes(12); await page.setViewportSize({ width, height: 900 }); await page.goto("/");
    const target = row(page, last); await target.scrollIntoViewIfNeeded(); await expect(target).toBeInViewport();
    await expect(target.locator("details.outcome-move, .outcome-priority-rank, .outcome-priority-actions, .outcome-waiting")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    expect(await page.locator("#stream-core .calendar-scroll").evaluate((item) => getComputedStyle(item).maxHeight)).toBe("none");
    const label = (await target.locator(".timeline-outcome-controls-content").boundingBox())!, track = (await target.locator(".outcome-timeline-track").boundingBox())!;
    expect(track.height).toBeGreaterThanOrEqual(label.height);
    await page.screenshot({ path: testInfo.outputPath(`outcome-board-${width}.png`) });
    await target.getByRole("button", { name: /Drag outcome/ }).focus(); await page.keyboard.press("Tab");
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    const title = target.locator(".timeline-outcome-title"); await title.focus(); await expect(title).toHaveCSS("outline-style", "solid"); await title.click();
    const sidebar = page.getByRole("dialog"); await expect(sidebar.getByRole("button", { name: "Close outcome" })).toBeInViewport(); await expect(sidebar.getByRole("heading", { name: "Board placement" })).toBeVisible(); await sidebar.getByRole("button", { name: "Close outcome" }).click();
    await expect(title).toBeFocused(); expect((await assignment.board()).forecast.selectedKnown).toBe(10);
    await page.emulateMedia({ forcedColors: "none", reducedMotion: "reduce" });
    await page.locator(".roadmap-conversion-context > summary").click(); await page.getByRole("button", { name: "Inspect project context", exact: true }).click();
    const project = page.getByRole("dialog", { name: "Discovery", exact: true }), handle = await project.elementHandle();
    await project.getByRole("button", { name: "Include with an owning outcome", exact: true }).click();
    expect(await handle!.evaluate((element) => element === document.querySelector("dialog[open]"))).toBe(true);
    await expect(project.getByLabel("Outcome for linking Discovery")).toBeFocused(); await expect(project.getByRole("button", { name: "Close project details" })).toBeInViewport();
    expect(await project.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`roadmap-project-${width}.png`) });
    await page.keyboard.press("Escape");
  });
}

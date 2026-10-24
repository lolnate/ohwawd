import { expect, test, type Page } from "@playwright/test";

const projects = [
  { id: "project-assigned", name: "Assigned launch", description: "", status: "Started", url: "https://linear.app/assigned", cross_team: false, needs_review: false, in_scope: true, package_id: "linear:project-assigned", stream_id: "stream-1", issue_count: 2, unestimated_open_issues: 0, estimated_open_points: 8 },
  { id: "project-unassigned", name: "Identity migration", description: "", status: "Planned", url: "https://linear.app/unassigned", cross_team: false, needs_review: false, in_scope: true, package_id: "linear:project-unassigned", stream_id: null, issue_count: 3, unestimated_open_issues: 1, estimated_open_points: 5 },
];

const packages = projects.map((project, index) => ({
  id: project.package_id, project_id: project.id, name: project.name, status: project.status, url: project.url,
  stream_id: project.stream_id, selected: true, sequence_position: index + 1, linear_priority: index + 1, pause_reason: "",
  cross_team: false, needs_review: false, in_scope: true,
}));

async function mockWorkspace(page: Page, scenarioReady = true) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session") return route.fulfill({ json: { authenticated: true } });
    if (path === "/api/state") return route.fulfill({ json: {
      connection: { viewer_name: "Owner", team_id: "team-1", team_name: "Product", last_imported_at: "2026-10-20T10:00:00Z" },
      projects, outcomes: [{ id: "outcome-1", title: "Customers migrate identity", description: "", owner: "Owner", success_signal: "Migration completes", needed_by: "2026-11-30" }],
      links: [{ outcome_id: "outcome-1", project_id: "project-unassigned", requirement: "minimum" }], streams: [{ id: "stream-1", name: "Core" }],
    } });
    if (path === "/api/streams") return route.fulfill({ json: { streams: [{ id: "stream-1", name: "Core", position: 1, wip_limit: 2, allocation: 1, active: true, retired_at: null, retirement_reason: "", package_count: 1 }], activeScenario: null, events: [] } });
    if (path === "/api/scenarios") return route.fulfill({ json: { baselineRevisionId: null, activeScenarioId: null, activeDraftDirty: false, currentSourceAt: "2026-10-20T10:00:00Z", creationReadiness: { ready: scenarioReady, blockers: scenarioReady ? [] : ["Set a provisional baseline in points per cycle."], warnings: [] }, scenarios: [] } });
    if (path === "/api/board") return route.fulfill({ json: {
      connection: { team_name: "Product", cycles_enabled: true, cycle_duration: 1, cycle_start_day: 1, cycle_cooldown_time: 0, upcoming_cycle_count: 8 },
      packages, streams: [{ id: "stream-1", name: "Core", allocation: 1, wip_limit: 2 }],
      links: [{ outcome_id: "outcome-1", project_id: "project-unassigned", requirement: "minimum" }],
      capacity: { baseline: 10, baseline_reason: "Recent delivery", reserve: 1, horizon: 8, scoping_lead_days: 14 }, observations: [], observedBaseline: null, effectiveBaseline: 10,
      linearCycles: Array.from({ length: 8 }, (_, index) => ({ id: `cycle-${index + 1}`, number: index + 1, name: `Cycle ${index + 1}`, startsAt: new Date(Date.UTC(2026, 10, 2 + index * 7)).toISOString(), endsAt: new Date(Date.UTC(2026, 10, 9 + index * 7)).toISOString() })),
      currentCycleId: null, cycleAnchorAt: "2026-10-20T10:00:00Z", futureCycleIds: Array.from({ length: 8 }, (_, index) => `cycle-${index + 1}`), adjustments: [], legacyAdjustments: [], dependencies: [], extraScopes: [], scoping: [], evaluatedAt: "2026-10-20T10:00:00Z",
      sequencing: { packages: packages.map((item) => ({ id: item.id, name: item.name, streamId: item.stream_id, selected: true, position: item.sequence_position, complete: false })), dependencies: [], streamIds: ["stream-1"] }, sequenceToken: "fixture", sequenceConflicts: [],
      issues: [{ linear_id: "issue-1", project_id: "project-unassigned", identifier: "ID-1", estimate: null, state_type: "started" }],
      outcomes: [{ id: "outcome-1", title: "Customers migrate identity", description: "", owner: "Owner", success_signal: "Migration completes", needed_by: "2026-11-30" }], timezone: "UTC", reconciliationWarnings: [],
      forecast: { ready: true, setup: [], errors: [], sourceAt: "2026-10-20T10:00:00Z", selectedKnown: 13, selectedUnknown: 1, unallocated: 0,
        packages: [{ id: "linear:project-assigned", demand: 8, provisional: false, start: 1, finish: 2, reason: null, consumed: [4, 4] }, { id: "linear:project-unassigned", demand: 5, provisional: false, start: null, finish: null, reason: "1 open issue has no estimate or allowance.", consumed: [] }],
        outcomes: [{ id: "outcome-1", status: "blocked", finish: null, endDate: null, target: "unknown", gapCycles: null, reasons: ["Identity migration: 1 open issue has no estimate or allowance."], requiredIds: ["linear:project-unassigned"] }],
        cycles: Array.from({ length: 8 }, (_, index) => ({ id: `cycle-${index + 1}`, number: index + 1, name: `Cycle ${index + 1}`, index: index + 1, start: `2026-11-${String(2 + index * 7).padStart(2, "0")}`, end: `2026-11-${String(8 + index * 7).padStart(2, "0")}`, available: 9, streams: [{ id: "stream-1", budget: 9, used: index < 2 ? 4 : 0, idle: index < 2 ? 5 : 9, active: index < 2 ? ["linear:project-assigned"] : [] }] })),
      },
    } });
    return route.fulfill({ status: 404, json: { error: `Unmocked ${path}` } });
  });
}

async function expectContained(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
}

for (const viewport of [{ width: 390, height: 844 }, { width: 412, height: 915 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
  test(`all workspace views stay contained at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockWorkspace(page);
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Workspace views" })).toBeVisible();

    for (const label of ["Board", "Outcomes", "Linear projects", "Scenarios"]) {
      const tab = page.getByRole("button", { name: new RegExp(`^${label}`) });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-current", "page");
      await expectContained(page);
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      const settings = page.getByRole("dialog", { name: "Settings", exact: true });
      await expect(settings.getByRole("button", { name: "Close Settings" })).toBeInViewport();
      expect(await settings.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await expectContained(page);
      await settings.getByRole("button", { name: "Close Settings" }).click();
      await expect(tab).toHaveAttribute("aria-current", "page");
      if (viewport.width <= 760) {
        const box = await tab.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      }
    }

    await page.getByRole("button", { name: /^Board/ }).click();
    if (viewport.width === 1440) {
      const shelf = await page.locator(".priority-shelf").boundingBox();
      const lane = await page.locator("#unassigned-work").boundingBox();
      expect(shelf).not.toBeNull();
      expect(lane).not.toBeNull();
      expect(Math.abs(shelf!.width - lane!.width)).toBeLessThan(1);
    }
    const timeline = page.getByRole("region", { name: /forecast timeline/ });
    await expect(timeline).toBeVisible();
    if (viewport.width < 1000) expect(await timeline.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  });
}

test("outcome links open in a contained focused picker", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkspace(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^Outcomes/ }).click();
  await page.getByRole("button", { name: /Manage project links/ }).click();
  await expect(page.getByRole("dialog", { name: "Customers migrate identity" })).toBeVisible();
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  await expectContained(page);
});

test("scenario creation requires a name and a ready board", async ({ page }) => {
  await mockWorkspace(page, false);
  await page.goto("/");
  await page.getByRole("button", { name: /^Scenarios/ }).click();
  await page.getByLabel("Scenario name").fill("Capacity option");
  await expect(page.getByRole("button", { name: "Create from board" })).toBeDisabled();
  await expect(page.getByText("Set a provisional baseline in points per cycle.")).toBeVisible();
  await page.getByRole("button", { name: "Configure board" }).click();
  await expect(page.getByRole("button", { name: /^Board/ })).toHaveAttribute("aria-current", "page");
});

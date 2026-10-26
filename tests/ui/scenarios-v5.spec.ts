import { test, expect } from "./assignment-fixture";
import type { Page } from "@playwright/test";

const Foundation = "00000000-0000-4000-8000-000000000002", Retention = "00000000-0000-4000-8000-000000000003";
async function scenarios(page: Page) { await page.goto("/"); await page.getByRole("button", { name: /^Scenarios/ }).click(); }
async function publish(page: Page, rationale: string) {
  await page.getByLabel("Decision rationale").fill(rationale); await page.getByRole("button", { name: "Publish revision", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Immutable revision published");
}
async function compare(page: Page, left: string, right: string) {
  await page.getByRole("combobox", { name: "From", exact: true }).selectOption({ label: left });
  await page.getByRole("combobox", { name: "To", exact: true }).selectOption({ label: right });
  await page.getByRole("button", { name: "Compare", exact: true }).click(); await expect(page.getByRole("status")).toContainText("Comparison loaded");
}

test("v5 scenario save/publication compares outcome rank and excluded states independently of source priority", async ({ page, assignment }) => {
  await assignment.shareProjects(); await assignment.activateRoadmap(); await scenarios(page);
  await page.getByLabel("Scenario name").fill("Ranked option"); await page.getByRole("button", { name: "Create from board" }).click();
  await expect(page.getByRole("status")).toContainText("Scenario draft created"); await publish(page, "Initial rank");
  await assignment.moveOutcome(Retention, "core", Foundation); await assignment.changeMembership("b", "defer"); await assignment.changeMembership("d", "dismiss");
  await scenarios(page); await expect(page.locator(".publish-box")).toContainText("unsaved changes");
  await page.getByRole("button", { name: "Save board", exact: true }).click(); await expect(page.getByRole("status")).toContainText("Current board saved");
  await publish(page, "Reordered outcomes and excluded work"); await compare(page, "Ranked option r1", "Ranked option r2");
  await expect(page.getByText("Calculation: v5 → v5", { exact: false })).toBeVisible();
  await expect(page.locator(".comparison p").filter({ hasText: /Retention.*outcome rank: 2 → 1/ })).toBeVisible();
  await expect(page.locator(".comparison p").filter({ hasText: /Web experience.*included.*deferred/ })).toBeVisible();
  await expect(page.locator(".comparison p").filter({ hasText: /Discovery.*candidate.*dismissed/ })).toBeVisible();
  expect((await assignment.board()).calculationVersion).toBe("v5");
});

test("legacy loading shows named conversion feedback and requires explicit save before v5 publication", async ({ page, assignment }, testInfo) => {
  await assignment.shareProjects(); await assignment.activateRoadmap(); await assignment.seedLegacyScenario();
  await page.setViewportSize({ width: 390, height: 900 }); await scenarios(page);
  await expect(page.locator(".scenario-draft")).toContainText("v5 outcome-priority conversion");
  await page.getByLabel("Decision rationale").fill("Review converted plan"); await expect(page.getByRole("button", { name: "Publish revision" })).toBeDisabled();
  page.once("dialog", (dialog) => void dialog.accept()); await page.getByRole("button", { name: "Load draft", exact: true }).click();
  const report = page.getByRole("region", { name: "Loaded plan reconciliation" });
  await expect(report).toContainText("API foundation"); await expect(report).toContainText("Needs assignment");
  await page.getByRole("button", { name: "Save board", exact: true }).click(); await expect(page.locator(".scenario-draft")).not.toContainText("v5 outcome-priority conversion");
  await publish(page, "Converted plan reviewed"); await compare(page, "Legacy option r1", "Legacy option r2");
  await expect(page.getByText("Calculation: v4 → v5", { exact: false })).toBeVisible();
  await expect(page.getByRole("region", { name: "Frozen outcome lifecycle evidence" })).toContainText("Lifecycle not recorded");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.locator(".scenario-panel").screenshot({ path: testInfo.outputPath("legacy-v5-comparison-390.png") });
});

test("published lifecycle displays saved open/completed evidence even after live reopening", async ({ page, assignment }) => {
  await assignment.shareProjects(); await assignment.activateRoadmap(); await assignment.setProjectCompleted("a", true); await assignment.setProjectCompleted("c", true);
  await scenarios(page); await page.getByLabel("Scenario name").fill("Lifecycle option"); await page.getByRole("button", { name: "Create from board" }).click();
  await expect(page.getByRole("status")).toContainText("Scenario draft created"); await publish(page, "Saved open evidence");
  async function lifecycle(completed: boolean) {
    return page.evaluate(async ({ id, completed }) => {
      const state = await (await fetch("/api/state")).json(), current = state.outcomes.find((item: { id: string }) => item.id === id).lifecycle;
      const response = await fetch(`/api/outcomes/${id}/completion`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed, expectedLifecycleVersion: current.lifecycleVersion, eligibilityToken: current.eligibilityToken }) });
      return response.status;
    }, { id: Foundation, completed });
  }
  expect(await lifecycle(true)).toBe(200);
  await page.getByRole("button", { name: "Save board", exact: true }).click(); await publish(page, "Saved completed evidence");
  expect(await lifecycle(false)).toBe(200); await compare(page, "Lifecycle option r1", "Lifecycle option r2");
  const history = page.getByRole("region", { name: "Frozen outcome lifecycle evidence" });
  await expect(history.locator("p").filter({ hasText: /Foundation/ })).toContainText("Open · Ready to mark complete → Completed");
  expect((await assignment.board()).outcomes.find((item) => item.id === Foundation)!.lifecycle.completedAt).toBeNull();
});

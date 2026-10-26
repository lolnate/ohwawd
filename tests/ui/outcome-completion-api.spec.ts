import { test, expect } from "./assignment-fixture";
import type { Page } from "@playwright/test";
import type { OutcomeLifecycle } from "../../src/lib/outcome-completion";

const id = "00000000-0000-4000-8000-000000000001";
async function put(page: Page, body: unknown) {
  return page.evaluate(async ({ id, body }) => {
    const response = await fetch(`/api/outcomes/${id}/completion`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as { saved?: boolean; lifecycle: OutcomeLifecycle; code?: string } };
  }, { id, body });
}
async function read(page: Page) {
  return page.evaluate(async (id) => {
    const state = await (await fetch("/api/state")).json();
    return state.outcomes.find((item: { id: string }) => item.id === id).lifecycle as OutcomeLifecycle;
  }, id);
}

test("real completion route rejects unauthenticated writes before touching database state", async ({ request }) => {
  // APIRequestContext bypasses the page's intercepted application fixture here.
  const result = await request.put(`/api/outcomes/${id}/completion`, { data: { completed: true, expectedLifecycleVersion: 0, eligibilityToken: "untrusted" } });
  expect(result.status()).toBe(401);
  expect(await result.json()).toEqual({ error: "Sign in to continue." });
});

test("API-shaped completion/reopen uses current proof, accepted snapshots and sticky source review", async ({ page, assignment }) => {
  await assignment.activateRoadmap(); await page.goto("/");
  let current = await read(page);
  expect(current.ready).toBe(false); expect(current.completedAt).toBeNull();
  expect((await put(page, { completed: true, expectedLifecycleVersion: current.lifecycleVersion, eligibilityToken: current.eligibilityToken })).status).toBe(422);
  await assignment.setProjectCompleted("c", true); current = await read(page);
  expect(current.ready).toBe(false); // Rollout also requires the unlinked API prerequisite.
  await assignment.setProjectCompleted("a", true); current = await read(page);
  expect(current.ready).toBe(true); expect(current.completedAt).toBeNull();
  const payload = { completed: true, expectedLifecycleVersion: current.lifecycleVersion, eligibilityToken: current.eligibilityToken };
  const accepted = await put(page, payload);
  expect(accepted.status).toBe(200); expect(accepted.body.saved).toBe(true); expect(accepted.body.lifecycle.completedAt).not.toBeNull();
  expect(await read(page)).toEqual(accepted.body.lifecycle);
  expect((await put(page, payload)).body.code).toBe("OUTCOME_EVIDENCE_CONFLICT");
  await assignment.setProjectCompleted("c", false); current = await read(page);
  expect(current.reviewNeeded).toBe(true); expect(current.completedAt).toBe(accepted.body.lifecycle.completedAt);
  const replanned = (await assignment.board()).forecast.packages.find((item) => item.id === "linear:c")!;
  expect([replanned.start, replanned.finish]).toEqual([1, 1]); // The business marker is not a scheduling gate.
  const reopened = await put(page, { completed: false, expectedLifecycleVersion: current.lifecycleVersion, eligibilityToken: current.eligibilityToken });
  expect(reopened.status).toBe(200); expect(reopened.body.lifecycle.completedAt).toBeNull(); expect(reopened.body.lifecycle.ready).toBe(false);
  expect((await assignment.board()).outcomes[0].lifecycle).toEqual(reopened.body.lifecycle);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { migrations } from "../src/lib/db";
import { saveImport } from "../src/lib/import";
import type { ImportedCycle, ImportedProject, ImportedTeamIssue } from "../src/lib/linear";
import {
  getOngoingWorkInsights,
  parseHistoryRange,
  parseOngoingWorkDetailSelector,
  readOngoingWorkIssueDetails,
} from "../src/lib/ongoing-work-insights";
import { HttpError } from "../src/lib/security";
import { getBoard } from "../src/lib/board";

async function applyMigrations(database: PGlite) {
  for (const migration of migrations) {
    if (migration.sql) await database.exec(migration.sql);
    if ("up" in migration) await migration.up(database as unknown as PoolClient);
  }
}

const project = (id: string, name: string, classification: "Roadmap" | "Ongoing" | null): ImportedProject => ({
  id, teamId: "team", name, description: "", status: "started", url: `https://linear.app/project/${id}`,
  updatedAt: new Date("2026-11-01T00:00:00Z"), crossTeam: false, issues: [],
  labels: classification ? [{ id: `${classification.toLowerCase()}-${id}`, name: classification }] : [],
});

const issue = (id: string, projectId: string | null, stateType: string, estimate: number | null, completedAt: string | null = null): ImportedTeamIssue => ({
  id, projectId, teamId: "team", identifier: `ENG-${id}`, title: `Issue ${id}`, url: `https://linear.app/issue/${id}`,
  estimate, stateType, completedAt: completedAt ? new Date(completedAt) : null, updatedAt: new Date("2026-11-01T00:00:00Z"),
});

const cycle = (index: number): ImportedCycle => {
  const startsAt = new Date(Date.UTC(2026, 7, 31 + (index - 1) * 7));
  const endsAt = new Date(startsAt.getTime() + 7 * 86400000);
  return { id: `cycle-${index}`, teamId: "team", number: index, name: `Cycle ${index}`, startsAt, endsAt,
    completedAt: endsAt, cycleDays: 7, completedPoints: index };
};

function source(projects: ImportedProject[], issues: ImportedTeamIssue[], blockerEdges: { blockerId: string; blockedIssueId: string }[] = [], cycles: ImportedCycle[] = []) {
  return { encryptedKey: "ciphertext", viewer: { id: "viewer", name: "Owner" }, team: { id: "team", name: "Team" }, projects,
    teamIssueSource: { issues, blockerEdges }, cycles };
}

function status(error: unknown): number | undefined {
  return error instanceof HttpError ? error.status : undefined;
}

test("available work uses exclusive buckets, issue geometry, blocker evidence, and stable Ready ordering", async () => {
  const database = new PGlite();
  try {
    await applyMigrations(database);
    const client = database as unknown as PoolClient;
    const projects = [
      project("beta", "Beta", "Ongoing"), project("alpha", "Alpha", "Ongoing"), project("zero", "Zero Ready", "Ongoing"),
      project("needs", "Needs", null), project("roadmap", "Roadmap", "Roadmap"),
    ];
    const issues = [
      issue("alpha-ready-known", "alpha", "unstarted", 3), issue("alpha-ready-unknown", "alpha", "unstarted", null),
      issue("alpha-resolved-blocker", "alpha", "unstarted", 1), issue("done-predecessor", "roadmap", "completed", 1, "2026-10-20T00:00:00Z"),
      issue("alpha-blocked", "alpha", "unstarted", 2), issue("alpha-backlog", "alpha", "backlog", null),
      issue("alpha-started", "alpha", "started", 5), issue("alpha-terminal", "alpha", "canceled", 8),
      issue("beta-ready-1", "beta", "unstarted", 2), issue("beta-ready-2", "beta", "unstarted", 2), issue("beta-ready-3", "beta", "unstarted", 2),
      issue("zero-blocked", "zero", "unstarted", null), issue("zero-backlog", "zero", "backlog", 5),
      issue("needs-ready", "needs", "unstarted", null), issue("roadmap-ready", "roadmap", "unstarted", 13),
    ];
    await saveImport(client, source(projects, issues, [
      { blockerId: "done-predecessor", blockedIssueId: "alpha-resolved-blocker" },
      { blockerId: "external-unavailable", blockedIssueId: "alpha-blocked" },
      { blockerId: "external-unavailable", blockedIssueId: "alpha-backlog" },
      { blockerId: "external-unavailable", blockedIssueId: "zero-blocked" },
    ]), new Date("2026-11-01T00:00:00Z"));

    const available = (await getOngoingWorkInsights(client, "team")).available;
    assert.deepEqual(available.rows.map((row) => row.projectId), ["alpha", "beta", "zero"]);
    assert.deepEqual(available.rows[0], {
      rowId: "ongoing:alpha", group: "ongoing", projectId: "alpha", projectName: "Alpha", projectUrl: "https://linear.app/project/alpha",
      ready: { issueCount: 3, knownPoints: 4, unestimatedCount: 1 },
      blocked: { issueCount: 1, knownPoints: 2, unestimatedCount: 0 },
      backlog: { issueCount: 1, knownPoints: 0, unestimatedCount: 1 }, startedCount: 1,
    });
    assert.deepEqual(available.rows[2].ready, { issueCount: 0, knownPoints: 0, unestimatedCount: 0 });
    assert.deepEqual(available.needsClassificationRows.map((row) => [row.projectId, row.ready]), [
      ["needs", { issueCount: 1, knownPoints: 0, unestimatedCount: 1 }],
    ]);
    assert.deepEqual(available.totals, {
      ready: { issueCount: 6, knownPoints: 10, unestimatedCount: 1 },
      blocked: { issueCount: 2, knownPoints: 2, unestimatedCount: 1 },
      backlog: { issueCount: 2, knownPoints: 5, unestimatedCount: 1 },
    });

    const blocked = await readOngoingWorkIssueDetails(client, "team", {
      view: "available", group: "ongoing", projectId: "alpha", bucket: "blocked",
    });
    assert.deepEqual(blocked, [{ identifier: "ENG-alpha-blocked", title: "Issue alpha-blocked", url: "https://linear.app/issue/alpha-blocked",
      estimate: 2, workflow: "unstarted", unresolvedBlockers: [{ id: "external-unavailable", identifier: null, title: null, url: null, workflow: null, unavailable: true }] }]);
    const backlog = await readOngoingWorkIssueDetails(client, "team", {
      view: "available", group: "ongoing", projectId: "alpha", bucket: "backlog",
    });
    assert.equal(backlog[0].unresolvedBlockers[0].unavailable, true);
    const board = await getBoard(client);
    assert.deepEqual(board.ongoingWork.available.rows.map((row) => row.projectId), ["alpha", "beta", "zero"]);
    assert.deepEqual(board.issues.map((item) => item.linear_id).sort(), ["done-predecessor", "roadmap-ready"]);
    await assert.rejects(readOngoingWorkIssueDetails(client, "team", {
      view: "available", group: "needs-classification", projectId: "alpha", bucket: "ready",
    }), (error) => status(error) === 404);
  } finally { await database.close(); }
});

test("completed history defaults to six cycles and expands frozen, recent, attention, and uncovered evidence exactly", async () => {
  const database = new PGlite();
  try {
    await applyMigrations(database);
    const client = database as unknown as PoolClient;
    const cycles = Array.from({ length: 8 }, (_, index) => cycle(index + 1));
    const projects = [project("ongoing", "Ongoing", "Ongoing"), project("other", "Other", "Ongoing"), project("needs", "Needs", null)];
    const issues = [
      issue("old-known", "ongoing", "completed", 5, "2026-09-16T12:00:00Z"),
      issue("old-unknown", "ongoing", "completed", null, "2026-09-17T12:00:00Z"),
      issue("recent", "other", "completed", 3, "2026-10-21T12:00:00Z"),
      issue("needs", "needs", "completed", null, "2026-10-14T12:00:00Z"),
      issue("none", null, "completed", 2, "2026-10-07T12:00:00Z"),
      issue("uncovered", "ongoing", "completed", 1, "2026-07-01T12:00:00Z"),
    ];
    await saveImport(client, source(projects, issues, [], cycles), new Date("2026-11-01T00:00:00Z"));
    assert.equal((await database.query("SELECT issue_id FROM completed_issue_attribution WHERE issue_id='old-known'")).rows.length, 1);

    const recent = (await getOngoingWorkInsights(client, "team")).completedHistory;
    assert.equal(recent.range, "recent");
    assert.deepEqual(recent.cycles.map((item) => item.id), ["cycle-3", "cycle-4", "cycle-5", "cycle-6", "cycle-7", "cycle-8"]);
    assert.equal(recent.olderCycleCount, 2);
    assert.equal(recent.missingCycleCoverageCount, 1);
    assert.deepEqual(recent.rows.map((row) => row.rowId), ["project:ongoing", "project:other"]);
    assert.deepEqual(recent.rows.find((row) => row.projectId === "ongoing")?.cells, [
      { cycleId: "cycle-3", issueCount: 2, knownPoints: 5, unestimatedCount: 1 },
    ]);
    assert.deepEqual(recent.attentionRows.map((row) => [row.rowId, row.cells]), [
      ["needs-classification", [{ cycleId: "cycle-7", issueCount: 1, knownPoints: 0, unestimatedCount: 1 }]],
      ["no-project", [{ cycleId: "cycle-6", issueCount: 1, knownPoints: 2, unestimatedCount: 0 }]],
    ]);

    const all = (await getOngoingWorkInsights(client, "team", "all")).completedHistory;
    assert.equal(all.cycles.length, 8);
    assert.deepEqual(all.cycles.slice(-6), recent.cycles);
    assert.deepEqual(all.rows.find((row) => row.projectId === "ongoing")?.cells, recent.rows.find((row) => row.projectId === "ongoing")?.cells);

    const frozenDetails = await readOngoingWorkIssueDetails(client, "team", {
      view: "history", row: { kind: "project", projectId: "ongoing" }, cycleId: "cycle-3",
    });
    assert.deepEqual(frozenDetails.map((item) => [item.identifier, item.estimate, item.workflow]), [
      ["ENG-old-known", 5, "completed"], ["ENG-old-unknown", null, "completed"],
    ]);

    await saveImport(client, source(projects, issues.filter((item) => !item.id.startsWith("old-")), [], cycles), new Date("2026-11-02T00:00:00Z"));
    const afterRemoval = (await getOngoingWorkInsights(client, "team")).completedHistory;
    assert.deepEqual(afterRemoval.rows.find((row) => row.projectId === "ongoing")?.cells, recent.rows.find((row) => row.projectId === "ongoing")?.cells);
  } finally { await database.close(); }
});

test("Ongoing work read API selectors reject malformed, duplicate, fabricated, and browser-supplied issue filters", async () => {
  assert.deepEqual(parseOngoingWorkDetailSelector(new URLSearchParams("view=available&row=ongoing:project-1&bucket=ready")),
    { view: "available", group: "ongoing", projectId: "project-1", bucket: "ready" });
  assert.deepEqual(parseOngoingWorkDetailSelector(new URLSearchParams("view=history&row=no-project&cycle=cycle-1")),
    { view: "history", row: { kind: "no-project" }, cycleId: "cycle-1" });
  assert.equal(parseHistoryRange(new URLSearchParams()), "recent");
  assert.equal(parseHistoryRange(new URLSearchParams("history=all")), "all");

  for (const query of [
    "view=available&row=ongoing:project-1&bucket=ready&issueId=trusted-by-browser",
    "view=available&row=ongoing:project-1&bucket=started",
    "view=available&row=ongoing:project-1&row=ongoing:project-2&bucket=ready",
    "view=history&row=project:bad%3Aid&cycle=cycle-1",
    "view=history&row=needs-classification&cycle=../cycle",
    "view=other&row=no-project&cycle=cycle-1",
  ]) assert.throws(() => parseOngoingWorkDetailSelector(new URLSearchParams(query)), (error) => status(error) === 400);
  assert.throws(() => parseHistoryRange(new URLSearchParams("history=all&project=x")), (error) => status(error) === 400);

  const database = new PGlite();
  try {
    await applyMigrations(database);
    const client = database as unknown as PoolClient;
    await saveImport(client, source([project("ongoing", "Ongoing", "Ongoing")], [issue("ready", "ongoing", "unstarted", 1)], [], [cycle(1)]),
      new Date("2026-11-01T00:00:00Z"));
    await assert.rejects(readOngoingWorkIssueDetails(client, "team", {
      view: "available", group: "ongoing", projectId: "fabricated", bucket: "ready",
    }), (error) => status(error) === 404);
    await assert.rejects(readOngoingWorkIssueDetails(client, "team", {
      view: "history", row: { kind: "project", projectId: "ongoing" }, cycleId: "fabricated",
    }), (error) => status(error) === 404);
  } finally { await database.close(); }
});

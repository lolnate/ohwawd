import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { readCompletedWorkHistoryEvidence } from "../src/lib/completed-work-history";
import { migrations } from "../src/lib/db";
import { saveImport } from "../src/lib/import";
import type { ImportedCycle, ImportedProject, ImportedTeamIssue } from "../src/lib/linear";

async function applyMigrations(database: PGlite) {
  for (const migration of migrations) {
    if (migration.sql) await database.exec(migration.sql);
    if ("up" in migration) await migration.up(database as unknown as PoolClient);
  }
}

const project = (id: string, classification: "Roadmap" | "Ongoing" | null, name = id): ImportedProject => ({
  id, teamId: "team", name, description: "", status: "started", url: `https://linear.app/project/${id}`,
  updatedAt: new Date("2026-11-01T00:00:00Z"), crossTeam: false, issues: [],
  labels: classification ? [{ id: `${classification.toLowerCase()}-label`, name: classification }] : [],
});

const issue = (id: string, projectId: string | null, completedAt: string): ImportedTeamIssue => ({
  id, projectId, teamId: "team", identifier: `ENG-${id}`, title: `Issue ${id}`, url: `https://linear.app/issue/${id}`,
  estimate: id.length, stateType: "completed", completedAt: new Date(completedAt), updatedAt: new Date("2026-11-01T00:00:00Z"),
});

const cycle = (id: string, startsAt: string, endsAt: string): ImportedCycle => ({
  id, teamId: "team", number: 1, name: id, startsAt: new Date(startsAt), endsAt: new Date(endsAt),
  completedAt: new Date(endsAt), cycleDays: Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 86400000), completedPoints: 1,
});

const importInput = (projects: ImportedProject[], issues: ImportedTeamIssue[], cycles: ImportedCycle[] = []) => ({
  encryptedKey: "ciphertext", viewer: { id: "viewer", name: "Owner" }, team: { id: "team", name: "Team" }, projects,
  teamIssueSource: { issues, blockerEdges: [] }, cycles,
});

test("recent completed work follows current project and classification with actual-cycle coverage", async () => {
  const database = new PGlite();
  try {
    await applyMigrations(database);
    const client = database as unknown as PoolClient;
    const projects = [project("ongoing-a", "Ongoing"), project("ongoing-b", "Ongoing"), project("needs", null), project("roadmap", "Roadmap")];
    const issues = [
      issue("move", "ongoing-a", "2026-10-20T12:00:00Z"),
      issue("none", null, "2026-10-20T12:00:00Z"),
      issue("needs", "needs", "2026-10-20T12:00:00Z"),
      issue("unknown", "unavailable-project", "2026-10-20T12:00:00Z"),
      issue("roadmap", "roadmap", "2026-10-20T12:00:00Z"),
    ];
    await saveImport(client, importInput(projects, issues, [cycle("cycle-1", "2026-10-15T00:00:00Z", "2026-10-22T00:00:00Z")]), new Date("2026-11-01T00:00:00Z"));

    let history = await readCompletedWorkHistoryEvidence(client, "team");
    assert.deepEqual(history.map((row) => [row.issueId, row.projectId, row.attribution, row.cycleId, row.frozenAt]), [
      ["move", "ongoing-a", "ongoing", "cycle-1", null],
      ["needs", "needs", "needs-classification", "cycle-1", null],
      ["none", null, "no-project", "cycle-1", null],
      ["unknown", "unavailable-project", "needs-classification", "cycle-1", null],
    ]);

    await saveImport(client, importInput(projects.filter((item) => item.id !== "ongoing-a"), issues), new Date("2026-11-01T12:00:00Z"));
    history = await readCompletedWorkHistoryEvidence(client, "team");
    assert.equal(history.find((row) => row.issueId === "move")?.attribution, "needs-classification");

    issues[0] = issue("move", "ongoing-b", "2026-10-20T12:00:00Z");
    await saveImport(client, importInput(projects, issues), new Date("2026-11-02T00:00:00Z"));
    history = await readCompletedWorkHistoryEvidence(client, "team");
    assert.equal(history.find((row) => row.issueId === "move")?.projectId, "ongoing-b");
    assert.equal(history.some((row) => row.issueId === "roadmap"), false);
  } finally { await database.close(); }
});

test("attribution freezes at exactly 30 days and survives later source movement and removal", async () => {
  const database = new PGlite();
  try {
    await applyMigrations(database);
    const client = database as unknown as PoolClient;
    const completedAt = "2026-10-02T00:00:00Z";
    const ongoingA = project("ongoing-a", "Ongoing", "Ongoing A");
    const ongoingB = project("ongoing-b", "Roadmap", "Ongoing B");
    const sourceIssue = issue("freeze", "ongoing-a", completedAt);

    await saveImport(client, importInput([ongoingA, ongoingB], [sourceIssue]), new Date("2026-10-31T23:59:59.999Z"));
    assert.equal((await database.query("SELECT issue_id FROM completed_issue_attribution")).rows.length, 0);
    assert.equal((await readCompletedWorkHistoryEvidence(client, "team"))[0].frozenAt, null);

    await saveImport(client, importInput([ongoingA, ongoingB], [sourceIssue]), new Date("2026-11-01T00:00:00Z"));
    const snapshot = (await database.query<{ project_id: string; classification: string; freeze_reason: string }>(
      "SELECT project_id,classification,freeze_reason FROM completed_issue_attribution WHERE issue_id='freeze'",
    )).rows[0];
    assert.deepEqual(snapshot, { project_id: "ongoing-a", classification: "ongoing", freeze_reason: "cutoff" });

    const renamedA = project("ongoing-a", "Roadmap", "Renamed A");
    sourceIssue.projectId = "ongoing-b";
    await saveImport(client, importInput([renamedA, ongoingB], [sourceIssue]), new Date("2026-11-02T00:00:00Z"));
    let history = await readCompletedWorkHistoryEvidence(client, "team");
    assert.deepEqual({ projectId: history[0].projectId, projectName: history[0].projectName, classification: history[0].classification },
      { projectId: "ongoing-a", projectName: "Renamed A", classification: "ongoing" });

    await saveImport(client, importInput([renamedA, ongoingB], [], [cycle("corrected-cycle", "2026-10-01T00:00:00Z", "2026-10-08T00:00:00Z")]), new Date("2026-11-03T00:00:00Z"));
    history = await readCompletedWorkHistoryEvidence(client, "team");
    assert.equal(history[0].cycleId, "corrected-cycle");
    await assert.rejects(database.query("UPDATE completed_issue_attribution SET title='Changed' WHERE issue_id='freeze'"), /immutable/);
    await assert.rejects(database.query("DELETE FROM completed_issue_attribution WHERE issue_id='freeze'"), /immutable/);
  } finally { await database.close(); }
});

test("first full sync freezes old unresolved and no-project evidence as current-at-migration without inventing cycles", async () => {
  const database = new PGlite();
  try {
    await applyMigrations(database);
    const client = database as unknown as PoolClient;
    const oldIssues = [
      issue("old-needs", "needs", "2026-09-01T00:00:00Z"),
      issue("old-none", null, "2026-09-01T00:00:00Z"),
      issue("old-unavailable", "missing", "2026-09-01T00:00:00Z"),
    ];
    await saveImport(client, importInput([project("needs", null)], oldIssues), new Date("2026-11-01T00:00:00Z"));

    assert.equal((await database.query<{ completed_attribution_backfilled: boolean }>(
      "SELECT completed_attribution_backfilled FROM workspace WHERE id=1",
    )).rows[0].completed_attribution_backfilled, true);
    assert.deepEqual((await database.query<{ issue_id: string; project_id: string | null; classification: string; freeze_reason: string }>(
      "SELECT issue_id,project_id,classification,freeze_reason FROM completed_issue_attribution ORDER BY issue_id",
    )).rows, [
      { issue_id: "old-needs", project_id: "needs", classification: "unresolved", freeze_reason: "current-at-migration" },
      { issue_id: "old-none", project_id: null, classification: "unresolved", freeze_reason: "current-at-migration" },
      { issue_id: "old-unavailable", project_id: "missing", classification: "unresolved", freeze_reason: "current-at-migration" },
    ]);
    const history = await readCompletedWorkHistoryEvidence(client, "team");
    assert.deepEqual(history.map((row) => [row.issueId, row.attribution, row.cycleId]), [
      ["old-needs", "needs-classification", null],
      ["old-none", "no-project", null],
      ["old-unavailable", "needs-classification", null],
    ]);
  } finally { await database.close(); }
});

test("snapshot failure rolls back the full import and eligible evidence inserts in bounded batches", async () => {
  const database = new PGlite();
  try {
    await applyMigrations(database);
    const client = database as unknown as PoolClient;
    const oldIssues = Array.from({ length: 101 }, (_, index) => issue(`batch-${index}`, "ongoing", "2026-09-01T00:00:00Z"));
    await database.exec(`CREATE FUNCTION fail_attribution_insert() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'forced attribution failure'; END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_attribution BEFORE INSERT ON completed_issue_attribution
      FOR EACH ROW EXECUTE FUNCTION fail_attribution_insert()`);

    await database.exec("BEGIN");
    await assert.rejects(saveImport(client, importInput([project("ongoing", "Ongoing")], oldIssues), new Date("2026-11-01T00:00:00Z")),
      /forced attribution failure/);
    await database.exec("ROLLBACK");
    assert.equal((await database.query("SELECT linear_id FROM linear_issue_cache")).rows.length, 0);
    assert.equal((await database.query("SELECT issue_id FROM completed_issue_attribution")).rows.length, 0);
    assert.equal((await database.query<{ completed_attribution_backfilled: boolean }>(
      "SELECT completed_attribution_backfilled FROM workspace WHERE id=1",
    )).rows[0].completed_attribution_backfilled, false);

    await database.exec("DROP TRIGGER fail_attribution ON completed_issue_attribution; DROP FUNCTION fail_attribution_insert() ");
    await saveImport(client, importInput([project("ongoing", "Ongoing")], oldIssues), new Date("2026-11-01T00:00:00Z"));
    assert.equal((await database.query("SELECT issue_id FROM completed_issue_attribution")).rows.length, 101);
  } finally { await database.close(); }
});

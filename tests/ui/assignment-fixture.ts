import { test as base, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { schemaSql } from "../../src/lib/db";
import { getBoard } from "../../src/lib/board";
import { saveImport } from "../../src/lib/import";
import { placeProjects, requireSequenceToken } from "../../src/lib/sequence-store";
import { saveExtraScope, saveScopingWindow } from "../../src/lib/scope-store";
import { createScenario, listScenarios, saveScenario, activateScenario, publishScenario, compareScenarios } from "../../src/lib/scenarios";
import { HttpError } from "../../src/lib/security";
import { saveHolidayPreset, saveWeeklyAvailability } from "../../src/lib/weekly-capacity-store";
import { addStream, listStreams } from "../../src/lib/streams";
import { assignOutcomeToStream, replaceOutcomeLinks, transferProjectOwnership } from "../../src/lib/outcome-ownership";

type Controls = { board: () => ReturnType<typeof getBoard>; time: (value: string) => void; invalidateNextMove: () => void; addSourceConflict: () => Promise<void>;
  setDemand: (projectId: string, points: number | null) => Promise<void>; requireProject: (projectId: string) => Promise<void>; pauseUnassigned: () => Promise<void>;
  configureCycles: (options: { visibleOffset?: number; importedCount?: number; enabled?: boolean }) => Promise<void>;
  shareProjects: () => Promise<void>; changeOwner: (outcomeId: string) => Promise<void> };
export const test = base.extend<{ assignment: Controls }>({
  assignment: async ({ page }, use) => {
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.stack || error.message));
    const database = new PGlite();
    const client = database as unknown as PoolClient;
    let evaluatedAt = new Date("2026-11-05T23:59:59Z");
    let invalidateNextMove = false;
    const board = () => getBoard(client, undefined, evaluatedAt);
    try {
      await database.exec(schemaSql);
      await database.query("INSERT INTO workspace(id) VALUES(1)");
      await database.query("INSERT INTO stream(id,name,position,allocation) VALUES('core','Core',1,0.5),('delivery','Delivery',2,0.5)");
      const seenAt = new Date("2026-10-20T12:00:00Z");
      await saveImport(client, { encryptedKey: "test", viewer: { id: "owner", name: "Owner" }, team: { id: "team", name: "Product" },
        projects: [
          { id: "a", name: "API foundation", status: "started", priority: 3, dependencies: ["c"], points: 5 },
          { id: "b", name: "Web experience", status: "planned", priority: 1, dependencies: [], points: 3 },
          { id: "c", name: "Rollout", status: "planned", priority: 2, dependencies: [], points: 2 },
          { id: "d", name: "Discovery", status: "planned", priority: 0, dependencies: [], points: null },
        ].map((project) => ({ ...project, teamId: "team", description: "", url: `https://linear.app/${project.id}`, updatedAt: seenAt, crossTeam: false,
          issues: [{ id: `issue-${project.id}`, projectId: project.id, teamId: "team", identifier: `T-${project.id}`, title: "Work", estimate: project.points, stateType: "started", updatedAt: seenAt, completedAt: null }] })),
        cycles: Array.from({ length: 8 }, (_, index) => ({ id: `cycle-${index}`, teamId: "team", number: index + 1, name: null,
          startsAt: new Date(Date.UTC(2026, 10, 20 + index * 7)), endsAt: new Date(Date.UTC(2026, 10, 27 + index * 7)), cycleDays: 7, completedAt: null, completedPoints: null })),
        cycleSettings: { timezone: "UTC", cyclesEnabled: true, cycleDuration: 1, cycleStartDay: 5, cycleCooldownTime: 0, upcomingCycleCount: 8 },
      }, seenAt);
      await database.query("INSERT INTO capacity_profile(workspace_id,baseline,baseline_reason) VALUES(1,20,'Fixture delivery')");
      await placeProjects(client, [{ packageId: "linear:a", streamId: "core", selected: true }, { packageId: "linear:b", streamId: "core", selected: true }, { packageId: "linear:c", streamId: "delivery", selected: true }]);
      await database.query("INSERT INTO outcome(id,title,needed_by,stream_id) VALUES('00000000-0000-4000-8000-000000000001','Launch','2027-01-31','delivery')");
      await database.query("INSERT INTO outcome_project_link(outcome_id,project_id) VALUES('00000000-0000-4000-8000-000000000001','c')");
      await database.query("UPDATE work_package SET capacity_outcome_id='00000000-0000-4000-8000-000000000001' WHERE project_id='c'");
      await page.route("**/api/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;
        const body = request.method() === "GET" ? {} : request.postDataJSON();
        try {
          let json: unknown;
          if (path === "/api/session") json = { authenticated: true };
          else if (path === "/api/board") {
            if (request.method() === "PUT") {
              if (body.type === "package") {
                if (invalidateNextMove) { invalidateNextMove = false; await placeProjects(client, [{ packageId: "linear:b", streamId: "core", selected: true, beforeId: "linear:a" }]); }
                await requireSequenceToken(client, body.sequenceToken);
                await placeProjects(client, [{ packageId: body.id, streamId: body.streamId, selected: body.selected, beforeId: body.beforeId }]);
                if (body.reason !== undefined) await database.query("UPDATE work_package SET pause_reason=$2 WHERE id=$1", [body.id, body.reason]);
              } else if (body.type === "extraScope") await saveExtraScope(client, body);
              else if (body.type === "ownership") await transferProjectOwnership(client, body);
              else if (body.type === "outcomeAssignment") await assignOutcomeToStream(client, body);
              else if (body.type === "scoping") await saveScopingWindow(client, body.leadDays);
              else if (body.type === "weeklyAvailability") await saveWeeklyAvailability(client, body);
              else if (body.type === "holidayPreset") await saveHolidayPreset(client, body.enabled);
              else throw new Error(`Unmocked board mutation ${body.type}`);
            }
            json = await board();
          } else if (path === "/api/state") {
            const current = await board();
            json = { connection: { viewer_name: "Owner", team_id: "team", team_name: "Product", last_imported_at: seenAt.toISOString() },
              projects: current.packages.map((item) => ({ ...item, id: item.project_id, package_id: item.id, description: "", issue_count: 1,
                unestimated_open_issues: item.project_id === "d" ? 1 : 0, estimated_open_points: 5 })), outcomes: current.outcomes, links: current.links, streams: current.streams };
          } else if (path === "/api/streams") json = request.method() === "POST" ? await addStream(body, client) : await listStreams(client);
          else if (path === "/api/outcomes" && request.method() === "POST") {
            const id = randomUUID();
            await database.query("INSERT INTO outcome(id,title,description,owner,success_signal,needed_by) VALUES($1,$2,$3,$4,$5,$6)",
              [id, body.title, body.description, body.owner, body.successSignal, body.neededBy || null]);
            for (const link of body.links || []) await database.query("INSERT INTO outcome_project_link(outcome_id,project_id,requirement) VALUES($1,$2,$3)", [id, link.projectId, link.requirement]);
            json = { id };
          } else if (path.startsWith("/api/outcomes/")) {
            const id = path.split("/")[3];
            if (path.endsWith("/links") && request.method() === "PUT") {
              await replaceOutcomeLinks(client, id, body.links);
            } else if (request.method() === "PUT") {
              await database.query("UPDATE outcome SET title=$2,description=$3,owner=$4,success_signal=$5,needed_by=$6 WHERE id=$1",
                [id, body.title, body.description, body.owner, body.successSignal, body.neededBy || null]);
            } else if (request.method() === "DELETE") await database.query("DELETE FROM outcome WHERE id=$1", [id]);
            else throw new Error(`Unmocked outcome route ${path}`);
            json = { saved: true };
          }
          else if (path === "/api/scenarios/compare") {
            const parse = (value: string) => { const [kind, id] = value.split(":"); return { kind: kind as "draft" | "revision", id }; };
            json = await compareScenarios(parse(url.searchParams.get("left")!), parse(url.searchParams.get("right")!), client);
          } else if (path === "/api/scenarios") json = request.method() === "POST" ? { scenario: await createScenario(body, client) } : await listScenarios(client);
          else if (/\/api\/scenarios\/[^/]+/.test(path)) {
            const id = path.split("/")[3];
            if (path.endsWith("/activate")) json = await activateScenario(id, body, client);
            else if (path.endsWith("/publish")) json = await publishScenario(id, body, client);
            else if (request.method() === "PUT") json = await saveScenario(id, body, client);
            else throw new Error(`Unmocked scenario route ${path}`);
          } else return route.fulfill({ status: 404, json: { error: `Unmocked ${path}` } });
          await route.fulfill({ json });
        } catch (error) {
          await route.fulfill({ status: error instanceof HttpError ? error.status : 500, json: { error: error instanceof Error ? error.message : String(error) } });
        }
      });
      await use({ board, time: (value) => { evaluatedAt = new Date(value); }, invalidateNextMove: () => { invalidateNextMove = true; },
        addSourceConflict: async () => { await database.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('linear:b','linear:a','linear')"); },
        setDemand: async (projectId, points) => { await database.query("UPDATE linear_issue_cache SET estimate=$2 WHERE project_id=$1", [projectId, points]); },
        requireProject: async (projectId) => {
          await database.query("DELETE FROM outcome_project_link");
          await database.query("INSERT INTO outcome_project_link(outcome_id,project_id) VALUES('00000000-0000-4000-8000-000000000001',$1)", [projectId]);
        },
        pauseUnassigned: () => placeProjects(client, [{ packageId: "linear:d", streamId: null, selected: false }]),
        changeOwner: async (outcomeId) => { const current = await board(); await transferProjectOwnership(client, { packageId: "linear:a", outcomeId, sequenceToken: current.sequenceToken, ownershipToken: current.ownershipToken }); },
        shareProjects: async () => {
          await database.query("UPDATE stream SET wip_limit=2 WHERE id='core'");
          await database.query("INSERT INTO outcome(id,title,stream_id) VALUES('00000000-0000-4000-8000-000000000002','Foundation','core'),('00000000-0000-4000-8000-000000000003','Retention','core'),('00000000-0000-4000-8000-000000000004','Empty outcome','delivery')");
          await replaceOutcomeLinks(client, '00000000-0000-4000-8000-000000000002', [{ projectId: 'a', requirement: 'minimum' }, { projectId: 'b', requirement: 'optional' }]);
          await replaceOutcomeLinks(client, '00000000-0000-4000-8000-000000000003', [{ projectId: 'a', requirement: 'minimum' }]);
          await replaceOutcomeLinks(client, '00000000-0000-4000-8000-000000000001', [{ projectId: 'a', requirement: 'minimum' }, { projectId: 'c', requirement: 'minimum' }]);
          await database.query("UPDATE work_package SET capacity_outcome_id='00000000-0000-4000-8000-000000000002' WHERE project_id IN ('a','b')");
          await database.query("UPDATE linear_project_cache SET description='The API foundation scope imported from Linear.' WHERE linear_id='a'");
        },
        configureCycles: async (options) => {
          if (options.visibleOffset !== undefined) await database.query("UPDATE linear_cycle_cache SET name='Cycle ' || (number+$1)::text", [options.visibleOffset]);
          if (options.importedCount !== undefined) await database.query("UPDATE linear_cycle_cache SET active=(number<=$1)", [options.importedCount]);
          if (options.enabled !== undefined) await database.query("UPDATE linear_connection SET cycles_enabled=$1", [options.enabled]);
        } });
      expect(browserErrors).toEqual([]);
    } finally { await database.close(); }
  },
});
export { expect };

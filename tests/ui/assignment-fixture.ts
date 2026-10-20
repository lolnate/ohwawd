import { test as base, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { schemaSql } from "../../src/lib/db";
import { getBoard } from "../../src/lib/board";
import { saveImport } from "../../src/lib/import";
import { placeProjects, requireSequenceToken } from "../../src/lib/sequence-store";
import { saveExtraScope, saveScopingWindow } from "../../src/lib/scope-store";
import { createScenario, listScenarios, saveScenario, activateScenario, publishScenario, compareScenarios } from "../../src/lib/scenarios";
import { HttpError } from "../../src/lib/security";
import { saveHolidayPreset, saveWeeklyAvailability } from "../../src/lib/weekly-capacity-store";

type Controls = { board: () => ReturnType<typeof getBoard>; time: (value: string) => void; invalidateNextMove: () => void; addSourceConflict: () => Promise<void>;
  setDemand: (projectId: string, points: number) => Promise<void> };
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
      await database.query("INSERT INTO outcome(id,title,needed_by) VALUES('00000000-0000-4000-8000-000000000001','Launch','2027-01-31')");
      await database.query("INSERT INTO outcome_project_link(outcome_id,project_id) VALUES('00000000-0000-4000-8000-000000000001','c')");
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
          } else if (path === "/api/streams") json = { streams: (await board()).streams.map((stream) => ({ ...stream, active: true, package_count: 1 })), activeScenario: null, events: [] };
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
        setDemand: async (projectId, points) => { await database.query("UPDATE linear_issue_cache SET estimate=$2 WHERE project_id=$1", [projectId, points]); } });
      expect(browserErrors).toEqual([]);
    } finally { await database.close(); }
  },
});
export { expect };

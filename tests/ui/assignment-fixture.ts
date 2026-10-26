import { test as base, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { schemaSql } from "../../src/lib/db";
import { getBoard, assignPackagesToStream } from "../../src/lib/board";
import { saveImport } from "../../src/lib/import";
import { placeProjects, requireSequenceToken } from "../../src/lib/sequence-store";
import { saveExtraScope, saveScopingWindow } from "../../src/lib/scope-store";
import { createScenario, listScenarios, saveScenario, activateScenario, publishScenario, compareScenarios } from "../../src/lib/scenarios";
import { HttpError } from "../../src/lib/security";
import { saveHolidayPreset, saveWeeklyAvailability } from "../../src/lib/weekly-capacity-store";
import { addStream, listStreams } from "../../src/lib/streams";
import { assignOutcomeToStream, replaceOutcomeLinks, transferProjectOwnership } from "../../src/lib/outcome-ownership";
import { saveCapacityProfile } from "../../src/lib/capacity-store";
import { deleteOutcome, changeRoadmapMembership } from "../../src/lib/roadmap-mutations";
import { requirePlanningToken } from "../../src/lib/planning-token";
import { activateRoadmapPlanning } from "../../src/lib/roadmap-store";
import { saveOutcomeCompletion, reconcileOutcomeCompletions } from "../../src/lib/outcome-lifecycle";
import { saveDependency } from "../../src/lib/dependency-store";

type Controls = { board: () => ReturnType<typeof getBoard>; time: (value: string) => void; invalidateNextMove: () => void; addSourceConflict: () => Promise<void>;
  seedDerivedChain: () => Promise<void>;
  seedOptionalDerived: () => Promise<void>;
  activateRoadmap: () => Promise<void>;
  setProjectCompleted: (projectId: string, completed: boolean) => Promise<void>;
  moveOutcome: (outcomeId: string, streamId: string, beforeOutcomeId?: string) => Promise<void>;
  changeMembership: (projectId: string, action: string, outcomeId?: string) => Promise<void>;
  seedLegacyScenario: () => Promise<string>;
  seedOutcomeBoard: () => Promise<void>;
  seedManyBoardOutcomes: (count: number) => Promise<string>;
  setDemand: (projectId: string, points: number | null) => Promise<void>; requireProject: (projectId: string) => Promise<void>; pauseUnassigned: () => Promise<void>;
  configureCycles: (options: { visibleOffset?: number; importedCount?: number; enabled?: boolean }) => Promise<void>;
  shareProjects: () => Promise<void>; changeOwner: (outcomeId: string) => Promise<void>;
  seedCatalog: () => Promise<void>; clearCatalogOwner: () => Promise<void>;
  seedDeliveryPrimary: () => Promise<void>;
  setCapacity: (baseline: number | null, coreAllocation?: number) => Promise<void>;
  setRemainingScope: (projectId: string, points: number | null) => Promise<void>; setHolidaysEnabled: (enabled: boolean) => Promise<void>;
   setWeekAvailability: (weekStart: string, availability: number) => Promise<void>;
   observeCapacity: () => Promise<void>; setCycleAvailability: (availability: number) => Promise<void>;
   setExtraScope: (projectId: string, points: number) => Promise<void> };
export const test = base.extend<{ assignment: Controls }>({
  assignment: async ({ page }, use) => {
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.stack || error.message));
    const database = new PGlite();
    const client = database as unknown as PoolClient;
    let evaluatedAt = new Date("2026-11-05T23:59:59Z");
    let invalidateNextMove = false;
    const board = () => getBoard(client, undefined, evaluatedAt);
    async function outcomeWrite<T>(write: () => Promise<T>) {
      await database.query("BEGIN");
      try { const result = await write(); await database.query("COMMIT"); return result; }
      catch (error) { await database.query("ROLLBACK"); throw error; }
    }
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
            let affectedCandidates: { id: string; name: string }[] = [];
            if (request.method() === "PUT") {
              if (body.type === "package" && invalidateNextMove) { invalidateNextMove = false; await outcomeWrite(() => placeProjects(client, [{ packageId: "linear:b", streamId: "core", selected: true, beforeId: "linear:a" }])); }
              await outcomeWrite(async () => {
              if (body.type === "package") {
                await requireSequenceToken(client, body.sequenceToken);
                await placeProjects(client, [{ packageId: body.id, streamId: body.streamId, selected: body.selected, beforeId: body.beforeId, outcomeId: body.outcomeId }]);
                if (body.reason !== undefined) await database.query("UPDATE work_package SET pause_reason=$2 WHERE id=$1", [body.id, body.reason]);
              } else if (body.type === "extraScope") await saveExtraScope(client, body);
              else if (body.type === "ownership") await transferProjectOwnership(client, body);
              else if (body.type === "outcomeAssignment") { const result = await assignOutcomeToStream(client, body); affectedCandidates = result?.affectedCandidates ?? []; }
              else if (body.type === "roadmapMembership") await changeRoadmapMembership(client, body);
              else if (body.type === "assignment") { await requireSequenceToken(client, body.sequenceToken); await assignPackagesToStream(client, body.streamId, body.packageIds, body.outcomeId); }
              else if (body.type === "dependency") await saveDependency(client, body);
               else if (body.type === "capacity") await saveCapacityProfile(client, body);
               else if (body.type === "scoping") await saveScopingWindow(client, body.leadDays);
              else if (body.type === "weeklyAvailability") await saveWeeklyAvailability(client, body);
              else if (body.type === "holidayPreset") await saveHolidayPreset(client, body.enabled);
              else throw new Error(`Unmocked board mutation ${body.type}`);
              });
            }
            json = { ...await board(), affectedCandidates };
          } else if (path === "/api/state") {
            const current = await board();
            json = { connection: { viewer_name: "Owner", team_id: "team", team_name: "Product", last_imported_at: seenAt.toISOString() },
              projects: current.packages.map((item) => ({ ...item, id: item.project_id, package_id: item.id, description: "", issue_count: 1,
                unestimated_open_issues: item.project_id === "d" ? 1 : 0, estimated_open_points: 5 })), outcomes: current.outcomes, links: current.links, streams: current.streams, timezone: current.timezone, planningToken: current.planningToken, roadmapPlanningMigrated: current.roadmapPlanningMigrated, roadmapConversionFeedback: current.roadmapConversionFeedback };
          } else if (/^\/api\/projects\/[^/]+\/scope$/.test(path)) { await database.query("UPDATE linear_project_cache SET in_scope=$2 WHERE linear_id=$1", [decodeURIComponent(path.split("/")[3]), body.inScope]); json = { saved: true }; }
          else if (path === "/api/projects/scope") { await database.query("UPDATE linear_project_cache SET in_scope=$2 WHERE linear_id=ANY($1::text[])", [body.projectIds, body.inScope]); json = { saved: true }; }
          else if (path === "/api/streams") json = request.method() === "POST" ? await addStream(body, client) : await listStreams(client);
          else if (path === "/api/outcomes" && request.method() === "POST") {
            const id = randomUUID();
            await database.query("INSERT INTO outcome(id,title,description,owner,success_signal,needed_by) VALUES($1,$2,$3,$4,$5,$6)",
              [id, body.title, body.description, body.owner, body.successSignal, body.neededBy || null]);
            for (const link of body.links || []) await database.query("INSERT INTO outcome_project_link(outcome_id,project_id,requirement) VALUES($1,$2,$3)", [id, link.projectId, link.requirement]);
            const accepted = await board();
            json = { id, planningToken: accepted.planningToken, lifecycle: accepted.outcomes.find((item) => item.id === id)?.lifecycle };
          } else if (path.startsWith("/api/outcomes/")) {
            const id = path.split("/")[3];
            if (path.endsWith("/completion") && request.method() === "PUT") {
              json = await outcomeWrite(() => saveOutcomeCompletion(client, id, body));
            } else if (path.endsWith("/links") && request.method() === "PUT") {
              json = await outcomeWrite(async () => { await requirePlanningToken(client, body.planningToken); return replaceOutcomeLinks(client, id, body.links); });
            } else if (request.method() === "PUT") {
              await database.query("UPDATE outcome SET title=$2,description=$3,owner=$4,success_signal=$5,needed_by=$6 WHERE id=$1",
                [id, body.title, body.description, body.owner, body.successSignal, body.neededBy || null]);
            } else if (request.method() === "DELETE") json = await outcomeWrite(() => deleteOutcome(client, id, body.planningToken));
            else throw new Error(`Unmocked outcome route ${path}`);
            json ??= { saved: true };
          }
          else if (path === "/api/scenarios/compare") {
            const parse = (value: string) => { const [kind, id] = value.split(":"); return { kind: kind as "draft" | "revision", id }; };
            json = await compareScenarios(parse(url.searchParams.get("left")!), parse(url.searchParams.get("right")!), client);
          } else if (path === "/api/scenarios") json = request.method() === "POST" ? { scenario: await createScenario(body, client) } : await listScenarios(client);
          else if (/\/api\/scenarios\/[^/]+/.test(path)) {
            const id = path.split("/")[3];
            if (path.endsWith("/activate")) json = { scenario: await outcomeWrite(() => activateScenario(id, body, client)) };
            else if (path.endsWith("/publish")) json = await publishScenario(id, body, client);
            else if (request.method() === "PUT") json = await saveScenario(id, body, client);
            else throw new Error(`Unmocked scenario route ${path}`);
          } else return route.fulfill({ status: 404, json: { error: `Unmocked ${path}` } });
          await route.fulfill({ json });
        } catch (error) {
          await route.fulfill({ status: error instanceof HttpError ? error.status : 500, json: { error: error instanceof Error ? error.message : String(error), ...(error instanceof HttpError ? error.details : {}) } });
        }
      });
      await use({ board, time: (value) => { evaluatedAt = new Date(value); }, invalidateNextMove: () => { invalidateNextMove = true; },
        activateRoadmap: async () => { await outcomeWrite(() => activateRoadmapPlanning(client)); },
        seedOutcomeBoard: async () => {
          await database.query("UPDATE stream SET allocation=CASE WHEN id='core' THEN 1 ELSE 0 END");
          await database.query("UPDATE capacity_profile SET baseline=10,holidays_enabled=false WHERE workspace_id=1");
          await database.query(`UPDATE outcome SET stream_id='core',created_at=CASE id
            WHEN '00000000-0000-4000-8000-000000000001' THEN '2026-10-24T00:00:00Z'::timestamptz
            WHEN '00000000-0000-4000-8000-000000000003' THEN '2026-10-23T00:00:00Z'::timestamptz
            ELSE '2026-10-22T00:00:00Z'::timestamptz END
            WHERE id IN ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003')`);
          await database.query("INSERT INTO outcome_project_link(outcome_id,project_id,requirement) VALUES('00000000-0000-4000-8000-000000000003','b','minimum') ON CONFLICT(outcome_id,project_id) DO UPDATE SET requirement='minimum'");
          await database.query("UPDATE work_package SET capacity_outcome_id='00000000-0000-4000-8000-000000000003',sequence_position=1 WHERE project_id='b'");
          await database.query("UPDATE work_package SET stream_id='core',sequence_position=1 WHERE project_id='c'");
        },
        seedManyBoardOutcomes: async (count) => {
          const start = Number((await database.query<{ count: number }>("SELECT COUNT(*)::integer AS count FROM outcome WHERE stream_id='core'")).rows[0].count);
          let last = "";
          for (let index = 0; index < count; index++) { last = randomUUID(); await database.query("INSERT INTO outcome(id,title,stream_id,stream_position) VALUES($1,$2,'core',$3)", [last, `Outcome ${index + 1} · ${"Long outcome definition for keyboard and narrow-screen planning ".repeat(4)}`.slice(0, 197), start + index + 1]); }
          return last;
        },
        moveOutcome: async (outcomeId, streamId, beforeOutcomeId) => { const current = await board(); await outcomeWrite(() => assignOutcomeToStream(client, { outcomeId, streamId, beforeOutcomeId, sequenceToken: current.sequenceToken, ownershipToken: current.ownershipToken })); },
        changeMembership: async (projectId, action, outcomeId) => { const current = await board(); await outcomeWrite(() => changeRoadmapMembership(client, { packageId: `linear:${projectId}`, action, outcomeId, sequenceToken: current.sequenceToken, planningToken: current.planningToken })); },
        seedLegacyScenario: async () => {
          const current = JSON.parse(JSON.stringify(await board())); current.calculationVersion = "v4";
          for (const item of current.packages) { delete item.roadmap_state; delete item.roadmap_conversion; if (item.project_id === "a") delete item.capacity_outcome_id; }
          for (const item of current.outcomes) { delete item.stream_position; delete item.lifecycle; }
          const id = randomUUID();
          await database.query("INSERT INTO scenario(id,workspace_id,name,draft_source_at,draft_source_snapshot,draft_snapshot) VALUES($1,1,'Legacy option',$2,'{}',$3::jsonb)", [id, current.forecast.sourceAt, JSON.stringify(current)]);
          await database.query(`INSERT INTO scenario_revision(id,scenario_id,revision_number,draft_edit_version,calculation_version,source_at,source_snapshot,snapshot,rationale,author)
            VALUES($1,$2,1,1,'v4',$3,'{}',$4::jsonb,'Historical option','Owner')`, [randomUUID(), id, current.forecast.sourceAt, JSON.stringify(current)]);
          return id;
        },
        setProjectCompleted: async (projectId, completed) => { await outcomeWrite(async () => {
          await database.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
          await database.query("UPDATE linear_project_cache SET status=$2 WHERE linear_id=$1", [projectId, completed ? "completed" : "started"]);
          await database.query("UPDATE linear_issue_cache SET state_type=$2 WHERE project_id=$1", [projectId, completed ? "completed" : "started"]);
          await reconcileOutcomeCompletions(client, "Linear sync");
        }); },
        addSourceConflict: async () => { await database.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('linear:b','linear:a','linear')"); },
        seedDerivedChain: async () => {
          await database.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('linear:b','linear:a','local')");
          await database.query("UPDATE work_package SET sequence_position=CASE project_id WHEN 'b' THEN 1 WHEN 'a' THEN 2 ELSE sequence_position END WHERE project_id IN ('a','b')");
          await database.query("INSERT INTO outcome_project_link(outcome_id,project_id,requirement) VALUES('00000000-0000-4000-8000-000000000001','b','optional')");
        },
        seedOptionalDerived: async () => { await database.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('linear:d','linear:b','local')"); },
        setDemand: async (projectId, points) => { await database.query("UPDATE linear_issue_cache SET estimate=$2 WHERE project_id=$1", [projectId, points]); },
        setCapacity: async (baseline, coreAllocation = 0.5) => {
          await database.query("UPDATE capacity_profile SET baseline=$1 WHERE workspace_id=1", [baseline]);
          await database.query("UPDATE stream SET allocation=CASE WHEN id='core' THEN $1::numeric ELSE 1-$1::numeric END", [coreAllocation]);
        },
         setRemainingScope: async (projectId, points) => { await database.query("UPDATE linear_project_cache SET remaining_scope=$2 WHERE linear_id=$1", [projectId, points]); },
         setHolidaysEnabled: async (enabled) => { await database.query("UPDATE capacity_profile SET holidays_enabled=$1 WHERE workspace_id=1", [enabled]); },
         setWeekAvailability: (weekStart, availability) => saveWeeklyAvailability(client, { weekStart, availability }),
         observeCapacity: async () => {
           for (const [index, points] of [18, 20, 22].entries()) await database.query("INSERT INTO cycle_observation(linear_id,team_id,starts_at,ends_at,completed_at,cycle_days,completed_points) VALUES($1,'team','2026-10-01','2026-10-08','2026-10-08',7,$2)", [`observed-${index}`, points]);
         },
         setCycleAvailability: async (availability) => { await database.query("INSERT INTO linear_cycle_adjustment(linear_cycle_id,availability) SELECT linear_id,$1 FROM linear_cycle_cache ON CONFLICT(linear_cycle_id) DO UPDATE SET availability=$1", [availability]); },
         setExtraScope: (projectId, points) => saveExtraScope(client, { packageId: `linear:${projectId}`, points, notes: "" }),
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
        seedCatalog: async () => {
          await database.query("UPDATE linear_connection SET team_timezone='America/Los_Angeles'");
          await database.query("UPDATE linear_project_cache SET in_scope=false WHERE linear_id='b'");
          for (let index = 1; index <= 50; index++) {
            await database.query("INSERT INTO outcome(id,title,owner,stream_id,created_at) VALUES($1,$2,$3,$4,$5)",
              [randomUUID(), `Catalog outcome ${String(index).padStart(2, '0')}`, index % 2 ? 'Product' : '', index % 2 ? 'core' : null, `2026-10-${String(1 + index % 20).padStart(2, '0')}T12:00:00Z`]);
          }
          await database.query("INSERT INTO outcome(id,title,description,owner,success_signal,stream_id,needed_by,created_at) VALUES('00000000-0000-4000-8000-000000000010','Catalog launch','Migrate customers safely',' Engineering ','Adoption','core','2026-11-06','2026-10-23T12:00:00Z')");
          await database.query("INSERT INTO outcome(id,title,owner,needed_by,created_at) VALUES($1,'Owner All','All','2026-11-05','2026-10-22'),($2,'Owner None','None',null,'2026-10-21'),($3,$4,'engineering',null,'2026-10-20')", [randomUUID(), randomUUID(), randomUUID(), 'Z '.repeat(99).trim()]);
          await database.query("INSERT INTO outcome_project_link(outcome_id,project_id,requirement) VALUES('00000000-0000-4000-8000-000000000010','a','optional'),('00000000-0000-4000-8000-000000000010','b','optional')");
        },
        clearCatalogOwner: async () => { await database.query("UPDATE outcome SET owner='' WHERE lower(trim(owner))='engineering'"); },
        seedDeliveryPrimary: async () => {
          // Independent local work follows Rollout, concurrently with Core's dependent API work.
          await database.query("UPDATE linear_issue_cache SET estimate=8 WHERE project_id='d'");
          await placeProjects(client, [{ packageId: "linear:d", streamId: "delivery", selected: true }]);
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

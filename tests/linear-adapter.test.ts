import assert from "node:assert/strict";
import { test } from "node:test";
import { createLinearRequestCounter, mergeLinearTeamIssueEvidence, readLinearProjectLabels, readLinearProjects, readLinearTeamIssues } from "../src/lib/linear";

function paged<T>(pages: T[][]) {
  let pageIndex = 0;
  let fetches = 0;
  const connection = {
    nodes: [...(pages[0] ?? [])],
    pageInfo: { hasNextPage: pages.length > 1 },
    async fetchNext() {
      fetches += 1;
      pageIndex += 1;
      connection.nodes.push(...(pages[pageIndex] ?? []));
      connection.pageInfo.hasNextPage = pageIndex < pages.length - 1;
      return connection;
    },
  };
  return { connection, fetches: () => fetches };
}

test("Linear project labels retain exact IDs and names across pages", async () => {
  const source = paged([
    [{ id: "roadmap", name: "Roadmap" }, { id: "similar", name: "Roadmap candidate" }],
    [{ id: "ongoing", name: "Ongoing" }, { id: "duplicate-name", name: "Roadmap" }],
  ]);

  assert.deepEqual(await readLinearProjectLabels(async () => source.connection), [
    { id: "roadmap", name: "Roadmap" },
    { id: "similar", name: "Roadmap candidate" },
    { id: "ongoing", name: "Ongoing" },
    { id: "duplicate-name", name: "Roadmap" },
  ]);
  assert.equal(source.fetches(), 1);
});

test("Linear team issues paginate unattached work and preserve canonical blocker direction", async () => {
  const relation = (type: string, archivedAt: string | null = null) => ({
    type, archivedAt, issue: { id: "issue-a" }, relatedIssue: { id: "issue-b" },
  });
  const rawIssue = (index: number, extra: Record<string, unknown> = {}) => ({
    id: `issue-${index}`, identifier: `ENG-${String(index).padStart(2, "0")}`, title: `Issue ${index}`,
    url: `https://linear.app/issue/ENG-${index}`, estimate: 1, completedAt: null, updatedAt: "2026-10-21T18:00:00Z",
    project: { id: "project-a" }, team: { id: "team" }, state: { type: "unstarted" },
    inverseRelations: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }, ...extra,
  });
  const firstPage = Array.from({ length: 25 }, (_, index) => rawIssue(index + 1));
  firstPage[1] = rawIssue(2, {
    id: "issue-b",
    inverseRelations: { nodes: [relation("related")], pageInfo: { hasNextPage: true, endCursor: "relations-next" } },
  });
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  const requests = createLinearRequestCounter();
  const request = <Data, Variables extends Record<string, unknown>>(query: string, variables: Variables): Promise<{ data: Data }> => requests.attempt(async () => {
    calls.push({ query, variables });
    let data: unknown;
    if (query.includes("OhwawdIssueRelations")) {
      data = { issue: { inverseRelations: { nodes: [relation("blocks"), relation("blocks", "2026-10-01T00:00:00Z")], pageInfo: { hasNextPage: false, endCursor: null } } } };
    } else if (variables.after === "issues-next") {
      data = { team: { issues: { nodes: [rawIssue(26, {
        id: "unattached", identifier: "ENG-99", project: null, estimate: null, completedAt: "2026-10-20T18:00:00Z", state: { type: "completed" },
      })], pageInfo: { hasNextPage: false, endCursor: null } } } };
    } else {
      data = { team: { issues: { nodes: firstPage, pageInfo: { hasNextPage: true, endCursor: "issues-next" } } } };
    }
    return { data: data as Data };
  });

  const result = await readLinearTeamIssues("team", request);

  assert.equal(result.issues.length, 26);
  assert.deepEqual(result.issues.find((issue) => issue.id === "unattached"), {
    id: "unattached", projectId: null, teamId: "team", identifier: "ENG-99", title: "Issue 26",
    url: "https://linear.app/issue/ENG-26", estimate: null, stateType: "completed",
    completedAt: new Date("2026-10-20T18:00:00Z"), updatedAt: new Date("2026-10-21T18:00:00Z"),
  });
  assert.deepEqual(result.blockerEdges, [{ blockerId: "issue-a", blockedIssueId: "issue-b" }]);
  assert.equal(requests.count(), 3);
  assert.equal(calls.filter((call) => call.query.includes("OhwawdTeamIssues")).length, 2);
  assert.equal(calls.filter((call) => call.query.includes("OhwawdIssueRelations")).length, 1);
});

const emptyRawConnection = () => ({ nodes: [], pageInfo: { hasNextPage: false, endCursor: null } });
const rawProject = (index: number, extra: Record<string, unknown> = {}) => ({
  id: `project-${index}`, name: `Project ${String(index).padStart(2, "0")}`, description: null, state: "started",
  url: `https://linear.app/project/${index}`, updatedAt: "2026-10-21T18:00:00Z", priority: null,
  scope: 100, completedScopeHistory: [10],
  teams: { nodes: [{ id: "team" }], pageInfo: { hasNextPage: false, endCursor: null } },
  labels: emptyRawConnection(), relations: emptyRawConnection(), inverseRelations: emptyRawConnection(), ...extra,
});

test("Linear projects batch 84 records into four complete source pages", async () => {
  const source = Array.from({ length: 84 }, (_, index) => rawProject(index + 1));
  const calls: Record<string, unknown>[] = [];
  const request = async <Data, Variables extends Record<string, unknown>>(_query: string, variables: Variables): Promise<{ data: Data }> => {
    calls.push(variables);
    const page = variables.after === null ? 0 : Number(String(variables.after).replace("page-", ""));
    const start = page * 25;
    const hasNextPage = start + 25 < source.length;
    return { data: { team: { projects: {
      nodes: source.slice(start, start + 25), pageInfo: { hasNextPage, endCursor: hasNextPage ? `page-${page + 1}` : null },
    } } } as Data };
  };

  const projects = await readLinearProjects("team", request);

  assert.equal(projects.length, 84);
  assert.equal(calls.length, 4);
  assert.deepEqual(projects[0], {
    id: "project-1", teamId: "team", name: "Project 01", description: "", status: "started",
    url: "https://linear.app/project/1", updatedAt: new Date("2026-10-21T18:00:00Z"), priority: null,
    sourceScope: 100, completedScopeHistory: [10], completedIssuePoints: undefined, remainingScope: 90, crossTeam: false,
    issues: [], labels: [], dependencies: [], blockedBy: [],
  });

  const merged = mergeLinearTeamIssueEvidence(projects, { issues: [{
    id: "completed", projectId: "project-1", teamId: "team", identifier: "ENG-1", title: "Completed",
    url: "https://linear.app/issue/ENG-1", estimate: 30, stateType: "completed", completedAt: new Date(), updatedAt: new Date(),
  }], blockerEdges: [] });
  assert.equal(merged[0].remainingScope, 70);
  assert.equal(merged[0].crossTeam, false);
});

test("Linear project evidence requests only exceptional nested overflow", async () => {
  const relation = { type: "dependency", anchorType: "end", relatedAnchorType: "start", archivedAt: null,
    project: { id: "project-1" }, relatedProject: { id: "project-2" } };
  const project = rawProject(1, {
    labels: { nodes: [{ id: "label-1", name: "Roadmap" }], pageInfo: { hasNextPage: true, endCursor: "labels-next" } },
    relations: { nodes: [], pageInfo: { hasNextPage: true, endCursor: "relations-next" } },
  });
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  const request = async <Data, Variables extends Record<string, unknown>>(query: string, variables: Variables): Promise<{ data: Data }> => {
    calls.push({ query, variables });
    if (query.includes("OhwawdProjectEvidence") && variables.labelAfter === "labels-next") return { data: { project: {
      labels: { nodes: [{ id: "label-2", name: "Ongoing" }], pageInfo: { hasNextPage: true, endCursor: "labels-last" } },
      relations: { nodes: [relation], pageInfo: { hasNextPage: false, endCursor: null } },
    } } as Data };
    if (query.includes("OhwawdProjectEvidence")) return { data: { project: {
      labels: { nodes: [{ id: "label-3", name: "Roadmap candidate" }], pageInfo: { hasNextPage: false, endCursor: null } },
    } } as Data };
    return { data: { team: { projects: { nodes: [project], pageInfo: { hasNextPage: false, endCursor: null } } } } as Data };
  };

  const projects = await readLinearProjects("team", request);

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.slice(1).map((call) => call.variables), [{
    id: "project-1", labelAfter: "labels-next", relationAfter: "relations-next", inverseAfter: null,
    loadLabels: true, loadRelations: true, loadInverse: false,
  }, {
    id: "project-1", labelAfter: "labels-last", relationAfter: null, inverseAfter: null,
    loadLabels: true, loadRelations: false, loadInverse: false,
  }]);
  assert.deepEqual(projects[0].labels, [
    { id: "label-1", name: "Roadmap" }, { id: "label-2", name: "Ongoing" }, { id: "label-3", name: "Roadmap candidate" },
  ]);
  assert.deepEqual(projects[0].dependencies, ["project-2"]);
});

test("cross-team projects fetch complete issue points as a bounded exception", async () => {
  const project = rawProject(1, {
    teams: { nodes: [{ id: "team" }, { id: "other-team" }], pageInfo: { hasNextPage: false, endCursor: null } },
  });
  const calls: { query: string; after: unknown }[] = [];
  const request = async <Data, Variables extends Record<string, unknown>>(query: string, variables: Variables): Promise<{ data: Data }> => {
    calls.push({ query, after: variables.after });
    if (query.includes("OhwawdProjectIssues")) {
      const first = variables.after === null;
      return { data: { project: { issues: {
        nodes: first
          ? [{ estimate: 20, state: { type: "completed" } }, { estimate: 50, state: { type: "started" } }]
          : [{ estimate: 10, state: { type: "canceled" } }],
        pageInfo: { hasNextPage: first, endCursor: first ? "issues-next" : null },
      } } } as Data };
    }
    return { data: { team: { projects: { nodes: [project], pageInfo: { hasNextPage: false, endCursor: null } } } } as Data };
  };

  const projects = await readLinearProjects("team", request);

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.after), [null, null, "issues-next"]);
  assert.equal(projects[0].crossTeam, true);
  assert.equal(projects[0].completedIssuePoints, 30);
  assert.equal(projects[0].remainingScope, 70);
});

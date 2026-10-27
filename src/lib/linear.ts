import { LinearClient, LinearError, LinearErrorType, type Connection, type LinearRawResponse } from "@linear/sdk";
import { HttpError, responseError } from "./security";

export type ImportedIssue = {
  id: string; projectId: string; teamId: string; identifier: string; title: string;
  estimate: number | null; stateType: string; completedAt: Date | null; updatedAt: Date;
};
export type ImportedProject = {
  id: string; teamId: string; name: string; description: string; status: string; url: string;
  updatedAt: Date; crossTeam: boolean; priority?: number | null; remainingScope?: number | null; issues: ImportedIssue[]; dependencies?: string[]; blockedBy?: string[];
};
export type ImportedCycle = { id: string; teamId: string; number: number; name: string | null; startsAt: Date; endsAt: Date; completedAt: Date | null; cycleDays: number; completedPoints: number | null };
export type LinearCycleSettings = { timezone: string; cyclesEnabled: boolean; cycleDuration: number; cycleStartDay: number; cycleCooldownTime: number; upcomingCycleCount: number };
export type LinearTeam = { id: string; name: string; key: string };
export type ProjectPreview = { id: string; name: string; status: string };

type ProjectRelation = { type: string; anchorType?: string; relatedAnchorType?: string; projectId?: string; relatedProjectId?: string; archivedAt?: Date | null };

/** Linear project dependencies use end/start anchors, unlike issue "blocks" relations. */
export function linearProjectDependencies(relations: ProjectRelation[]): { predecessorId: string; successorId: string }[] {
  const edges = new Map<string, { predecessorId: string; successorId: string }>();
  for (const relation of relations) {
    if (relation.archivedAt || !relation.projectId || !relation.relatedProjectId || relation.projectId === relation.relatedProjectId) continue;
    const finishToStart = relation.type === "dependency" && relation.anchorType === "end" && relation.relatedAnchorType === "start";
    if (!finishToStart && relation.type !== "blocks") continue;
    const edge = { predecessorId: relation.projectId, successorId: relation.relatedProjectId };
    edges.set(`${edge.predecessorId}:${edge.successorId}`, edge);
  }
  return [...edges.values()];
}

type ProjectDetailsResponse = {
  project: {
    scope: number; completedScopeHistory: number[];
    teams: { nodes: { id: string }[]; pageInfo: { hasNextPage: boolean } };
    issues: {
      nodes: {
        id: string; identifier: string; title: string; estimate: number | null;
        updatedAt: string; completedAt: string | null;
        team: { id: string } | null; state: { type: string } | null;
      }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
};

const projectDetailsQuery = `
  query OhwawdProjectDetails($id: String!, $after: String) {
    project(id: $id) {
      scope completedScopeHistory
      teams(first: 50) { nodes { id } pageInfo { hasNextPage } }
      issues(first: 50, after: $after) {
        nodes {
          id identifier title estimate updatedAt completedAt
          team { id }
          state { type }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export function linearReadError(error: unknown, action: string): Response {
  if (!(error instanceof LinearError)) return responseError(error);
  const detail = error.errors?.[0]?.message?.replace(/[\r\n\t]/g, " ").slice(0, 240);
  const message = error.type === LinearErrorType.Ratelimited
    ? "Linear's rate limit was reached. Try again shortly."
    : error.type === LinearErrorType.AuthenticationError || error.type === LinearErrorType.Forbidden
      ? "Linear denied access. Check the API key and its team permissions."
      : `Linear could not ${action}${detail ? `: ${detail}` : ` (${error.type || "unknown error"})`}.`;
  return Response.json({ error: message }, { status: error.type === LinearErrorType.Ratelimited ? 429 : 502 });
}

export function linearRemainingScope(scope: number, completedScopeHistory: number[], completedIssuePoints?: number): number | null {
  const completed = Math.max(completedScopeHistory.at(-1) ?? 0, completedIssuePoints ?? 0);
  return Number.isFinite(scope) && scope > 0 && Number.isFinite(completed) && completed >= 0 ? Math.max(0, scope - completed) : null;
}

// The adapter is read-only. The SDK rejects GraphQL responses containing errors,
// including HTTP 200 responses with partial data, before any cache write occurs.
export function createLinearSource(apiKey: string) {
  if (!apiKey.trim()) throw new HttpError(400, "Enter a Linear API key.");
  const client = new LinearClient({ apiKey: apiKey.trim() });

  async function all<T>(connection: Connection<T>): Promise<T[]> {
    while (connection.pageInfo.hasNextPage) await connection.fetchNext();
    return connection.nodes;
  }

  return {
    async identity(): Promise<{ id: string; name: string }> {
      const viewer = await client.viewer;
      return { id: viewer.id, name: viewer.displayName || viewer.name };
    },
    async teams(): Promise<LinearTeam[]> {
      const teams = await all(await client.teams({ first: 50 }));
      return teams.map((team) => ({ id: team.id, name: team.name, key: team.key }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async cycles(teamId: string): Promise<{ settings: LinearCycleSettings; cycles: ImportedCycle[] }> {
      const team = await client.team(teamId);
      if (!team) throw new HttpError(404, "Linear team was not found.");
      const cycles = await all(await team.cycles({ first: 50 }));
      return { settings: { timezone: team.timezone, cyclesEnabled: team.cyclesEnabled, cycleDuration: team.cycleDuration,
        cycleStartDay: team.cycleStartDay, cycleCooldownTime: team.cycleCooldownTime, upcomingCycleCount: team.upcomingCycleCount },
        cycles: cycles.map((cycle) => ({
        id: cycle.id, teamId, number: cycle.number, name: cycle.name ?? null, startsAt: cycle.startsAt, endsAt: cycle.endsAt, completedAt: cycle.completedAt ?? null,
        cycleDays: Math.round((cycle.endsAt.getTime() - cycle.startsAt.getTime()) / 86400000),
        completedPoints: cycle.completedAt && cycle.completedScopeHistory.length ? cycle.completedScopeHistory.at(-1)! : null,
      })).filter((cycle) => cycle.cycleDays > 0 && (cycle.completedPoints === null || (Number.isFinite(cycle.completedPoints) && cycle.completedPoints >= 0))) };
    },
    async previewProjects(teamId: string): Promise<ProjectPreview[]> {
      const team = await client.team(teamId);
      if (!team) throw new HttpError(404, "Linear team was not found.");
      const projects = await all(await team.projects({ first: 50 }));
      return projects.map((project) => ({
        id: project.id, name: project.name, status: project.state || "unknown",
      })).sort((a, b) => a.name.localeCompare(b.name));
    },
    async projects(teamId: string, includeIssues: boolean): Promise<ImportedProject[]> {
      const team = await client.team(teamId);
      if (!team) throw new HttpError(404, "Linear team was not found.");
      const projects = await all(await team.projects({ first: 50 }));
      const result: ImportedProject[] = [];
      // A small concurrency cap keeps a larger team's import responsive without
      // making one API call per issue or flooding Linear with requests.
      for (let index = 0; index < projects.length; index += 4) {
        const page = await Promise.all(projects.slice(index, index + 4).map(async (project) => {
        let after: string | null = null;
        let projectTeams: { id: string }[] = [];
        let extraTeams = false;
        let aggregateScope = 0;
        let completedScopeHistory: number[] = [];
        const issues: ImportedIssue[] = [];
        do {
          const response: LinearRawResponse<ProjectDetailsResponse> = await client.client.rawRequest<ProjectDetailsResponse, { id: string; after: string | null }>(
            projectDetailsQuery, { id: project.id, after },
          );
          const details: ProjectDetailsResponse["project"] = response.data?.project ?? null;
          if (!details) throw new HttpError(502, `Linear did not return details for project ${project.id}.`);
          projectTeams = details.teams.nodes;
          extraTeams = details.teams.pageInfo.hasNextPage;
          aggregateScope = details.scope;
          completedScopeHistory = details.completedScopeHistory;
          if (includeIssues) for (const issue of details.issues.nodes) {
            issues.push({
              id: issue.id, projectId: project.id, teamId: issue.team?.id || "",
              identifier: issue.identifier, title: issue.title, estimate: issue.estimate ?? null,
              stateType: issue.state?.type || "unknown", completedAt: issue.completedAt ? new Date(issue.completedAt) : null,
              updatedAt: new Date(issue.updatedAt),
            });
          }
          after = includeIssues && details.issues.pageInfo.hasNextPage ? details.issues.pageInfo.endCursor : null;
          if (includeIssues && details.issues.pageInfo.hasNextPage && !after) {
            throw new HttpError(502, `Linear returned an incomplete issue page for project ${project.id}.`);
          }
        } while (after);
        if (!projectTeams.some((item) => item.id === teamId)) return null;
        const completedIssuePoints = includeIssues ? issues.filter((issue) => ["completed", "canceled"].includes(issue.stateType))
          .reduce((sum, issue) => sum + (issue.estimate ?? 0), 0) : undefined;
        const remainingScope = linearRemainingScope(aggregateScope, completedScopeHistory, completedIssuePoints);
        const [relations, inverseRelations] = includeIssues ? await Promise.all([
          all(await project.relations({ first: 50 })), all(await project.inverseRelations({ first: 50 })),
        ]) : [[], []];
        const dependencyEdges = linearProjectDependencies([...relations, ...inverseRelations]);
        return {
          id: project.id, teamId, name: project.name, description: project.description || "",
          status: project.state || "unknown", url: project.url, updatedAt: project.updatedAt, priority: project.priority, remainingScope,
          crossTeam: extraTeams || projectTeams.length > 1 || issues.some((issue) => issue.teamId !== teamId), issues,
          dependencies: dependencyEdges.filter((edge) => edge.predecessorId === project.id).map((edge) => edge.successorId),
          blockedBy: dependencyEdges.filter((edge) => edge.successorId === project.id).map((edge) => edge.predecessorId),
        } satisfies ImportedProject;
        }));
        result.push(...page.filter((project): project is NonNullable<typeof project> => project !== null));
      }
      return result.sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}

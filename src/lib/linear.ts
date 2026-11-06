import { LinearClient, LinearError, LinearErrorType, type LinearRawResponse } from "@linear/sdk";
import { HttpError, responseError } from "./security";

export type ImportedIssue = {
  id: string; projectId: string; teamId: string; identifier: string; title: string;
  estimate: number | null; stateType: string; completedAt: Date | null; updatedAt: Date;
};
export type ImportedProjectLabel = { id: string; name: string };
export type ImportedProject = {
  id: string; teamId: string; name: string; description: string; status: string; url: string;
  updatedAt: Date; crossTeam: boolean; priority?: number | null; remainingScope?: number | null; issues: ImportedIssue[];
  labels?: ImportedProjectLabel[]; dependencies?: string[]; blockedBy?: string[];
  sourceScope?: number; completedScopeHistory?: number[]; completedIssuePoints?: number;
};
export type ImportedTeamIssue = {
  id: string; projectId: string | null; teamId: string; identifier: string; title: string; url: string;
  estimate: number | null; stateType: string; completedAt: Date | null; updatedAt: Date;
};
export type ImportedIssueBlocker = { blockerId: string; blockedIssueId: string };
export type ImportedTeamIssueSource = { issues: ImportedTeamIssue[]; blockerEdges: ImportedIssueBlocker[] };
export type ImportedCycle = { id: string; teamId: string; number: number; name: string | null; startsAt: Date; endsAt: Date; completedAt: Date | null; cycleDays: number; completedPoints: number | null };
export type LinearCycleSettings = { timezone: string; cyclesEnabled: boolean; cycleDuration: number; cycleStartDay: number; cycleCooldownTime: number; upcomingCycleCount: number };
export type LinearTeam = { id: string; name: string; key: string };
export type ProjectPreview = { id: string; name: string; status: string };

type ProjectRelation = { type: string; anchorType?: string; relatedAnchorType?: string; projectId?: string; relatedProjectId?: string; archivedAt?: Date | null };
type IssueRelation = { type: string; issueId?: string; relatedIssueId?: string; archivedAt?: Date | null };
type LinearPage<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean }; fetchNext(): Promise<unknown> };
type RawIssueRelation = { type: string; archivedAt: string | null; issue: { id: string }; relatedIssue: { id: string } };
type RawConnection<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
type TeamIssuesResponse = { team: { issues: RawConnection<{
  id: string; identifier: string; title: string; url: string; estimate: number | null; completedAt: string | null; updatedAt: string;
  project: { id: string } | null; team: { id: string } | null; state: { type: string } | null;
  inverseRelations: RawConnection<RawIssueRelation>;
}> } | null };
type IssueRelationsResponse = { issue: { inverseRelations: RawConnection<RawIssueRelation> } | null };
type RawProjectRelation = {
  type: string; anchorType: string | null; relatedAnchorType: string | null; archivedAt: string | null;
  project: { id: string }; relatedProject: { id: string };
};
type RawProject = {
  id: string; name: string; description: string | null; state: string | null; url: string; updatedAt: string; priority: number | null;
  scope: number; completedScopeHistory: number[];
  teams: RawConnection<{ id: string }>;
  labels: RawConnection<ImportedProjectLabel>;
  relations: RawConnection<RawProjectRelation>;
  inverseRelations: RawConnection<RawProjectRelation>;
};
type TeamProjectsResponse = { team: { projects: RawConnection<RawProject> } | null };
type ProjectEvidenceResponse = { project: {
  labels?: RawConnection<ImportedProjectLabel>;
  relations?: RawConnection<RawProjectRelation>;
  inverseRelations?: RawConnection<RawProjectRelation>;
} | null };
type ProjectIssuesResponse = { project: { issues: RawConnection<{
  estimate: number | null; state: { type: string } | null;
}> } | null };
type LinearRawRequester = <Data, Variables extends Record<string, unknown>>(query: string, variables: Variables) => Promise<LinearRawResponse<Data>>;
type LinearRead = <T>(request: () => Promise<T>) => Promise<T>;

const teamIssuesQuery = `
  query OhwawdTeamIssues($id: String!, $after: String) {
    team(id: $id) {
      issues(first: 25, after: $after) {
        nodes {
          id identifier title url estimate completedAt updatedAt
          project { id }
          team { id }
          state { type }
          inverseRelations(first: 25) {
            nodes { type archivedAt issue { id } relatedIssue { id } }
            pageInfo { hasNextPage endCursor }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const issueRelationsQuery = `
  query OhwawdIssueRelations($id: String!, $after: String) {
    issue(id: $id) {
      inverseRelations(first: 50, after: $after) {
        nodes { type archivedAt issue { id } relatedIssue { id } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const teamProjectsQuery = `
  query OhwawdTeamProjects($id: String!, $after: String) {
    team(id: $id) {
      projects(first: 25, after: $after) {
        nodes {
          id name description state url updatedAt priority scope completedScopeHistory
          teams(first: 50) { nodes { id } pageInfo { hasNextPage endCursor } }
          labels(first: 25) { nodes { id name } pageInfo { hasNextPage endCursor } }
          relations(first: 25) {
            nodes { type anchorType relatedAnchorType archivedAt project { id } relatedProject { id } }
            pageInfo { hasNextPage endCursor }
          }
          inverseRelations(first: 25) {
            nodes { type anchorType relatedAnchorType archivedAt project { id } relatedProject { id } }
            pageInfo { hasNextPage endCursor }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const projectEvidenceQuery = `
  query OhwawdProjectEvidence($id: String!, $labelAfter: String, $relationAfter: String, $inverseAfter: String, $loadLabels: Boolean!, $loadRelations: Boolean!, $loadInverse: Boolean!) {
    project(id: $id) {
      labels(first: 50, after: $labelAfter) @include(if: $loadLabels) { nodes { id name } pageInfo { hasNextPage endCursor } }
      relations(first: 50, after: $relationAfter) @include(if: $loadRelations) {
        nodes { type anchorType relatedAnchorType archivedAt project { id } relatedProject { id } }
        pageInfo { hasNextPage endCursor }
      }
      inverseRelations(first: 50, after: $inverseAfter) @include(if: $loadInverse) {
        nodes { type anchorType relatedAnchorType archivedAt project { id } relatedProject { id } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const projectIssuesQuery = `
  query OhwawdProjectIssues($id: String!, $after: String) {
    project(id: $id) {
      issues(first: 50, after: $after) {
        nodes { estimate state { type } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const linearNetworkRetryDelays = [300, 1_000];

export async function retryLinearRead<T>(request: () => Promise<T>, retryDelays = linearNetworkRetryDelays): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try { return await request(); }
    catch (error) {
      if (!(error instanceof LinearError) || error.type !== LinearErrorType.NetworkError || attempt >= retryDelays.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    }
  }
}

export function createLinearRequestCounter() {
  let count = 0;
  return {
    attempt<T>(request: () => Promise<T>): Promise<T> {
      count += 1;
      return request();
    },
    count: () => count,
  };
}

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

export function linearIssueBlockers(relations: IssueRelation[]): ImportedIssueBlocker[] {
  const edges = new Map<string, ImportedIssueBlocker>();
  for (const relation of relations) {
    if (relation.archivedAt || relation.type !== "blocks" || !relation.issueId || !relation.relatedIssueId || relation.issueId === relation.relatedIssueId) continue;
    const edge = { blockerId: relation.issueId, blockedIssueId: relation.relatedIssueId };
    edges.set(`${edge.blockerId}:${edge.blockedIssueId}`, edge);
  }
  return [...edges.values()];
}

export async function allLinearPages<T>(connection: LinearPage<T>, read: LinearRead = retryLinearRead): Promise<T[]> {
  while (connection.pageInfo.hasNextPage) await read(() => connection.fetchNext());
  return connection.nodes;
}

export async function readLinearProjectLabels(load: () => Promise<LinearPage<ImportedProjectLabel>>): Promise<ImportedProjectLabel[]> {
  const labels = await allLinearPages(await retryLinearRead(load));
  return labels.map((label) => ({ id: label.id, name: label.name }));
}

const mapIssueRelation = (relation: RawIssueRelation): IssueRelation => ({
  type: relation.type, issueId: relation.issue.id, relatedIssueId: relation.relatedIssue.id,
  archivedAt: relation.archivedAt ? new Date(relation.archivedAt) : null,
});

export async function readLinearTeamIssues(teamId: string, request: LinearRawRequester): Promise<ImportedTeamIssueSource> {
  const issues: ImportedTeamIssue[] = [];
  const relations: IssueRelation[] = [];
  let after: string | null = null;
  do {
    const response = await retryLinearRead(() => request<TeamIssuesResponse, { id: string; after: string | null }>(teamIssuesQuery, { id: teamId, after }));
    const connection = response.data?.team?.issues;
    if (!connection) throw new HttpError(502, `Linear did not return issues for team ${teamId}.`);
    for (const issue of connection.nodes) {
      issues.push({
        id: issue.id, projectId: issue.project?.id ?? null, teamId: issue.team?.id ?? teamId,
        identifier: issue.identifier, title: issue.title, url: issue.url, estimate: issue.estimate ?? null,
        stateType: issue.state?.type ?? "unknown", completedAt: issue.completedAt ? new Date(issue.completedAt) : null,
        updatedAt: new Date(issue.updatedAt),
      });
      relations.push(...issue.inverseRelations.nodes.map(mapIssueRelation));
      let relationAfter = issue.inverseRelations.pageInfo.hasNextPage ? issue.inverseRelations.pageInfo.endCursor : null;
      if (issue.inverseRelations.pageInfo.hasNextPage && !relationAfter) throw new HttpError(502, `Linear returned incomplete blocker relations for issue ${issue.id}.`);
      while (relationAfter) {
        const relationResponse = await retryLinearRead(() => request<IssueRelationsResponse, { id: string; after: string | null }>(
          issueRelationsQuery, { id: issue.id, after: relationAfter },
        ));
        const relationConnection = relationResponse.data?.issue?.inverseRelations;
        if (!relationConnection) throw new HttpError(502, `Linear did not return blocker relations for issue ${issue.id}.`);
        relations.push(...relationConnection.nodes.map(mapIssueRelation));
        relationAfter = relationConnection.pageInfo.hasNextPage ? relationConnection.pageInfo.endCursor : null;
        if (relationConnection.pageInfo.hasNextPage && !relationAfter) throw new HttpError(502, `Linear returned incomplete blocker relations for issue ${issue.id}.`);
      }
    }
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
    if (connection.pageInfo.hasNextPage && !after) throw new HttpError(502, `Linear returned an incomplete issue page for team ${teamId}.`);
  } while (after);
  return {
    issues: issues.sort((a, b) => a.identifier.localeCompare(b.identifier)),
    blockerEdges: linearIssueBlockers(relations).sort((a, b) => a.blockerId.localeCompare(b.blockerId) || a.blockedIssueId.localeCompare(b.blockedIssueId)),
  };
}

const mapProjectRelation = (relation: RawProjectRelation): ProjectRelation => ({
  type: relation.type, anchorType: relation.anchorType ?? undefined, relatedAnchorType: relation.relatedAnchorType ?? undefined,
  projectId: relation.project.id, relatedProjectId: relation.relatedProject.id,
  archivedAt: relation.archivedAt ? new Date(relation.archivedAt) : null,
});

function nextCursor(connection: RawConnection<unknown>, context: string): string | null {
  if (!connection.pageInfo.hasNextPage) return null;
  if (!connection.pageInfo.endCursor) throw new HttpError(502, `Linear returned incomplete ${context}.`);
  return connection.pageInfo.endCursor;
}

async function readLinearProjectCompletedPoints(projectId: string, request: LinearRawRequester): Promise<number> {
  let points = 0;
  let after: string | null = null;
  do {
    const response = await retryLinearRead(() => request<ProjectIssuesResponse, { id: string; after: string | null }>(
      projectIssuesQuery, { id: projectId, after },
    ));
    const connection = response.data?.project?.issues;
    if (!connection) throw new HttpError(502, `Linear did not return issues for project ${projectId}.`);
    points += connection.nodes.filter((issue) => ["completed", "canceled"].includes(issue.state?.type ?? "unknown"))
      .reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
    after = nextCursor(connection, `issue page for project ${projectId}`);
  } while (after);
  return points;
}

export async function readLinearProjects(teamId: string, request: LinearRawRequester): Promise<ImportedProject[]> {
  const projects: ImportedProject[] = [];
  let after: string | null = null;
  do {
    const response = await retryLinearRead(() => request<TeamProjectsResponse, { id: string; after: string | null }>(teamProjectsQuery, { id: teamId, after }));
    const connection = response.data?.team?.projects;
    if (!connection) throw new HttpError(502, `Linear did not return projects for team ${teamId}.`);
    const page: ImportedProject[] = [];
    for (let index = 0; index < connection.nodes.length; index += 4) page.push(...await Promise.all(connection.nodes.slice(index, index + 4).map(async (project) => {
      const labels = [...project.labels.nodes];
      const relations = project.relations.nodes.map(mapProjectRelation);
      const inverseRelations = project.inverseRelations.nodes.map(mapProjectRelation);
      let labelAfter = nextCursor(project.labels, `label page for project ${project.id}`);
      let relationAfter = nextCursor(project.relations, `relation page for project ${project.id}`);
      let inverseAfter = nextCursor(project.inverseRelations, `inverse relation page for project ${project.id}`);
      while (labelAfter || relationAfter || inverseAfter) {
        const requested = { labelAfter, relationAfter, inverseAfter };
        const evidenceResponse = await retryLinearRead(() => request<ProjectEvidenceResponse, {
          id: string; labelAfter: string | null; relationAfter: string | null; inverseAfter: string | null;
          loadLabels: boolean; loadRelations: boolean; loadInverse: boolean;
        }>(
          projectEvidenceQuery, { id: project.id, ...requested, loadLabels: !!labelAfter, loadRelations: !!relationAfter, loadInverse: !!inverseAfter },
        ));
        const evidence = evidenceResponse.data?.project;
        if (!evidence) throw new HttpError(502, `Linear did not return evidence for project ${project.id}.`);
        if (requested.labelAfter) {
          if (!evidence.labels) throw new HttpError(502, `Linear did not return labels for project ${project.id}.`);
          labels.push(...evidence.labels.nodes); labelAfter = nextCursor(evidence.labels, `label page for project ${project.id}`);
        }
        if (requested.relationAfter) {
          if (!evidence.relations) throw new HttpError(502, `Linear did not return relations for project ${project.id}.`);
          relations.push(...evidence.relations.nodes.map(mapProjectRelation)); relationAfter = nextCursor(evidence.relations, `relation page for project ${project.id}`);
        }
        if (requested.inverseAfter) {
          if (!evidence.inverseRelations) throw new HttpError(502, `Linear did not return inverse relations for project ${project.id}.`);
          inverseRelations.push(...evidence.inverseRelations.nodes.map(mapProjectRelation)); inverseAfter = nextCursor(evidence.inverseRelations, `inverse relation page for project ${project.id}`);
        }
      }
      const dependencyEdges = linearProjectDependencies([...relations, ...inverseRelations]);
      const crossTeam = project.teams.pageInfo.hasNextPage || project.teams.nodes.length > 1;
      const completedIssuePoints = crossTeam ? await readLinearProjectCompletedPoints(project.id, request) : undefined;
      return {
        id: project.id, teamId, name: project.name, description: project.description ?? "", status: project.state ?? "unknown",
        url: project.url, updatedAt: new Date(project.updatedAt), priority: project.priority,
        sourceScope: project.scope, completedScopeHistory: project.completedScopeHistory, completedIssuePoints,
        remainingScope: linearRemainingScope(project.scope, project.completedScopeHistory, completedIssuePoints), crossTeam,
        issues: [], labels: labels.map((label) => ({ id: label.id, name: label.name })),
        dependencies: dependencyEdges.filter((edge) => edge.predecessorId === project.id).map((edge) => edge.successorId),
        blockedBy: dependencyEdges.filter((edge) => edge.successorId === project.id).map((edge) => edge.predecessorId),
      } satisfies ImportedProject;
    })));
    projects.push(...page);
    after = nextCursor(connection, `project page for team ${teamId}`);
  } while (after);
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export function mergeLinearTeamIssueEvidence(projects: ImportedProject[], source: ImportedTeamIssueSource): ImportedProject[] {
  const completedPoints = new Map<string, number>();
  const crossTeam = new Set<string>();
  const projectById = new Map(projects.map((project) => [project.id, project]));
  for (const issue of source.issues) if (issue.projectId) {
    if (["completed", "canceled"].includes(issue.stateType)) completedPoints.set(issue.projectId, (completedPoints.get(issue.projectId) ?? 0) + (issue.estimate ?? 0));
    const project = projectById.get(issue.projectId);
    if (project && issue.teamId !== project.teamId) crossTeam.add(project.id);
  }
  return projects.map((project) => ({
    ...project,
    crossTeam: project.crossTeam || crossTeam.has(project.id),
    remainingScope: project.sourceScope === undefined ? project.remainingScope : linearRemainingScope(
      project.sourceScope, project.completedScopeHistory ?? [], Math.max(completedPoints.get(project.id) ?? 0, project.completedIssuePoints ?? 0),
    ),
  }));
}

export function linearReadError(error: unknown, action: string): Response {
  if (!(error instanceof LinearError)) return responseError(error);
  const detail = error.errors?.[0]?.message?.replace(/[\r\n\t]/g, " ").slice(0, 240);
  const message = error.type === LinearErrorType.Ratelimited
    ? "Linear's rate limit was reached. Try again shortly."
    : error.type === LinearErrorType.NetworkError
      ? "The application server temporarily lost its connection to Linear. Try the sync again."
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
  const requests = createLinearRequestCounter();
  const read: LinearRead = (request) => retryLinearRead(() => requests.attempt(request));
  const rawRequest: LinearRawRequester = (query, variables) => requests.attempt(() => client.client.rawRequest(query, variables));

  return {
    requestCount: requests.count,
    async identity(): Promise<{ id: string; name: string }> {
      const viewer = await read(() => client.viewer);
      return { id: viewer.id, name: viewer.displayName || viewer.name };
    },
    async teams(): Promise<LinearTeam[]> {
      const teams = await allLinearPages(await read(() => client.teams({ first: 50 })), read);
      return teams.map((team) => ({ id: team.id, name: team.name, key: team.key }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async cycles(teamId: string): Promise<{ settings: LinearCycleSettings; cycles: ImportedCycle[] }> {
      const team = await read(() => client.team(teamId));
      if (!team) throw new HttpError(404, "Linear team was not found.");
      const cycles = await allLinearPages(await read(() => team.cycles({ first: 50 })), read);
      return { settings: { timezone: team.timezone, cyclesEnabled: team.cyclesEnabled, cycleDuration: team.cycleDuration,
        cycleStartDay: team.cycleStartDay, cycleCooldownTime: team.cycleCooldownTime, upcomingCycleCount: team.upcomingCycleCount },
        cycles: cycles.map((cycle) => ({
        id: cycle.id, teamId, number: cycle.number, name: cycle.name ?? null, startsAt: cycle.startsAt, endsAt: cycle.endsAt, completedAt: cycle.completedAt ?? null,
        cycleDays: Math.round((cycle.endsAt.getTime() - cycle.startsAt.getTime()) / 86400000),
        completedPoints: cycle.completedAt && cycle.completedScopeHistory.length ? cycle.completedScopeHistory.at(-1)! : null,
      })).filter((cycle) => cycle.cycleDays > 0 && (cycle.completedPoints === null || (Number.isFinite(cycle.completedPoints) && cycle.completedPoints >= 0))) };
    },
    async previewProjects(teamId: string): Promise<ProjectPreview[]> {
      const team = await read(() => client.team(teamId));
      if (!team) throw new HttpError(404, "Linear team was not found.");
      const projects = await allLinearPages(await read(() => team.projects({ first: 50 })), read);
      return projects.map((project) => ({
        id: project.id, name: project.name, status: project.state || "unknown",
      })).sort((a, b) => a.name.localeCompare(b.name));
    },
    async projects(teamId: string, _includeIssues: boolean): Promise<ImportedProject[]> {
      return readLinearProjects(teamId, rawRequest);
    },
    async teamIssues(teamId: string): Promise<ImportedTeamIssueSource> {
      return readLinearTeamIssues(teamId, rawRequest);
    },
  };
}

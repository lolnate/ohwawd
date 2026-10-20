import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getBoard } from "./board";
import { db, ensureSchema } from "./db";
import { HttpError } from "./security";
import { adaptLegacyPlanning } from "./legacy-planning";

export const calculationVersion = "v3";

type ScenarioClient = Pick<PoolClient, "query">;
type BoardSnapshot = Awaited<ReturnType<typeof getBoard>>;
type ScenarioRow = {
  id: string;
  name: string;
  edit_version: string | number;
  draft_source_at: Date;
  draft_source_snapshot: unknown;
  draft_snapshot: BoardSnapshot;
  archived: boolean;
  created_at: Date;
  updated_at: Date;
};
type RevisionRow = {
  id: string;
  scenario_id: string;
  revision_number: number;
  draft_edit_version: string | number;
  calculation_version: string;
  source_at: Date;
  snapshot: BoardSnapshot;
  rationale: string;
  author: string;
  published_at: Date;
  stale_source_confirmed: boolean;
};
type StreamRegistry = Map<string, { name: string; active: boolean }>;

export type ScenarioReference = { kind: "draft" | "revision"; id: string };

export class ScenarioConflictError extends HttpError {
  constructor(expectedVersion: number, currentVersion: number) {
    super(409, "The scenario draft changed since it was loaded.", { code: "EDIT_VERSION_CONFLICT", expectedVersion, currentVersion });
  }
}

async function useDatabase(client?: ScenarioClient): Promise<ScenarioClient> {
  if (!client) await ensureSchema();
  return client ?? db();
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function validateName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 120) throw new HttpError(400, "Enter a scenario name of at most 120 characters.");
  return name;
}

function validateVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new HttpError(400, "A positive expectedVersion is required.");
  return value as number;
}

function validateId(value: unknown, label = "Scenario"): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, `${label} ID is invalid.`);
  }
  return value;
}

function sourceSnapshot(board: BoardSnapshot) {
  return {
    sourceAt: board.forecast.sourceAt,
    connection: board.connection,
    packages: board.packages,
    issues: board.issues,
    dependencies: board.dependencies,
    linearCycles: board.linearCycles,
    observations: board.observations,
  };
}

function planningState(original: BoardSnapshot, reference?: BoardSnapshot) {
  const board = adaptLegacyPlanning(original);
  const packageIds = reference ? new Set(reference.packages.map((item) => item.id)) : null;
  const linearEdges = reference ? new Set(reference.dependencies.filter((edge) => edge.source === "linear")
    .map((edge) => `${edge.predecessor_id}\0${edge.successor_id}`)) : null;
  return {
    packages: board.packages.filter((item) => !packageIds || packageIds.has(item.id)).map((item) => ({ id: item.id, streamId: item.stream_id, selected: item.selected,
      sequence: item.sequence_position ?? null, reason: item.pause_reason })).sort((a, b) => a.id.localeCompare(b.id)),
    streams: board.streams.map((item) => ({ id: item.id, name: item.name, position: item.position,
      wip: item.wip_limit, allocation: item.allocation })).sort((a, b) => a.id.localeCompare(b.id)),
    links: board.links.map((item) => ({ outcomeId: item.outcome_id, projectId: item.project_id, requirement: item.requirement }))
      .sort((a, b) => `${a.outcomeId}\0${a.projectId}`.localeCompare(`${b.outcomeId}\0${b.projectId}`)),
    outcomes: board.outcomes.map((item) => ({ id: item.id, title: item.title, description: item.description,
      owner: item.owner, successSignal: item.success_signal, neededBy: item.needed_by })).sort((a, b) => a.id.localeCompare(b.id)),
    capacity: board.capacity,
    adjustments: board.adjustments.map((item) => ({ cycleId: item.linear_cycle_id, availability: item.availability, reserve: item.reserve }))
      .sort((a, b) => a.cycleId.localeCompare(b.cycleId)),
    weeklyAdjustments: [...board.weeklyAdjustments].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    dependencies: board.dependencies.filter((edge) => edge.source === "local" || !linearEdges || linearEdges.has(`${edge.predecessor_id}\0${edge.successor_id}`))
      .map((edge) => ({ predecessorId: edge.predecessor_id, successorId: edge.successor_id, source: edge.source,
        waived: edge.waived, reason: edge.waiver_reason })).sort((a, b) => `${a.source}\0${a.predecessorId}\0${a.successorId}`.localeCompare(`${b.source}\0${b.predecessorId}\0${b.successorId}`)),
    extraScopes: board.extraScopes.filter((item) => !packageIds || packageIds.has(item.package_id))
      .map((item) => ({ packageId: item.package_id, points: item.points, notes: item.notes, issueIds: [...item.issue_ids].sort(),
        issueBaseline: item.issue_baseline, legacyReview: item.legacy_review })).sort((a, b) => a.packageId.localeCompare(b.packageId)),
  };
}

function fingerprint(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (item instanceof Date) return item.toISOString();
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, canonical(nested)]));
    return item;
  };
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function stablePreviewBoard(board: BoardSnapshot) {
  const { evaluatedAt: _clock, scoping: _readiness, ...stable } = board;
  return stable;
}

function streamConflicts(snapshot: BoardSnapshot, registry: StreamRegistry) {
  const references = new Set<string>();
  for (const stream of snapshot.streams ?? []) references.add(stream.id);
  for (const item of snapshot.packages ?? []) if (item.stream_id) references.add(item.stream_id);
  return [...references].filter((id) => !registry.get(id)?.active).sort()
    .map((id) => ({ id, name: registry.get(id)?.name ?? snapshot.streams?.find((item) => item.id === id)?.name ?? id }));
}

async function currentStreamRegistry(database: ScenarioClient): Promise<StreamRegistry> {
  const streams = await database.query<{ id: string; name: string; active: boolean }>("SELECT id,name,active FROM stream");
  return new Map(streams.rows.map((stream) => [stream.id, { name: stream.name, active: stream.active }]));
}

function scenarioSummary(row: ScenarioRow, currentSourceAt: string, revisions: ReturnType<typeof revisionSummary>[], registry: StreamRegistry) {
  return {
    id: row.id,
    name: row.name,
    editVersion: Number(row.edit_version),
    sourceAt: iso(row.draft_source_at),
    stale: Date.parse(currentSourceAt) > new Date(row.draft_source_at).getTime(),
    archived: row.archived,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    streamConflicts: streamConflicts(row.draft_snapshot, registry),
    conversionNotice: row.draft_snapshot.calculationVersion === "v3" ? null : row.draft_snapshot.calculationVersion === "v2"
      ? "This draft predates projected cycles. Loading uses the current Linear cadence and marks projected dates provisional; save the board to capture the v3 plan."
      : row.draft_snapshot.calculationVersion === "v1"
        ? "This draft predates weekly availability. Loading preserves its capacity with holiday defaults disabled and uses the v3 planning calendar; save the board to capture it."
        : "This legacy draft uses numeric ranks and retired start/must-include controls. Loading adapts its sequence and Extra scope with holiday defaults disabled; save the board to store the v3 plan.",
    revisions,
  };
}

function revisionSummary(row: RevisionRow) {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    revisionNumber: row.revision_number,
    draftEditVersion: Number(row.draft_edit_version),
    calculationVersion: row.calculation_version,
    sourceAt: iso(row.source_at),
    rationale: row.rationale,
    author: row.author,
    publishedAt: iso(row.published_at),
    staleSourceConfirmed: row.stale_source_confirmed,
  };
}

async function currentSourceAt(database: ScenarioClient): Promise<string> {
  const result = await database.query<{ source_at: Date }>(`SELECT COALESCE(GREATEST(l.last_imported_at,l.cycles_refreshed_at),w.created_at) AS source_at
    FROM workspace w LEFT JOIN linear_connection l ON l.workspace_id=w.id WHERE w.id=1`);
  return iso(result.rows[0].source_at);
}

async function loadScenario(database: ScenarioClient, id: string, lock = false): Promise<ScenarioRow> {
  validateId(id);
  const result = await database.query<ScenarioRow>(`SELECT * FROM scenario WHERE id=$1${lock ? " FOR UPDATE" : ""}`, [id]);
  if (!result.rows[0]) throw new HttpError(404, "Scenario not found.");
  return result.rows[0];
}

async function activeScenarioId(database: ScenarioClient): Promise<string | null> {
  const result = await database.query<{ active_scenario_id: string | null }>("SELECT active_scenario_id FROM workspace_scenario_state WHERE workspace_id=1");
  return result.rows[0]?.active_scenario_id ?? null;
}

async function requireActiveScenario(database: ScenarioClient, id: string): Promise<void> {
  if (await activeScenarioId(database) !== id) {
    throw new HttpError(409, "Load this draft onto the board before saving or rebasing it.", { code: "SCENARIO_NOT_ACTIVE" });
  }
}

async function summaryFor(database: ScenarioClient, id: string) {
  const [row, sourceAt, revisions, registry] = await Promise.all([
    loadScenario(database, id),
    currentSourceAt(database),
    database.query<RevisionRow>("SELECT * FROM scenario_revision WHERE scenario_id=$1 ORDER BY revision_number", [id]),
    currentStreamRegistry(database),
  ]);
  return scenarioSummary(row, sourceAt, revisions.rows.map(revisionSummary), registry);
}

export async function listScenarios(client?: ScenarioClient) {
  const database = await useDatabase(client);
  const [scenarios, revisions, baseline, activeId, sourceAt, board, registry] = await Promise.all([
    database.query<ScenarioRow>("SELECT * FROM scenario ORDER BY archived,name,id"),
    database.query<RevisionRow>("SELECT * FROM scenario_revision ORDER BY scenario_id,revision_number"),
    database.query<{ revision_id: string }>("SELECT revision_id FROM workspace_baseline WHERE workspace_id=1"),
    activeScenarioId(database),
    currentSourceAt(database),
    getBoard(database),
    currentStreamRegistry(database),
  ]);
  const active = scenarios.rows.find((row) => row.id === activeId);
  return {
    baselineRevisionId: baseline.rows[0]?.revision_id ?? null,
    activeScenarioId: activeId,
    activeDraftDirty: !!active && fingerprint(planningState(active.draft_snapshot)) !== fingerprint(planningState(board, active.draft_snapshot)),
    currentSourceAt: sourceAt,
    creationReadiness: {
      ready: board.forecast.ready,
      blockers: [...board.forecast.setup, ...board.forecast.errors],
      warnings: board.reconciliationWarnings.map((warning) => warning.message),
    },
    scenarios: scenarios.rows.map((row) => scenarioSummary(row, sourceAt,
      revisions.rows.filter((revision) => revision.scenario_id === row.id).map(revisionSummary), registry)),
  };
}

export async function createScenario(input: { name: string }, client?: ScenarioClient) {
  const database = await useDatabase(client);
  await database.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const name = validateName(input.name);
  const board = await getBoard(database);
  if (!board.forecast.ready) throw new HttpError(422, "Complete the board forecast prerequisites before creating a scenario.", {
    code: "SCENARIO_BOARD_NOT_READY", blockers: [...board.forecast.setup, ...board.forecast.errors],
  });
  const id = randomUUID();
  const result = await database.query(`INSERT INTO scenario(id,workspace_id,name,draft_source_at,draft_source_snapshot,draft_snapshot)
    VALUES($1,1,$2,$3,$4::jsonb,$5::jsonb) ON CONFLICT(workspace_id,name) DO NOTHING RETURNING id`,
  [id, name, board.forecast.sourceAt, JSON.stringify(sourceSnapshot(board)), JSON.stringify(board)]);
  if (!result.rowCount) throw new HttpError(409, "A scenario with that name already exists.", { code: "SCENARIO_NAME_CONFLICT" });
  await database.query(`INSERT INTO workspace_scenario_state(workspace_id,active_scenario_id) VALUES(1,$1)
    ON CONFLICT(workspace_id) DO UPDATE SET active_scenario_id=EXCLUDED.active_scenario_id`, [id]);
  return summaryFor(database, id);
}

export async function saveScenario(id: string, input: { expectedVersion: number; name?: string; archived?: boolean }, client?: ScenarioClient) {
  const database = await useDatabase(client);
  await database.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const expectedVersion = validateVersion(input.expectedVersion);
  const existing = await loadScenario(database, id, true);
  const currentVersion = Number(existing.edit_version);
  if (currentVersion !== expectedVersion) throw new ScenarioConflictError(expectedVersion, currentVersion);
  await requireActiveScenario(database, id);
  const board = await getBoard(database);
  if (Date.parse(board.forecast.sourceAt) > new Date(existing.draft_source_at).getTime()) {
    throw new HttpError(409, "The scenario source changed. Rebase before saving more draft changes.", {
      code: "SOURCE_STALE", draftSourceAt: iso(existing.draft_source_at), currentSourceAt: board.forecast.sourceAt,
    });
  }
  const name = input.name === undefined ? existing.name : validateName(input.name);
  const archived = input.archived === undefined ? existing.archived : input.archived;
  if (typeof archived !== "boolean") throw new HttpError(400, "archived must be a boolean.");
  const updated = await database.query(`UPDATE scenario SET name=$3,archived=$4,draft_snapshot=$5::jsonb,
    edit_version=edit_version+1,updated_at=now() WHERE id=$1 AND edit_version=$2 RETURNING edit_version`,
  [id, expectedVersion, name, archived, JSON.stringify(board)]);
  if (!updated.rowCount) {
    const latest = await loadScenario(database, id);
    throw new ScenarioConflictError(expectedVersion, Number(latest.edit_version));
  }
  return summaryFor(database, id);
}

export async function previewScenarioRebase(id: string, input: { expectedVersion: number }, client?: ScenarioClient) {
  const database = await useDatabase(client);
  const expectedVersion = validateVersion(input.expectedVersion);
  const existing = await loadScenario(database, id);
  const currentVersion = Number(existing.edit_version);
  if (currentVersion !== expectedVersion) throw new ScenarioConflictError(expectedVersion, currentVersion);
  await requireActiveScenario(database, id);
  const board = await getBoard(database);
  return { scenario: await summaryFor(database, id), comparison: compareSnapshots(existing.draft_snapshot, board), previewToken: fingerprint(stablePreviewBoard(board)) };
}

export async function rebaseScenario(id: string, input: { expectedVersion: number; confirm?: boolean; previewToken?: string }, client?: ScenarioClient) {
  const database = await useDatabase(client);
  if (input.confirm !== true) throw new HttpError(400, "Preview and confirm the rebase before applying it.");
  await database.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const expectedVersion = validateVersion(input.expectedVersion);
  const existing = await loadScenario(database, id, true);
  const currentVersion = Number(existing.edit_version);
  if (currentVersion !== expectedVersion) throw new ScenarioConflictError(expectedVersion, currentVersion);
  await requireActiveScenario(database, id);
  const board = await getBoard(database);
  if (typeof input.previewToken !== "string" || input.previewToken !== fingerprint(stablePreviewBoard(board))) {
    throw new HttpError(409, "The board changed after the rebase preview. Preview it again before accepting.", { code: "REBASE_PREVIEW_STALE" });
  }
  const updated = await database.query(`UPDATE scenario SET draft_source_at=$3,draft_source_snapshot=$4::jsonb,
    draft_snapshot=$5::jsonb,edit_version=edit_version+1,updated_at=now()
    WHERE id=$1 AND edit_version=$2 RETURNING edit_version`,
  [id, expectedVersion, board.forecast.sourceAt, JSON.stringify(sourceSnapshot(board)), JSON.stringify(board)]);
  if (!updated.rowCount) {
    const latest = await loadScenario(database, id);
    throw new ScenarioConflictError(expectedVersion, Number(latest.edit_version));
  }
  return { scenario: await summaryFor(database, id), comparison: compareSnapshots(existing.draft_snapshot, board) };
}

export async function activateScenario(id: string, input: { expectedVersion: number; confirmReplace?: boolean }, client?: ScenarioClient) {
  const database = await useDatabase(client);
  if (input.confirmReplace !== true) throw new HttpError(400, "Confirm replacing the live planning controls with this draft.");
  await database.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const expectedVersion = validateVersion(input.expectedVersion);
  const scenario = await loadScenario(database, id, true);
  const currentVersion = Number(scenario.edit_version);
  if (currentVersion !== expectedVersion) throw new ScenarioConflictError(expectedVersion, currentVersion);
  const snapshot = adaptLegacyPlanning(scenario.draft_snapshot);
  const conflicts = streamConflicts(snapshot, await currentStreamRegistry(database));
  if (conflicts.length) throw new HttpError(409, "This draft references retired streams. Restore those streams or create a reconciled draft from the current board.", {
    code: "STREAM_RECONCILIATION_REQUIRED", streamConflicts: conflicts,
  });

  for (const item of snapshot.packages) {
    await database.query(`UPDATE work_package SET stream_id=$2,selected=$3,sequence_position=$4,pause_reason=$5 WHERE id=$1`,
    [item.id, item.stream_id, item.selected, item.sequence_position ?? null, item.pause_reason]);
  }
  await database.query(`UPDATE work_package w SET sequence_position=ordered.position FROM
    (SELECT id,row_number() OVER(PARTITION BY stream_id ORDER BY sequence_position NULLS LAST,id)::integer AS position
      FROM work_package WHERE selected AND stream_id IS NOT NULL) ordered WHERE w.id=ordered.id`);
  const snapshotStreamIds = snapshot.streams.map((stream) => stream.id);
  const extraStreams = await database.query<{ id: string; name: string }>("SELECT id,name FROM stream WHERE active=true AND NOT(id=ANY($1::text[])) ORDER BY position,name,id", [snapshotStreamIds]);
  const desiredNames = [...snapshot.streams.map((stream) => stream.name), ...extraStreams.rows.map((stream) => stream.name)];
  if (new Set(desiredNames.map((name) => name.toLocaleLowerCase())).size !== desiredNames.length) {
    throw new HttpError(409, "This draft's stream names conflict with a stream added later. Rename the current stream before loading the draft.", {
      code: "STREAM_RECONCILIATION_REQUIRED",
    });
  }
  await database.query("UPDATE stream SET position=position+100000 WHERE active=true");
  await database.query("UPDATE stream SET name='__activating__' || id WHERE id=ANY($1::text[])", [snapshotStreamIds]);
  for (const stream of snapshot.streams) {
    await database.query("UPDATE stream SET name=$2,position=$3,wip_limit=$4,allocation=$5 WHERE id=$1 AND active=true",
      [stream.id, stream.name, stream.position, stream.wip_limit, stream.allocation]);
  }
  for (let index = 0; index < extraStreams.rows.length; index++) {
    await database.query("UPDATE stream SET position=$2,allocation=0 WHERE id=$1", [extraStreams.rows[index].id, snapshot.streams.length + index + 1]);
  }
  const capacity = snapshot.capacity;
  await database.query(`INSERT INTO capacity_profile(workspace_id,cycle_anchor,cycle_days,baseline,baseline_reason,reserve,horizon,scoping_lead_days,holidays_enabled)
    VALUES(1,$1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(workspace_id) DO UPDATE SET cycle_anchor=$1,cycle_days=$2,
    baseline=$3,baseline_reason=$4,reserve=$5,horizon=$6,scoping_lead_days=$7,holidays_enabled=$8`,
  [capacity.cycle_anchor, capacity.cycle_days, capacity.baseline, capacity.baseline_reason, capacity.reserve, capacity.horizon, capacity.scoping_lead_days ?? 14, capacity.holidays_enabled]);
  await database.query("DELETE FROM weekly_capacity_adjustment");
  for (const week of snapshot.weeklyAdjustments) {
    await database.query("INSERT INTO weekly_capacity_adjustment(week_start,availability,label) VALUES($1::date,$2,$3)", [week.weekStart, week.availability, week.label]);
  }

  await database.query("DELETE FROM linear_cycle_adjustment");
  for (const adjustment of snapshot.adjustments) {
    await database.query(`INSERT INTO linear_cycle_adjustment(linear_cycle_id,availability,reserve)
      SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM linear_cycle_cache WHERE linear_id=$1) ON CONFLICT(linear_cycle_id) DO UPDATE SET availability=$2,reserve=$3`,
    [adjustment.linear_cycle_id, adjustment.availability, adjustment.reserve]);
  }
  const packageIds = snapshot.packages.map((item) => item.id);
  await database.query("DELETE FROM package_extra_scope WHERE package_id=ANY($1::text[])", [packageIds]);
  for (const extra of snapshot.extraScopes) {
    await database.query(`INSERT INTO package_extra_scope(package_id,points,notes,issue_ids,issue_baseline,legacy_review)
      SELECT $1,$2,$3,$4,$5::jsonb,$6 WHERE EXISTS(SELECT 1 FROM work_package WHERE id=$1)`,
    [extra.package_id, extra.points, extra.notes, extra.issue_ids, JSON.stringify(extra.issue_baseline), extra.legacy_review]);
  }
  await database.query(`DELETE FROM package_dependency WHERE source='local'
    AND predecessor_id=ANY($1::text[]) AND successor_id=ANY($1::text[])`, [packageIds]);
  await database.query(`UPDATE package_dependency SET waived=false,waiver_reason='' WHERE source='linear'
    AND predecessor_id=ANY($1::text[]) AND successor_id=ANY($1::text[])`, [packageIds]);
  for (const edge of snapshot.dependencies) {
    if (edge.source === "local") {
      await database.query(`INSERT INTO package_dependency(predecessor_id,successor_id,source,waived,waiver_reason)
        SELECT $1,$2,'local',$3,$4 WHERE EXISTS(SELECT 1 FROM work_package WHERE id=$1) AND EXISTS(SELECT 1 FROM work_package WHERE id=$2)
        ON CONFLICT DO NOTHING`, [edge.predecessor_id, edge.successor_id, edge.waived, edge.waiver_reason]);
    } else if (edge.waived) {
      await database.query(`UPDATE package_dependency SET waived=true,waiver_reason=$3
        WHERE predecessor_id=$1 AND successor_id=$2 AND source='linear'`, [edge.predecessor_id, edge.successor_id, edge.waiver_reason]);
    }
  }

  for (const outcome of snapshot.outcomes) {
    await database.query(`INSERT INTO outcome(id,title,description,owner,success_signal,needed_by)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET title=$2,description=$3,owner=$4,success_signal=$5,needed_by=$6,updated_at=now()`,
    [outcome.id, outcome.title, outcome.description ?? "", outcome.owner ?? "", outcome.success_signal ?? "", outcome.needed_by]);
  }
  const outcomeIds = snapshot.outcomes.map((outcome) => outcome.id);
  await database.query("DELETE FROM outcome_project_link WHERE outcome_id=ANY($1::uuid[])", [outcomeIds]);
  for (const link of snapshot.links) {
    await database.query(`INSERT INTO outcome_project_link(outcome_id,project_id,requirement)
      SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM outcome WHERE id=$1) AND EXISTS(SELECT 1 FROM linear_project_cache WHERE linear_id=$2)`,
    [link.outcome_id, link.project_id, link.requirement]);
  }
  await database.query(`INSERT INTO workspace_scenario_state(workspace_id,active_scenario_id) VALUES(1,$1)
    ON CONFLICT(workspace_id) DO UPDATE SET active_scenario_id=EXCLUDED.active_scenario_id`, [id]);
  return summaryFor(database, id);
}

export async function publishScenario(id: string, input: {
  expectedVersion: number; rationale: string; author: string; confirmStaleSource?: boolean;
}, client?: ScenarioClient) {
  const database = await useDatabase(client);
  await database.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const expectedVersion = validateVersion(input.expectedVersion);
  const scenario = await loadScenario(database, id, true);
  const currentVersion = Number(scenario.edit_version);
  if (currentVersion !== expectedVersion) throw new ScenarioConflictError(expectedVersion, currentVersion);
  if (scenario.draft_snapshot.calculationVersion !== "v3") throw new HttpError(409, "Load and save this older draft to capture projected calendar assumptions before publishing.", { code: "LEGACY_DRAFT_REQUIRES_SAVE" });
  const rationale = typeof input.rationale === "string" ? input.rationale.trim() : "";
  const author = typeof input.author === "string" ? input.author.trim() : "";
  if (!rationale || rationale.length > 4000) throw new HttpError(400, "Publishing requires a rationale of at most 4000 characters.");
  if (!author || author.length > 200) throw new HttpError(400, "Publishing requires an author of at most 200 characters.");
  const conflicts = streamConflicts(scenario.draft_snapshot, await currentStreamRegistry(database));
  if (conflicts.length) throw new HttpError(409, "This draft references retired streams and must be reconciled before publishing.", {
    code: "STREAM_RECONCILIATION_REQUIRED", streamConflicts: conflicts,
  });
  if (!scenario.draft_snapshot.forecast?.ready) {
    throw new HttpError(422, "The draft forecast is not ready to publish.", {
      code: "FORECAST_NOT_READY",
      reasons: [...(scenario.draft_snapshot.forecast?.setup ?? []), ...(scenario.draft_snapshot.forecast?.errors ?? [])],
    });
  }
  if (scenario.draft_snapshot.reconciliationWarnings?.length) {
    throw new HttpError(422, "Reconcile source changes before publishing this draft.", {
      code: "ALLOWANCE_RECONCILIATION_REQUIRED", warnings: scenario.draft_snapshot.reconciliationWarnings,
    });
  }
  const sourceAt = await currentSourceAt(database);
  const stale = Date.parse(sourceAt) > new Date(scenario.draft_source_at).getTime();
  if (stale && input.confirmStaleSource !== true) {
    throw new HttpError(409, "The draft uses stale source data. Rebase it or explicitly confirm publishing the stale source.", {
      code: "STALE_SOURCE_CONFIRMATION_REQUIRED", draftSourceAt: iso(scenario.draft_source_at), currentSourceAt: sourceAt,
    });
  }
  if (await activeScenarioId(database) === id) {
    const board = await getBoard(database);
    if (fingerprint(planningState(scenario.draft_snapshot)) !== fingerprint(planningState(board, scenario.draft_snapshot))) {
      throw new HttpError(409, "Save the visible board changes to this draft before publishing.", { code: "DRAFT_HAS_UNSAVED_CHANGES" });
    }
  }
  const number = await database.query<{ revision_number: number }>(
    "SELECT COALESCE(MAX(revision_number),0)::integer+1 AS revision_number FROM scenario_revision WHERE scenario_id=$1", [id]);
  const revisionId = randomUUID();
  const inserted = await database.query<RevisionRow>(`INSERT INTO scenario_revision(id,scenario_id,revision_number,draft_edit_version,
    calculation_version,source_at,source_snapshot,snapshot,rationale,author,stale_source_confirmed)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11) RETURNING *`,
  [revisionId, id, number.rows[0].revision_number, expectedVersion, calculationVersion, scenario.draft_source_at,
    JSON.stringify(scenario.draft_source_snapshot), JSON.stringify(scenario.draft_snapshot), rationale, author, stale]);
  return revisionSummary(inserted.rows[0]);
}

export async function designateBaseline(revisionId: string, client?: ScenarioClient) {
  const database = await useDatabase(client);
  validateId(revisionId, "Revision");
  const revision = await database.query("SELECT r.id FROM scenario_revision r JOIN scenario s ON s.id=r.scenario_id WHERE r.id=$1 AND s.workspace_id=1", [revisionId]);
  if (!revision.rowCount) throw new HttpError(404, "Published revision not found.");
  await database.query(`INSERT INTO workspace_baseline(workspace_id,revision_id) VALUES(1,$1)
    ON CONFLICT(workspace_id) DO UPDATE SET revision_id=EXCLUDED.revision_id`, [revisionId]);
  return { revisionId };
}

async function resolveSnapshot(database: ScenarioClient, reference: ScenarioReference) {
  validateId(reference.id, reference.kind === "draft" ? "Scenario" : "Revision");
  if (reference.kind === "draft") {
    const row = await loadScenario(database, reference.id);
    return { label: row.name, kind: reference.kind, id: row.id, sourceAt: iso(row.draft_source_at), snapshot: row.draft_snapshot };
  }
  if (reference.kind !== "revision") throw new HttpError(400, "Comparison references must be drafts or revisions.");
  const result = await database.query<RevisionRow & { name: string }>(`SELECT r.*,s.name FROM scenario_revision r
    JOIN scenario s ON s.id=r.scenario_id WHERE r.id=$1`, [reference.id]);
  const row = result.rows[0];
  if (!row) throw new HttpError(404, "Published revision not found.");
  return { label: `${row.name} r${row.revision_number}`, kind: reference.kind, id: row.id, sourceAt: iso(row.source_at), snapshot: row.snapshot };
}

export function compareSnapshots(originalLeft: BoardSnapshot, originalRight: BoardSnapshot) {
  const left = adaptLegacyPlanning(originalLeft);
  const right = adaptLegacyPlanning(originalRight);
  const leftPackages = new Map(left.packages.map((item) => [item.id, item]));
  const rightPackages = new Map(right.packages.map((item) => [item.id, item]));
  const leftStreamNames = new Map(left.streams.map((item) => [item.id, item.name]));
  const rightStreamNames = new Map(right.streams.map((item) => [item.id, item.name]));
  const packageIds = [...new Set([...leftPackages.keys(), ...rightPackages.keys()])].sort();
  const packages = packageIds.flatMap((id) => {
    const before = leftPackages.get(id);
    const after = rightPackages.get(id);
    const from = before ? { selected: before.selected, streamId: before.stream_id ? leftStreamNames.get(before.stream_id) ?? "Retired stream" : null,
      sequence: before.sequence_position ?? null, pauseReason: before.pause_reason } : null;
    const to = after ? { selected: after.selected, streamId: after.stream_id ? rightStreamNames.get(after.stream_id) ?? "Retired stream" : null,
      sequence: after.sequence_position ?? null, pauseReason: after.pause_reason } : null;
    return JSON.stringify(from) === JSON.stringify(to) ? [] : [{ id, name: after?.name ?? before?.name ?? id, from, to }];
  });
  const leftOutcomes = new Map(left.forecast.outcomes.map((item) => [item.id, item]));
  const rightOutcomes = new Map(right.forecast.outcomes.map((item) => [item.id, item]));
  const outcomeNames = new Map([...left.outcomes, ...right.outcomes].map((item) => [item.id, item.title]));
  const outcomeIds = [...new Set([...leftOutcomes.keys(), ...rightOutcomes.keys()])].sort();
  const outcomes = outcomeIds.flatMap((id) => {
    const before = leftOutcomes.get(id);
    const after = rightOutcomes.get(id);
    const beforeDefinition = left.outcomes.find((item) => item.id === id);
    const afterDefinition = right.outcomes.find((item) => item.id === id);
    const from = before ? { status: before.status, calendarProjected: before.calendarProjected ?? false, endDate: before.endDate, target: before.target, gapCycles: before.gapCycles, reasons: before.reasons,
      title: beforeDefinition?.title ?? null, description: beforeDefinition?.description ?? "", owner: beforeDefinition?.owner ?? "",
      successSignal: beforeDefinition?.success_signal ?? "", neededBy: beforeDefinition?.needed_by ?? null } : null;
    const to = after ? { status: after.status, calendarProjected: after.calendarProjected ?? false, endDate: after.endDate, target: after.target, gapCycles: after.gapCycles, reasons: after.reasons,
      title: afterDefinition?.title ?? null, description: afterDefinition?.description ?? "", owner: afterDefinition?.owner ?? "",
      successSignal: afterDefinition?.success_signal ?? "", neededBy: afterDefinition?.needed_by ?? null } : null;
    return JSON.stringify(from) === JSON.stringify(to) ? [] : [{ id, title: outcomeNames.get(id) ?? id, from, to }];
  });
  const leftStreams = new Map(left.streams.map((item) => [item.id, item]));
  const rightStreams = new Map(right.streams.map((item) => [item.id, item]));
  const streamIds = [...new Set([...leftStreams.keys(), ...rightStreams.keys()])].sort();
  const streamChanges = streamIds.flatMap((id) => {
    const before = leftStreams.get(id);
    const after = rightStreams.get(id);
    const from = before ? { name: before.name, position: before.position, allocation: before.allocation, wip: before.wip_limit } : null;
    const to = after ? { name: after.name, position: after.position, allocation: after.allocation, wip: after.wip_limit } : null;
    return JSON.stringify(from) === JSON.stringify(to) ? [] : [{ id, name: after?.name ?? before?.name ?? id, from, to }];
  });
  const namedChanges = <T extends Record<string, unknown>>(leftItems: T[], rightItems: T[], key: (item: T) => string) => {
    const before = new Map(leftItems.map((item) => [key(item), item]));
    const after = new Map(rightItems.map((item) => [key(item), item]));
    return [...new Set([...before.keys(), ...after.keys()])].sort().flatMap((id) => {
      const from = before.get(id) ?? null;
      const to = after.get(id) ?? null;
      return JSON.stringify(from) === JSON.stringify(to) ? [] : [{ id, from, to }];
    });
  };
  const leftIssueNames = new Map(left.issues.map((item) => [item.linear_id, item.identifier]));
  const rightIssueNames = new Map(right.issues.map((item) => [item.linear_id, item.identifier]));
  const scopeValue = (item: BoardSnapshot["extraScopes"][number], issueNames: Map<string, string>) => ({ packageId: item.package_id,
    points: item.points, issues: [...item.issue_ids].map((id) => issueNames.get(id) ?? "Unavailable issue").sort(), notes: item.notes });
  const adjustmentValue = (item: BoardSnapshot["adjustments"][number]) => ({ cycleId: item.linear_cycle_id,
    availability: item.availability, reserve: item.reserve });
  const dependencyValue = (item: BoardSnapshot["dependencies"][number]) => ({ predecessorId: item.predecessor_id,
    successorId: item.successor_id, source: item.source, waived: item.waived, waiverReason: item.waiver_reason });
  const linkValue = (item: BoardSnapshot["links"][number]) => ({ outcomeId: item.outcome_id, projectId: item.project_id, requirement: item.requirement });
  const linearCycleValue = (item: BoardSnapshot["linearCycles"][number]) => ({ id: item.id, number: item.number, name: item.name,
    startsAt: item.startsAt, endsAt: item.endsAt });
  const packageNames = new Map([...left.packages, ...right.packages].map((item) => [item.id, item.name]));
  const outcomeTitles = new Map([...left.outcomes, ...right.outcomes].map((item) => [item.id, item.title]));
  const cycleNames = new Map([...left.linearCycles, ...right.linearCycles].map((item) => [item.id, item.name || `Cycle ${item.number}`]));
  const adjustments = namedChanges(left.adjustments.map(adjustmentValue), right.adjustments.map(adjustmentValue), (item) => item.cycleId as string)
    .map((change) => ({ ...change, name: cycleNames.get(change.id) ?? "Removed cycle" }));
  const extraScopes = namedChanges(left.extraScopes.map((item) => scopeValue(item, leftIssueNames)), right.extraScopes.map((item) => scopeValue(item, rightIssueNames)), (item) => item.packageId)
    .map((change) => ({ ...change, name: packageNames.get((change.to ?? change.from)!.packageId as string) ?? "Removed package" }));
  const priorityValue = (item: BoardSnapshot["packages"][number]) => ({ packageId: item.id as string, priority: (item.linear_priority ?? null) as number | null });
  const priorities = namedChanges(left.packages.map(priorityValue), right.packages.map(priorityValue), (item) => item.packageId)
    .map((change) => ({ ...change, name: packageNames.get(change.id) ?? change.id }));
  const dependencies = namedChanges(left.dependencies.map(dependencyValue), right.dependencies.map(dependencyValue),
    (item) => `${item.predecessorId}:${item.successorId}:${item.source}`).map((change) => {
      const value = (change.to ?? change.from)!;
      return { ...change, name: `${packageNames.get(value.predecessorId as string) ?? "Removed package"} blocks ${packageNames.get(value.successorId as string) ?? "Removed package"}` };
    });
  const links = namedChanges(left.links.map(linkValue), right.links.map(linkValue), (item) => `${item.outcomeId}:${item.projectId}`)
    .map((change) => { const value = (change.to ?? change.from)!; return { ...change,
      name: `${outcomeTitles.get(value.outcomeId as string) ?? "Removed outcome"} / ${packageNames.get(`linear:${value.projectId as string}`) ?? "Removed project"}` }; });
  const linearCycles = namedChanges(left.linearCycles.map(linearCycleValue), right.linearCycles.map(linearCycleValue), (item) => item.id as string)
    .map((change) => ({ ...change, name: cycleNames.get(change.id) ?? "Removed cycle" }));
  const weeklyAvailability = namedChanges(left.weeklyAdjustments.map((week) => ({ ...week })), right.weeklyAdjustments.map((week) => ({ ...week })), (week) => week.weekStart)
    .map((change) => ({ ...change, name: `Week of ${change.id}` }));
  return {
    calculationVersions: { from: originalLeft.calculationVersion ?? "v0", to: originalRight.calculationVersion ?? "v0" },
    sourceChanged: left.forecast.sourceAt !== right.forecast.sourceAt,
    capacity: {
      from: { baseline: left.effectiveBaseline, configuredBaseline: left.capacity.baseline, reserve: left.capacity.reserve, horizon: left.capacity.horizon, baselineReason: left.capacity.baseline_reason,
        cycleAnchor: left.capacity.cycle_anchor, cycleDays: left.capacity.cycle_days, scopingLeadDays: left.capacity.scoping_lead_days ?? 14, holidaysEnabled: left.capacity.holidays_enabled },
      to: { baseline: right.effectiveBaseline, configuredBaseline: right.capacity.baseline, reserve: right.capacity.reserve, horizon: right.capacity.horizon, baselineReason: right.capacity.baseline_reason,
        cycleAnchor: right.capacity.cycle_anchor, cycleDays: right.capacity.cycle_days, scopingLeadDays: right.capacity.scoping_lead_days ?? 14, holidaysEnabled: right.capacity.holidays_enabled },
    },
    packages,
    streams: streamChanges.filter((change) => change.from && change.to),
    streamLifecycle: streamChanges.filter((change) => !change.from || !change.to),
    outcomes,
    adjustments,
    extraScopes,
    priorities,
    dependencies,
    links,
    linearCycles,
    weeklyAvailability,
  };
}

export async function compareScenarios(left: ScenarioReference, right: ScenarioReference, client?: ScenarioClient) {
  const database = await useDatabase(client);
  const [resolvedLeft, resolvedRight] = await Promise.all([resolveSnapshot(database, left), resolveSnapshot(database, right)]);
  return {
    left: { kind: resolvedLeft.kind, id: resolvedLeft.id, label: resolvedLeft.label, sourceAt: resolvedLeft.sourceAt },
    right: { kind: resolvedRight.kind, id: resolvedRight.id, label: resolvedRight.label, sourceAt: resolvedRight.sourceAt },
    ...compareSnapshots(resolvedLeft.snapshot, resolvedRight.snapshot),
  };
}

import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type { ImportedCycle, ImportedProject, LinearCycleSettings } from "./linear";

export type ProjectSyncItem = { id: string; name: string; previousName?: string; changes: string[] };
export type ImportResult = {
  imported: number;
  crossTeam: number;
  report: {
    newProjects: ProjectSyncItem[];
    updatedProjects: ProjectSyncItem[];
    newlyMissingProjects: ProjectSyncItem[];
    unchangedProjects: number;
    stillMissingProjects: number;
  };
};

const sameList = (left: string[], right: string[]) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
const timestamp = (value: Date | string | null) => value ? new Date(value).toISOString() : null;

export async function saveImport(
  client: PoolClient,
  input: { encryptedKey: string; viewer: { id: string; name: string }; team: { id: string; name: string }; projects: ImportedProject[]; cycles?: ImportedCycle[]; cycleSettings?: LinearCycleSettings },
  seenAt = new Date(),
): Promise<ImportResult> {
  await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const connection = await client.query<{ team_id: string }>("SELECT team_id FROM linear_connection WHERE workspace_id = 1 FOR UPDATE");
  if (connection.rows[0] && connection.rows[0].team_id !== input.team.id) {
    throw new Error("This proof workspace is already connected to another team.");
  }
  const importId = randomUUID();
  const importedIds = new Set(input.projects.map((project) => project.id));
  const sourceEdges = input.projects.flatMap((project) => (project.dependencies || [])
    .filter((blockedId) => importedIds.has(blockedId) && blockedId !== project.id)
    .map((blockedId) => [project.id, blockedId] as const));
  const [savedProjects, savedIssues, savedEdges] = await Promise.all([
    client.query<{ linear_id: string; name: string; description: string; status: string; url: string; source_updated_at: Date; cross_team: boolean; external_blockers: string[] | null; needs_review: boolean }>(
      "SELECT linear_id,name,description,status,url,source_updated_at,cross_team,external_blockers,needs_review FROM linear_project_cache WHERE team_id=$1", [input.team.id],
    ),
    client.query<{ linear_id: string; project_id: string; team_id: string; identifier: string; title: string; estimate: string | null; state_type: string; completed_at: Date | null; source_updated_at: Date }>(
      "SELECT linear_id,project_id,team_id,identifier,title,estimate::text,state_type,completed_at,source_updated_at FROM linear_issue_cache WHERE project_id IN (SELECT linear_id FROM linear_project_cache WHERE team_id=$1)", [input.team.id],
    ),
    client.query<{ predecessor_project_id: string; successor_project_id: string }>(`SELECT predecessor.project_id AS predecessor_project_id,successor.project_id AS successor_project_id
      FROM package_dependency dependency
      JOIN work_package predecessor ON predecessor.id=dependency.predecessor_id
      JOIN work_package successor ON successor.id=dependency.successor_id
      WHERE dependency.source='linear' AND predecessor.team_id=$1`, [input.team.id]),
  ]);
  const projectById = new Map(savedProjects.rows.map((project) => [project.linear_id, project]));
  const issueSignatures = new Map<string, string[]>();
  for (const issue of savedIssues.rows) {
    const signature = JSON.stringify([issue.linear_id, issue.team_id, issue.identifier, issue.title, issue.estimate === null ? null : Number(issue.estimate), issue.state_type,
      timestamp(issue.completed_at), timestamp(issue.source_updated_at)]);
    issueSignatures.set(issue.project_id, [...(issueSignatures.get(issue.project_id) || []), signature]);
  }
  const dependencyIds = new Map<string, string[]>();
  for (const edge of savedEdges.rows) dependencyIds.set(edge.predecessor_project_id, [...(dependencyIds.get(edge.predecessor_project_id) || []), edge.successor_project_id]);
  const report: ImportResult["report"] = { newProjects: [], updatedProjects: [], newlyMissingProjects: [], unchangedProjects: 0, stillMissingProjects: 0 };
  for (const project of input.projects) {
    const saved = projectById.get(project.id);
    if (!saved) {
      report.newProjects.push({ id: project.id, name: project.name, changes: [] });
      continue;
    }
    const changes: string[] = [];
    if (saved.name !== project.name) changes.push("name");
    if (saved.description !== project.description) changes.push("description");
    if (saved.status !== project.status) changes.push("status");
    if (saved.url !== project.url) changes.push("URL");
    if (timestamp(saved.source_updated_at) !== timestamp(project.updatedAt)) changes.push("updated timestamp");
    if (saved.cross_team !== project.crossTeam) changes.push("cross-team scope");
    if (!sameList(saved.external_blockers || [], (project.blockedBy || []).filter((id) => !importedIds.has(id)))) changes.push("external blockers");
    const incomingIssues = project.issues.map((issue) => JSON.stringify([issue.id, issue.teamId, issue.identifier, issue.title, issue.estimate, issue.stateType,
      timestamp(issue.completedAt), timestamp(issue.updatedAt)]));
    if (!sameList(issueSignatures.get(project.id) || [], incomingIssues)) changes.push("issues");
    const incomingDependencies = sourceEdges.filter(([projectId]) => projectId === project.id).map(([, blockedId]) => blockedId);
    if (!sameList(dependencyIds.get(project.id) || [], incomingDependencies)) changes.push("dependencies");
    if (changes.length) report.updatedProjects.push({ id: project.id, name: project.name, previousName: saved.name !== project.name ? saved.name : undefined, changes });
    else report.unchangedProjects += 1;
  }
  for (const saved of savedProjects.rows.filter((project) => !importedIds.has(project.linear_id))) {
    if (saved.needs_review) report.stillMissingProjects += 1;
    else report.newlyMissingProjects.push({ id: saved.linear_id, name: saved.name, changes: ["missing from Linear"] });
  }
  for (const project of input.projects) {
    await client.query(`
      INSERT INTO linear_project_cache (linear_id, team_id, name, description, status, url, source_updated_at, last_seen_at, last_seen_import_id, cross_team, external_blockers)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (linear_id) DO UPDATE SET
        name=EXCLUDED.name, description=EXCLUDED.description, status=EXCLUDED.status,
        url=EXCLUDED.url, source_updated_at=EXCLUDED.source_updated_at,
        last_seen_at=EXCLUDED.last_seen_at, last_seen_import_id=EXCLUDED.last_seen_import_id,
        needs_review=false, cross_team=EXCLUDED.cross_team, external_blockers=EXCLUDED.external_blockers`,
      [project.id, input.team.id, project.name, project.description, project.status, project.url, project.updatedAt, seenAt, importId, project.crossTeam,
        (project.blockedBy || []).filter((id) => !importedIds.has(id))],
    );
    // A single stable package per project prevents a project linked to two outcomes
    // from acquiring two copies of its eventual demand.
    await client.query(`INSERT INTO work_package (id, project_id, team_id)
      VALUES ($1,$2,$3) ON CONFLICT (project_id) DO NOTHING`, [`linear:${project.id}`, project.id, input.team.id]);
    for (const issue of project.issues) {
      await client.query(`
        INSERT INTO linear_issue_cache (linear_id, project_id, team_id, identifier, title, estimate, state_type, completed_at, source_updated_at, last_seen_at, last_seen_import_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (linear_id) DO UPDATE SET
          project_id=EXCLUDED.project_id, team_id=EXCLUDED.team_id, identifier=EXCLUDED.identifier,
          title=EXCLUDED.title, estimate=EXCLUDED.estimate, state_type=EXCLUDED.state_type,
          completed_at=EXCLUDED.completed_at, source_updated_at=EXCLUDED.source_updated_at,
          last_seen_at=EXCLUDED.last_seen_at, last_seen_import_id=EXCLUDED.last_seen_import_id`,
        [issue.id, issue.projectId, issue.teamId, issue.identifier, issue.title, issue.estimate, issue.stateType, issue.completedAt, issue.updatedAt, seenAt, importId],
      );
    }
    await client.query("DELETE FROM linear_issue_cache WHERE project_id=$1 AND last_seen_import_id <> $2", [project.id, importId]);
  }
  // Replace only Linear-sourced edges. Local planning dependencies are independent,
  // and a waiver on an unchanged source edge survives the import.
  for (const [predecessor, successor] of sourceEdges) {
    await client.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES($1,$2,'linear') ON CONFLICT DO NOTHING", [`linear:${predecessor}`, `linear:${successor}`]);
  }
  const existingEdges = await client.query<{ predecessor_id: string; successor_id: string }>("SELECT predecessor_id,successor_id FROM package_dependency WHERE source='linear'");
  const currentEdges = new Set(sourceEdges.map(([a, b]) => `linear:${a}\0linear:${b}`));
  for (const edge of existingEdges.rows) if (!currentEdges.has(`${edge.predecessor_id}\0${edge.successor_id}`)) {
    await client.query("DELETE FROM package_dependency WHERE predecessor_id=$1 AND successor_id=$2 AND source='linear'", [edge.predecessor_id, edge.successor_id]);
  }
  if (input.cycles) await saveCycleData(client, input.team.id, input.cycles, seenAt, importId);
  await client.query("UPDATE linear_project_cache SET needs_review=true WHERE team_id=$1 AND last_seen_import_id <> $2", [input.team.id, importId]);
  const settings = input.cycleSettings;
  await client.query(`INSERT INTO linear_connection (workspace_id, encrypted_key, viewer_id, viewer_name, team_id, team_name, last_imported_at,cycles_refreshed_at,team_timezone,cycles_enabled,cycle_duration,cycle_start_day,cycle_cooldown_time,upcoming_cycle_count)
    VALUES (1,$1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (workspace_id) DO UPDATE SET encrypted_key=EXCLUDED.encrypted_key,
      viewer_id=EXCLUDED.viewer_id, viewer_name=EXCLUDED.viewer_name,
      team_name=EXCLUDED.team_name, last_imported_at=EXCLUDED.last_imported_at,cycles_refreshed_at=EXCLUDED.cycles_refreshed_at,
      team_timezone=EXCLUDED.team_timezone,cycles_enabled=EXCLUDED.cycles_enabled,
      cycle_duration=EXCLUDED.cycle_duration,cycle_start_day=EXCLUDED.cycle_start_day,
      cycle_cooldown_time=EXCLUDED.cycle_cooldown_time,upcoming_cycle_count=EXCLUDED.upcoming_cycle_count`,
    [input.encryptedKey, input.viewer.id, input.viewer.name, input.team.id, input.team.name, seenAt,
      settings?.timezone ?? "America/New_York", settings?.cyclesEnabled ?? false, settings?.cycleDuration ?? null,
      settings?.cycleStartDay ?? null, settings?.cycleCooldownTime ?? null, settings?.upcomingCycleCount ?? null]);
  if (settings?.timezone) await client.query("UPDATE workspace SET timezone=$1 WHERE id=1", [settings.timezone]);
  return { imported: input.projects.length, crossTeam: input.projects.filter((project) => project.crossTeam).length, report };
}

export async function saveCycleData(client: PoolClient, teamId: string, cycles: ImportedCycle[], seenAt: Date, importId = randomUUID()): Promise<void> {
  await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  for (const cycle of cycles) {
    if (cycle.teamId !== teamId) throw new Error("Cycle belongs to another Linear team.");
    await client.query(`INSERT INTO linear_cycle_cache(linear_id,team_id,number,name,starts_at,ends_at,completed_at,last_seen_import_id,active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,true) ON CONFLICT(linear_id) DO UPDATE SET
      number=EXCLUDED.number,name=EXCLUDED.name,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,
      completed_at=EXCLUDED.completed_at,last_seen_import_id=EXCLUDED.last_seen_import_id,active=true`,
    [cycle.id, cycle.teamId, cycle.number, cycle.name, cycle.startsAt, cycle.endsAt, cycle.completedAt, importId]);
    if (cycle.completedAt && cycle.completedPoints !== null) {
      await client.query(`INSERT INTO cycle_observation(linear_id,team_id,starts_at,ends_at,completed_at,cycle_days,completed_points)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(linear_id) DO UPDATE SET
        starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,completed_at=EXCLUDED.completed_at,
        cycle_days=EXCLUDED.cycle_days,completed_points=EXCLUDED.completed_points`,
      [cycle.id, cycle.teamId, cycle.startsAt, cycle.endsAt, cycle.completedAt, cycle.cycleDays, cycle.completedPoints]);
    }
  }
  await client.query("UPDATE linear_cycle_cache SET active=false WHERE team_id=$1 AND last_seen_import_id<>$2", [teamId, importId]);
  const future = cycles.filter((cycle) => cycle.startsAt.getTime() > seenAt.getTime() && !cycle.completedAt)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const migration = await client.query<{ legacy_cycles_migrated: boolean }>("SELECT legacy_cycles_migrated FROM workspace WHERE id=1 FOR UPDATE");
  if (!migration.rows[0]?.legacy_cycles_migrated && future.length) {
    const legacy = await client.query<{ cycle_anchor: string | null; cycle_days: number | null; timezone: string; last_imported_at: Date | null }>(`
      SELECT p.cycle_anchor::text,p.cycle_days,w.timezone,l.last_imported_at FROM workspace w
      LEFT JOIN capacity_profile p ON p.workspace_id=w.id LEFT JOIN linear_connection l ON l.workspace_id=w.id WHERE w.id=1`);
    const old = legacy.rows[0];
    const localDay = (timestamp: Date, timezone: string) => new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(timestamp);
    const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
    const sourceDay = old?.last_imported_at ? localDay(old.last_imported_at, old.timezone) : null;
    const firstOffset = old?.cycle_anchor && old.cycle_days && sourceDay
      ? Math.max(0, Math.floor((Date.parse(`${sourceDay}T00:00:00Z`) - Date.parse(`${old.cycle_anchor}T00:00:00Z`)) / (old.cycle_days * 86400000)) + 1)
      : null;
    const firstOldCycle = firstOffset !== null && old?.cycle_anchor && old.cycle_days ? addDays(old.cycle_anchor, firstOffset * old.cycle_days) : null;
    const matchOldCycle = (number: number | null) => {
      if (!number || !firstOldCycle || !old?.cycle_days) return undefined;
      const oldDate = addDays(firstOldCycle, (number - 1) * old.cycle_days);
      return future.find((cycle) => localDay(cycle.startsAt, old.timezone) === oldDate && cycle.cycleDays === old.cycle_days);
    };
    const oldAdjustments = await client.query<{ cycle_number: number; availability: string; reserve: string | null }>("SELECT cycle_number,availability,reserve FROM cycle_adjustment");
    for (const old of oldAdjustments.rows) {
      const mapped = matchOldCycle(old.cycle_number);
      if (mapped) {
        await client.query("INSERT INTO linear_cycle_adjustment(linear_cycle_id,availability,reserve) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [mapped.id, old.availability, old.reserve]);
        await client.query("DELETE FROM cycle_adjustment WHERE cycle_number=$1", [old.cycle_number]);
      }
    }
    const oldStarts = await client.query<{ id: string; earliest_cycle: number | null; preferred_cycle: number | null }>("SELECT id,earliest_cycle,preferred_cycle FROM work_package WHERE earliest_linear_cycle_id IS NULL OR preferred_linear_cycle_id IS NULL");
    for (const old of oldStarts.rows) {
      const earliestId = matchOldCycle(old.earliest_cycle)?.id ?? null;
      const preferredId = matchOldCycle(old.preferred_cycle)?.id ?? null;
      await client.query(`UPDATE work_package SET earliest_linear_cycle_id=COALESCE(earliest_linear_cycle_id,$2),
        preferred_linear_cycle_id=COALESCE(preferred_linear_cycle_id,$3),
        earliest_cycle=CASE WHEN $2::text IS NOT NULL THEN NULL ELSE earliest_cycle END,
        preferred_cycle=CASE WHEN $3::text IS NOT NULL THEN NULL ELSE preferred_cycle END WHERE id=$1`,
      [old.id, earliestId, preferredId]);
    }
    await client.query("UPDATE workspace SET legacy_cycles_migrated=true WHERE id=1");
  }
}

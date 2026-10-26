import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { completionEvidence, evidenceHash, type CompletionEvidence, type CompletionProject, type OutcomeLifecycle } from "./outcome-completion";
import type { EffectiveEdge } from "./delivery-scope";
import { HttpError } from "./security";
type Client = Pick<PoolClient, "query">;
type Marker = { outcome_id: string; completed_at: Date | string | null; lifecycle_version: string | number; scope_signature: string | null; review_needed: boolean; review_reasons: string[] };
const iso = (value: Date | string | null) => value ? new Date(value).toISOString() : null;

async function lifecycleContext(client: Client) {
  const [outcomes, projects, links, dependencies, markers] = await Promise.all([
    client.query<{ id: string }>("SELECT id FROM outcome ORDER BY id"),
    client.query<CompletionProject>(`SELECT w.id,p.name,p.status,p.needs_review AS "needsReview",p.cross_team AS "crossTeam",p.external_blockers AS "externalBlockers",
      (SELECT COUNT(*)::integer FROM linear_issue_cache i WHERE i.project_id=w.project_id AND i.state_type NOT IN ('completed','canceled')) AS "openIssueCount",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.linear_id,'stateType',i.state_type,'estimate',i.estimate) ORDER BY i.linear_id)
        FROM linear_issue_cache i WHERE i.project_id=w.project_id AND i.state_type NOT IN ('completed','canceled')),'[]'::jsonb) AS "openIssues",
      (SELECT jsonb_build_object('points',e.points::float,'issueIds',e.issue_ids) FROM package_extra_scope e WHERE e.package_id=w.id) AS "extraScope"
      FROM work_package w JOIN linear_project_cache p ON p.linear_id=w.project_id ORDER BY w.id`),
    client.query<{ outcome_id: string; project_id: string; requirement: "minimum" | "optional" }>("SELECT outcome_id,project_id,requirement FROM outcome_project_link ORDER BY outcome_id,project_id"),
    client.query<EffectiveEdge>('SELECT predecessor_id AS "predecessorId",successor_id AS "successorId",waived FROM package_dependency ORDER BY predecessor_id,successor_id,source'),
    client.query<Marker>("SELECT outcome_id,completed_at,lifecycle_version,scope_signature,review_needed,review_reasons FROM outcome_lifecycle ORDER BY outcome_id"),
  ]);
  const source = new Map(projects.rows.map((item) => [item.id, item]));
  const saved = new Map(markers.rows.map((item) => [item.outcome_id, item]));
  const byOutcome = new Map<string, { projectId: string; requirement: "minimum" | "optional" }[]>();
  for (const link of links.rows) byOutcome.set(link.outcome_id, [...(byOutcome.get(link.outcome_id) ?? []), { projectId: link.project_id, requirement: link.requirement }]);
  return { ids: outcomes.rows.map((item) => item.id), saved,
    evidence: (id: string) => completionEvidence(byOutcome.get(id) ?? [], source, dependencies.rows) };
}

function reviewReasons(evidence: CompletionEvidence, marker?: Marker) {
  if (!marker?.completed_at) return [];
  return [...new Set([...(marker.review_reasons ?? []), ...(marker.scope_signature !== evidence.scopeSignature ? ["Required delivery scope changed after completion."] : []), ...evidence.reasons])];
}

function lifecycle(id: string, evidence: CompletionEvidence, marker?: Marker): OutcomeLifecycle {
  const completedAt = iso(marker?.completed_at ?? null), lifecycleVersion = Number(marker?.lifecycle_version ?? 0);
  const reasons = reviewReasons(evidence, marker);
  const { evidenceSignature, ...publicEvidence } = evidence;
  return { ...publicEvidence, outcomeId: id, completedAt, lifecycleVersion, completedScopeSignature: marker?.scope_signature ?? null,
    reviewNeeded: !!completedAt && (!!marker?.review_needed || reasons.length > 0), reviewReasons: reasons,
    eligibilityToken: evidenceHash({ outcomeId: id, scopeSignature: evidence.scopeSignature, evidenceSignature, lifecycleVersion,
      completedAt, completedScopeSignature: marker?.scope_signature ?? null, reviewNeeded: marker?.review_needed ?? false }) };
}

/** Read-only, independent of forecasts. Absent definitions never become rows
 * merely because a workspace business-history record still exists. */
export async function getOutcomeLifecycles(client: Client): Promise<Map<string, OutcomeLifecycle>> {
  const context = await lifecycleContext(client);
  return new Map(context.ids.map((id) => [id, lifecycle(id, context.evidence(id), context.saved.get(id))]));
}

/** Call after the final relevant write, inside its workspace-locked transaction.
 * Latch the first review event once; subsequent refreshes cannot erase it. */
export async function reconcileOutcomeCompletions(client: Client, actor = "Owner", outcomeIds?: string[]) {
  await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const completed = await client.query<{ outcome_id: string }>(`SELECT l.outcome_id FROM outcome_lifecycle l LEFT JOIN outcome o ON o.id=l.outcome_id
    WHERE l.completed_at IS NOT NULL AND NOT l.review_needed${outcomeIds ? " AND l.outcome_id=ANY($1::uuid[])" : " AND o.id IS NOT NULL"}`, outcomeIds ? [outcomeIds] : []);
  if (!completed.rowCount) return;
  const context = await lifecycleContext(client);
  for (const { outcome_id: id } of completed.rows) {
    const marker = context.saved.get(id)!; const evidence = context.evidence(id);
    const definitionRemoved = !context.ids.includes(id);
    const reasons = definitionRemoved ? ["Planning definition was removed after completion; review its restored scope before recording completion again."] : reviewReasons(evidence, marker);
    if (!reasons.length) continue;
    const version = Number(marker.lifecycle_version) + 1;
    await client.query("UPDATE outcome_lifecycle SET review_needed=true,review_reasons=$2::jsonb,lifecycle_version=$3,updated_at=now() WHERE outcome_id=$1", [id, JSON.stringify(reasons), version]);
    await client.query(`INSERT INTO outcome_lifecycle_event(id,outcome_id,action,actor,lifecycle_version,payload)
      VALUES($1,$2,'review',$3,$4,$5::jsonb)`, [randomUUID(), id, actor, version, JSON.stringify({ reasons, completedAt: iso(marker.completed_at), completedScopeSignature: marker.scope_signature, scopeSignature: evidence.scopeSignature, requiredIds: evidence.requiredIds, definitionRemoved })]);
  }
}

export async function saveOutcomeCompletion(client: Client, id: string, input: unknown) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(400, "Invalid outcome ID.");
  id = id.toLowerCase();
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpError(400, "Invalid outcome completion action.");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["completed", "expectedLifecycleVersion", "eligibilityToken"].includes(key))) throw new HttpError(400, "Completion actions do not save metadata or project links.");
  if (typeof body.completed !== "boolean" || !Number.isSafeInteger(body.expectedLifecycleVersion) || (body.expectedLifecycleVersion as number) < 0) throw new HttpError(400, "Choose complete/reopen and provide the displayed lifecycle version.");
  await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const context = await lifecycleContext(client);
  if (!context.ids.includes(id)) throw new HttpError(404, "Outcome not found.");
  const evidence = context.evidence(id), marker = context.saved.get(id), current = lifecycle(id, evidence, marker);
  if (body.expectedLifecycleVersion !== current.lifecycleVersion || typeof body.eligibilityToken !== "string" || body.eligibilityToken !== current.eligibilityToken) throw new HttpError(409, "Completion evidence or lifecycle state changed. Refresh the outcome and review the current evidence.", { code: "OUTCOME_EVIDENCE_CONFLICT", lifecycle: current });
  if (body.completed && current.completedAt) throw new HttpError(409, "This outcome is already completed. Reopen it before recording a new completion.", { code: "OUTCOME_ALREADY_COMPLETED", lifecycle: current });
  if (!body.completed && !current.completedAt) throw new HttpError(409, "This outcome is already open.", { code: "OUTCOME_ALREADY_OPEN", lifecycle: current });
  if (body.completed && !evidence.ready) throw new HttpError(422, "Required work is not actually complete. Review the completion evidence.", { code: "OUTCOME_NOT_READY", lifecycle: current });
  const version = current.lifecycleVersion + 1;
  const result = await client.query(`INSERT INTO outcome_lifecycle(outcome_id,completed_at,lifecycle_version,scope_signature,review_needed,review_reasons)
    VALUES($1,CASE WHEN $2 THEN now() ELSE NULL END,$3,$4,false,'[]')
    ON CONFLICT(outcome_id) DO UPDATE SET completed_at=EXCLUDED.completed_at,lifecycle_version=EXCLUDED.lifecycle_version,
      scope_signature=EXCLUDED.scope_signature,review_needed=false,review_reasons='[]',updated_at=now()
    WHERE outcome_lifecycle.lifecycle_version=$5 RETURNING outcome_id`, [id, body.completed, version, body.completed ? evidence.scopeSignature : null, current.lifecycleVersion]);
  if (!result.rowCount) throw new HttpError(409, "Lifecycle state changed. Refresh the outcome.", { code: "OUTCOME_EVIDENCE_CONFLICT" });
  await client.query(`INSERT INTO outcome_lifecycle_event(id,outcome_id,action,actor,lifecycle_version,payload)
    VALUES($1,$2,$3,'Owner',$4,$5::jsonb)`, [randomUUID(), id, body.completed ? "complete" : "reopen", version,
    JSON.stringify({ previousCompletedAt: current.completedAt, previousScopeSignature: current.completedScopeSignature, scopeSignature: evidence.scopeSignature,
      evidenceSignature: evidence.evidenceSignature, directRequiredIds: evidence.directRequiredIds, requiredIds: evidence.requiredIds })]);
  const accepted = (await getOutcomeLifecycles(client)).get(id)!;
  return { saved: true, lifecycle: accepted };
}

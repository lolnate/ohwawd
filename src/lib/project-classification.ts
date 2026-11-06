import type { PoolClient } from "pg";
import { HttpError } from "./security";
import { requirePlanningToken } from "./planning-token";

type Client = Pick<PoolClient, "query">;

export type ProjectClassification = "roadmap" | "ongoing";
export type EffectiveProjectClassification = ProjectClassification | "unresolved";
export type ClassificationProvenance = "linear-label" | "local-decision" | "unresolved";
export type ProjectLabel = { id: string; name: string };

export type ProjectClassificationResolution = {
  classification: EffectiveProjectClassification;
  provenance: ClassificationProvenance;
  roadmapLabelIds: string[];
  ongoingLabelIds: string[];
};

export type StoredProjectClassification = ProjectClassificationResolution & {
  packageId: string;
  projectId: string;
  localClassification: ProjectClassification | null;
  localClassificationUpdatedAt: Date | null;
  localClassificationUpdatedBy: string | null;
};

export function resolveProjectClassification(
  labels: readonly ProjectLabel[],
  localDecision: ProjectClassification | null,
): ProjectClassificationResolution {
  const roadmapLabelIds = [...new Set(labels.filter((label) => label.name === "Roadmap").map((label) => label.id))].sort();
  const ongoingLabelIds = [...new Set(labels.filter((label) => label.name === "Ongoing").map((label) => label.id))].sort();
  if (roadmapLabelIds.length > 0 && ongoingLabelIds.length === 0) {
    return { classification: "roadmap", provenance: "linear-label", roadmapLabelIds, ongoingLabelIds };
  }
  if (ongoingLabelIds.length > 0 && roadmapLabelIds.length === 0) {
    return { classification: "ongoing", provenance: "linear-label", roadmapLabelIds, ongoingLabelIds };
  }
  return {
    classification: localDecision ?? "unresolved",
    provenance: localDecision ? "local-decision" : "unresolved",
    roadmapLabelIds,
    ongoingLabelIds,
  };
}

export async function projectClassificationState(client: Client, projectIds?: readonly string[]): Promise<Map<string, StoredProjectClassification>> {
  const enabled = (await client.query<{ enabled: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='package_local_classification') AS enabled",
  )).rows[0]?.enabled ?? false;
  const packages = await client.query<{
    id: string; project_id: string; local_classification: ProjectClassification | null;
    local_classification_updated_at: Date | null; local_classification_updated_by: string | null;
  }>(`SELECT id,project_id,local_classification,local_classification_updated_at,local_classification_updated_by
    FROM work_package WHERE ($1::text[] IS NULL OR project_id=ANY($1::text[])) ORDER BY project_id`, [projectIds ? [...projectIds] : null]);
  const labels = await client.query<{ project_id: string; label_id: string; name: string }>(`SELECT project_id,label_id,name
    FROM linear_project_label_cache WHERE ($1::text[] IS NULL OR project_id=ANY($1::text[])) ORDER BY project_id,label_id`, [projectIds ? [...projectIds] : null]);
  const labelsByProject = new Map<string, ProjectLabel[]>();
  for (const label of labels.rows) labelsByProject.set(label.project_id, [...(labelsByProject.get(label.project_id) ?? []), { id: label.label_id, name: label.name }]);
  return new Map(packages.rows.map((item) => {
    const resolution = enabled ? resolveProjectClassification(labelsByProject.get(item.project_id) ?? [], item.local_classification) : {
      classification: "roadmap" as const, provenance: "local-decision" as const, roadmapLabelIds: [], ongoingLabelIds: [],
    };
    return [item.project_id, { packageId: item.id, projectId: item.project_id, localClassification: item.local_classification,
      localClassificationUpdatedAt: item.local_classification_updated_at, localClassificationUpdatedBy: item.local_classification_updated_by, ...resolution }];
  }));
}

export async function reconcileProjectClassifications(client: Client, projectIds?: readonly string[]): Promise<Map<string, StoredProjectClassification>> {
  const state = await projectClassificationState(client, projectIds);
  for (const item of state.values()) {
    if (item.classification === "roadmap") {
      await client.query(`UPDATE work_package SET roadmap_state='candidate',selected=false,stream_id=NULL,capacity_outcome_id=NULL,sequence_position=NULL
        WHERE id=$1 AND roadmap_state IS NULL`, [item.packageId]);
    } else {
      await client.query(`UPDATE work_package SET roadmap_state=NULL,selected=false,stream_id=NULL,capacity_outcome_id=NULL,sequence_position=NULL
        WHERE id=$1 AND (roadmap_state IS NOT NULL OR selected OR stream_id IS NOT NULL OR capacity_outcome_id IS NOT NULL OR sequence_position IS NOT NULL)`, [item.packageId]);
    }
  }
  return state;
}

export async function saveLocalProjectClassification(client: Client, input: { projectId?: unknown; classification?: unknown; planningToken?: unknown }) {
  await requirePlanningToken(client, input.planningToken);
  if (typeof input.projectId !== "string") throw new HttpError(400, "Choose a project.");
  if (input.classification !== "roadmap" && input.classification !== "ongoing") throw new HttpError(400, "Choose Roadmap or Ongoing.");
  const updated = await client.query(`UPDATE work_package SET local_classification=$2,local_classification_updated_at=now(),local_classification_updated_by='Owner'
    WHERE project_id=$1 RETURNING id`, [input.projectId, input.classification]);
  if (!updated.rowCount) throw new HttpError(404, "Imported project not found.");
  const state = await reconcileProjectClassifications(client, [input.projectId]);
  return state.get(input.projectId)!;
}

export const projectClassificationSchemaSql = `
  CREATE TABLE IF NOT EXISTS linear_project_label_cache (
    project_id text NOT NULL REFERENCES linear_project_cache(linear_id) ON DELETE CASCADE,
    label_id text NOT NULL,
    name text NOT NULL,
    PRIMARY KEY (project_id,label_id)
  );
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS local_classification text;
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS local_classification_updated_at timestamptz;
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS local_classification_updated_by text;
`;

export const projectClassificationMigrationSql = projectClassificationSchemaSql + `
  UPDATE work_package SET
    local_classification='roadmap',
    local_classification_updated_at=now(),
    local_classification_updated_by='Migration';
  ALTER TABLE work_package ADD CONSTRAINT package_local_classification CHECK (
    (local_classification IS NULL AND local_classification_updated_at IS NULL AND local_classification_updated_by IS NULL) OR
    (local_classification IS NOT NULL AND local_classification IN ('roadmap','ongoing') AND
      local_classification_updated_at IS NOT NULL AND local_classification_updated_by IS NOT NULL AND
      length(trim(local_classification_updated_by))>0)
  );
  ALTER TABLE work_package ALTER COLUMN roadmap_state DROP NOT NULL;
  ALTER TABLE work_package ALTER COLUMN roadmap_state DROP DEFAULT;
  ALTER TABLE work_package DROP CONSTRAINT package_roadmap_membership;
  ALTER TABLE work_package ADD CONSTRAINT package_roadmap_membership CHECK (
    (roadmap_state IS NULL AND NOT selected AND stream_id IS NULL AND capacity_outcome_id IS NULL AND sequence_position IS NULL) OR
    (roadmap_state IS NOT NULL AND (
      (roadmap_state='included' AND selected AND stream_id IS NOT NULL AND capacity_outcome_id IS NOT NULL) OR
      (roadmap_state='deferred' AND NOT selected AND ((stream_id IS NULL AND capacity_outcome_id IS NULL) OR (stream_id IS NOT NULL AND capacity_outcome_id IS NOT NULL))) OR
      (roadmap_state IN ('candidate','dismissed') AND NOT selected AND stream_id IS NULL AND capacity_outcome_id IS NULL)
    ))
  );
`;

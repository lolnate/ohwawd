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

export const projectClassificationMigrationSql = `
  CREATE TABLE linear_project_label_cache (
    project_id text NOT NULL REFERENCES linear_project_cache(linear_id) ON DELETE CASCADE,
    label_id text NOT NULL,
    name text NOT NULL,
    PRIMARY KEY (project_id,label_id)
  );
  ALTER TABLE work_package ADD COLUMN local_classification text;
  ALTER TABLE work_package ADD COLUMN local_classification_updated_at timestamptz;
  ALTER TABLE work_package ADD COLUMN local_classification_updated_by text;
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

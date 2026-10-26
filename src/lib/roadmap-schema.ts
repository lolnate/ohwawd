// Additive foundation. Activation waits for the coordinated v5 writer migration;
// NULL membership/rank denotes pre-conversion inputs, not a v5 candidate.
export const roadmapSchemaSql = `
  ALTER TABLE workspace ADD COLUMN IF NOT EXISTS roadmap_planning_migrated boolean NOT NULL DEFAULT false;
  ALTER TABLE outcome ADD COLUMN IF NOT EXISTS stream_position integer;
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS roadmap_state text;
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS roadmap_conversion jsonb;
  DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='outcome_stream_position_positive') THEN
      ALTER TABLE outcome ADD CONSTRAINT outcome_stream_position_positive CHECK(stream_position IS NULL OR (stream_id IS NOT NULL AND stream_position>0));
      ALTER TABLE outcome ADD CONSTRAINT outcome_stream_position_key UNIQUE(stream_id,stream_position) DEFERRABLE INITIALLY IMMEDIATE;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='package_roadmap_membership') THEN
      ALTER TABLE work_package ADD CONSTRAINT package_roadmap_membership CHECK (
        roadmap_state IS NULL OR
        (roadmap_state='included' AND selected AND stream_id IS NOT NULL AND capacity_outcome_id IS NOT NULL) OR
        (roadmap_state='deferred' AND NOT selected AND ((stream_id IS NULL AND capacity_outcome_id IS NULL) OR (stream_id IS NOT NULL AND capacity_outcome_id IS NOT NULL))) OR
        (roadmap_state IN ('candidate','dismissed') AND NOT selected AND stream_id IS NULL AND capacity_outcome_id IS NULL)
      );
    END IF;
  END $$;
  CREATE TABLE IF NOT EXISTS outcome_lifecycle (
    outcome_id uuid PRIMARY KEY,
    completed_at timestamptz,
    lifecycle_version bigint NOT NULL CHECK(lifecycle_version>0),
    scope_signature text,
    review_needed boolean NOT NULL DEFAULT false,
    review_reasons jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(review_reasons)='array'),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((completed_at IS NULL AND scope_signature IS NULL AND NOT review_needed) OR
      (completed_at IS NOT NULL AND scope_signature IS NOT NULL AND length(trim(scope_signature))>0))
  );
  CREATE TABLE IF NOT EXISTS outcome_lifecycle_event (
    id uuid PRIMARY KEY,
    outcome_id uuid NOT NULL REFERENCES outcome_lifecycle(outcome_id) ON DELETE RESTRICT,
    action text NOT NULL CHECK(action IN ('complete','reopen','review')),
    actor text NOT NULL CHECK(length(trim(actor))>0),
    lifecycle_version bigint NOT NULL CHECK(lifecycle_version>0),
    payload jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(payload)='object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(outcome_id,lifecycle_version)
  );
`;

// Called only after backfill, within the same activation transaction.
export const activateRoadmapConstraintsSql = `
  DO $$ BEGIN
    ALTER TABLE work_package ALTER COLUMN roadmap_state SET DEFAULT 'candidate';
    ALTER TABLE work_package ALTER COLUMN roadmap_state SET NOT NULL;
    ALTER TABLE work_package ALTER COLUMN selected SET DEFAULT false;
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='outcome_rank_matches_placement') THEN
      ALTER TABLE outcome ADD CONSTRAINT outcome_rank_matches_placement
        CHECK ((stream_id IS NULL AND stream_position IS NULL) OR (stream_id IS NOT NULL AND stream_position IS NOT NULL));
    END IF;
  END $$;
`;

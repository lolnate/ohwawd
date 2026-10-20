export const outcomeOwnershipSchemaSql = `
  ALTER TABLE outcome ADD COLUMN IF NOT EXISTS stream_id text REFERENCES stream(id);
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS capacity_outcome_id uuid;
  DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='package_capacity_outcome_link') THEN
      ALTER TABLE work_package ADD CONSTRAINT package_capacity_outcome_link
        FOREIGN KEY(capacity_outcome_id,project_id) REFERENCES outcome_project_link(outcome_id,project_id)
        ON DELETE SET NULL (capacity_outcome_id);
    END IF;
  END $$;
`;

// Run once through the migration ledger. Never move existing work or rewrite scenario JSON.
export const outcomeOwnershipMigrationSql = outcomeOwnershipSchemaSql + `
  UPDATE outcome o SET stream_id=(
    SELECT w.stream_id FROM outcome_project_link l JOIN work_package w ON w.project_id=l.project_id
      JOIN stream s ON s.id=w.stream_id AND s.active
    WHERE l.outcome_id=o.id AND w.selected
    GROUP BY w.stream_id,s.position ORDER BY count(*) DESC,s.position,w.stream_id LIMIT 1
  );
  UPDATE work_package w SET capacity_outcome_id=(
    SELECT o.id FROM outcome_project_link l JOIN outcome o ON o.id=l.outcome_id
    WHERE l.project_id=w.project_id AND o.stream_id=w.stream_id
    ORDER BY o.created_at,o.id LIMIT 1
  ) WHERE w.selected AND w.stream_id IS NOT NULL;
`;

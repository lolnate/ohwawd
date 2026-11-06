export const linearEvidenceMigrationSql = `
  ALTER TABLE linear_issue_cache DROP CONSTRAINT linear_issue_cache_project_id_fkey;
  ALTER TABLE linear_issue_cache ALTER COLUMN project_id DROP NOT NULL;
  ALTER TABLE linear_issue_cache ADD COLUMN url text NOT NULL DEFAULT '';
  CREATE INDEX linear_issue_project_idx ON linear_issue_cache(project_id);
  CREATE TABLE linear_issue_blocker_cache (
    blocker_id text NOT NULL,
    blocked_issue_id text NOT NULL REFERENCES linear_issue_cache(linear_id) ON DELETE CASCADE,
    team_id text NOT NULL,
    last_seen_import_id uuid NOT NULL,
    PRIMARY KEY (blocker_id,blocked_issue_id),
    CHECK (blocker_id<>blocked_issue_id)
  );
  CREATE INDEX linear_issue_blocker_blocked_idx ON linear_issue_blocker_cache(blocked_issue_id);
`;

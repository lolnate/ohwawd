import { Pool, type PoolClient, type PoolConfig } from "pg";

declare global {
  // Reuse the pool across Next.js development reloads.
  // eslint-disable-next-line no-var
  var ohwawdPool: Pool | undefined;
}

export function databasePoolConfig(): PoolConfig {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sslMode = process.env.DATABASE_SSL || "disable";
  if (process.env.NODE_ENV === "production" && sslMode !== "require") {
    throw new Error("DATABASE_SSL=require is required in production");
  }
  const configuredMax = Number(process.env.DATABASE_POOL_MAX || 5);
  if (!Number.isSafeInteger(configuredMax) || configuredMax < 1 || configuredMax > 50) throw new Error("DATABASE_POOL_MAX must be an integer from 1 to 50");
  return {
    connectionString: process.env.DATABASE_URL,
    max: configuredMax,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 30_000,
    application_name: "ohwawd",
    ssl: sslMode === "require" ? { rejectUnauthorized: true } : undefined,
  };
}

export function db(): Pool {
  return (globalThis.ohwawdPool ??= new Pool(databasePoolConfig()));
}

let ready: Promise<void> | undefined;
export function ensureSchema(): Promise<void> {
  return (ready ??= verifySchema().catch((error) => {
    ready = undefined;
    throw error;
  }));
}

async function verifySchema(): Promise<void> {
  const table = await db().query<{ present: string | null }>("SELECT to_regclass('public.schema_migration')::text AS present");
  if (!table.rows[0]?.present) throw new Error("Database migrations are required. Run `npm run db:migrate` before starting the app.");
  const result = await db().query<{ version: number; name: string }>("SELECT version,name FROM schema_migration ORDER BY version");
  const valid = result.rows.length === migrations.length && result.rows.every((row, index) =>
    row.version === migrations[index].version && row.name === migrations[index].name);
  if (!valid) {
    throw new Error(`Database migration history does not match required version ${latestMigrationVersion}. Run \`npm run db:migrate\`.`);
  }
}

export const schemaSql = `
    CREATE TABLE IF NOT EXISTS workspace (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      timezone text NOT NULL DEFAULT 'America/New_York',
      legacy_cycles_migrated boolean NOT NULL DEFAULT false,
      legacy_cycle_source_at timestamptz,
      linear_sync_generation bigint NOT NULL DEFAULT 0,
      cycle_sync_generation bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS linear_connection (
      workspace_id integer PRIMARY KEY REFERENCES workspace(id),
      encrypted_key text NOT NULL,
      viewer_id text NOT NULL,
      viewer_name text NOT NULL,
      team_id text NOT NULL,
      team_name text NOT NULL,
      team_timezone text NOT NULL DEFAULT 'America/New_York',
      cycles_enabled boolean NOT NULL DEFAULT false,
      cycle_duration integer,
      cycle_start_day integer,
      cycle_cooldown_time integer,
      upcoming_cycle_count integer,
      cycles_refreshed_at timestamptz,
      connected_at timestamptz NOT NULL DEFAULT now(),
      last_imported_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS linear_project_cache (
      linear_id text PRIMARY KEY,
      team_id text NOT NULL,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      status text NOT NULL,
      url text NOT NULL,
      source_updated_at timestamptz NOT NULL,
      last_seen_at timestamptz NOT NULL,
      last_seen_import_id uuid NOT NULL,
      needs_review boolean NOT NULL DEFAULT false,
      in_scope boolean NOT NULL DEFAULT true,
      cross_team boolean NOT NULL DEFAULT false,
      external_blockers text[] NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS linear_issue_cache (
      linear_id text PRIMARY KEY,
      project_id text NOT NULL REFERENCES linear_project_cache(linear_id),
      team_id text NOT NULL,
      identifier text NOT NULL,
      title text NOT NULL,
      estimate numeric,
      state_type text NOT NULL,
      completed_at timestamptz,
      source_updated_at timestamptz NOT NULL,
      last_seen_at timestamptz NOT NULL,
      last_seen_import_id uuid NOT NULL
    );
    CREATE TABLE IF NOT EXISTS work_package (
      id text PRIMARY KEY,
      project_id text NOT NULL UNIQUE REFERENCES linear_project_cache(linear_id),
      team_id text NOT NULL,
      stream_id text,
      selected boolean NOT NULL DEFAULT true,
      must_include boolean NOT NULL DEFAULT false,
      priority_rank integer NOT NULL DEFAULT 1000,
      earliest_cycle integer,
      preferred_cycle integer,
      earliest_linear_cycle_id text,
      preferred_linear_cycle_id text,
      pause_reason text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS stream (
      id text PRIMARY KEY,
      name text NOT NULL,
      position integer NOT NULL,
      wip_limit integer NOT NULL DEFAULT 1,
      allocation numeric NOT NULL DEFAULT 0 CHECK (allocation >= 0 AND allocation <= 1),
      active boolean NOT NULL DEFAULT true,
      retired_at timestamptz,
      retirement_reason text NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS stream_active_position_key ON stream(position) WHERE active=true;
    CREATE UNIQUE INDEX IF NOT EXISTS stream_active_name_key ON stream(lower(name)) WHERE active=true;
    CREATE TABLE IF NOT EXISTS stream_lifecycle_event (
      id uuid PRIMARY KEY,
      stream_id text REFERENCES stream(id),
      action text NOT NULL,
      actor text NOT NULL,
      rationale text NOT NULL DEFAULT '',
      payload jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS outcome (
      id uuid PRIMARY KEY,
      title text NOT NULL,
      description text NOT NULL DEFAULT '',
      owner text NOT NULL DEFAULT '',
      success_signal text NOT NULL DEFAULT '',
      needed_by date,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS outcome_project_link (
      outcome_id uuid NOT NULL REFERENCES outcome(id) ON DELETE CASCADE,
      project_id text NOT NULL REFERENCES linear_project_cache(linear_id),
      requirement text NOT NULL DEFAULT 'minimum' CHECK (requirement IN ('minimum', 'optional')),
      PRIMARY KEY (outcome_id, project_id)
    );
    CREATE TABLE IF NOT EXISTS capacity_profile (
      workspace_id integer PRIMARY KEY REFERENCES workspace(id),
      cycle_anchor date,
      cycle_days integer NOT NULL DEFAULT 14 CHECK (cycle_days BETWEEN 1 AND 60),
      baseline numeric,
      baseline_reason text NOT NULL DEFAULT '',
      reserve numeric NOT NULL DEFAULT 0,
      horizon integer NOT NULL DEFAULT 26 CHECK (horizon BETWEEN 1 AND 104)
    );
    CREATE TABLE IF NOT EXISTS cycle_observation (
      linear_id text PRIMARY KEY,
      team_id text NOT NULL,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      completed_at timestamptz NOT NULL,
      cycle_days integer NOT NULL,
      completed_points numeric NOT NULL
    );
    CREATE TABLE IF NOT EXISTS linear_cycle_cache (
      linear_id text PRIMARY KEY,
      team_id text NOT NULL,
      number integer NOT NULL,
      name text,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      completed_at timestamptz,
      last_seen_import_id uuid NOT NULL,
      active boolean NOT NULL DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS linear_cycle_adjustment (
      linear_cycle_id text PRIMARY KEY REFERENCES linear_cycle_cache(linear_id),
      availability numeric NOT NULL DEFAULT 1 CHECK (availability >= 0 AND availability <= 1),
      reserve numeric CHECK (reserve >= 0)
    );
    CREATE TABLE IF NOT EXISTS cycle_adjustment (
      cycle_number integer PRIMARY KEY CHECK (cycle_number > 0),
      availability numeric NOT NULL DEFAULT 1 CHECK (availability >= 0 AND availability <= 1),
      reserve numeric CHECK (reserve >= 0)
    );
    CREATE TABLE IF NOT EXISTS package_allowance (
      package_id text NOT NULL REFERENCES work_package(id),
      kind text NOT NULL CHECK (kind IN ('unestimated','discovery')),
      points numeric NOT NULL CHECK (points > 0),
      issue_ids text[] NOT NULL DEFAULT '{}',
      owner text NOT NULL,
      review_date date NOT NULL,
      rationale text NOT NULL,
      PRIMARY KEY (package_id, kind)
    );
    CREATE TABLE IF NOT EXISTS package_dependency (
      predecessor_id text NOT NULL REFERENCES work_package(id),
      successor_id text NOT NULL REFERENCES work_package(id),
      source text NOT NULL CHECK (source IN ('local','linear')),
      waived boolean NOT NULL DEFAULT false,
      waiver_reason text NOT NULL DEFAULT '',
      PRIMARY KEY (predecessor_id,successor_id,source),
      CHECK (predecessor_id <> successor_id)
    );
    CREATE TABLE IF NOT EXISTS scenario (
      id uuid PRIMARY KEY,
      workspace_id integer NOT NULL REFERENCES workspace(id),
      name text NOT NULL,
      edit_version bigint NOT NULL DEFAULT 1 CHECK (edit_version > 0),
      draft_source_at timestamptz NOT NULL,
      draft_source_snapshot jsonb NOT NULL,
      draft_snapshot jsonb NOT NULL,
      archived boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (workspace_id, name)
    );
    CREATE TABLE IF NOT EXISTS scenario_revision (
      id uuid PRIMARY KEY,
      scenario_id uuid NOT NULL REFERENCES scenario(id) ON DELETE RESTRICT,
      revision_number integer NOT NULL CHECK (revision_number > 0),
      draft_edit_version bigint NOT NULL CHECK (draft_edit_version > 0),
      calculation_version text NOT NULL,
      source_at timestamptz NOT NULL,
      source_snapshot jsonb NOT NULL,
      snapshot jsonb NOT NULL,
      rationale text NOT NULL CHECK (length(trim(rationale)) > 0),
      author text NOT NULL CHECK (length(trim(author)) > 0),
      published_at timestamptz NOT NULL DEFAULT now(),
      stale_source_confirmed boolean NOT NULL DEFAULT false,
      UNIQUE (scenario_id, revision_number)
    );
    CREATE TABLE IF NOT EXISTS workspace_scenario_state (
      workspace_id integer PRIMARY KEY REFERENCES workspace(id),
      active_scenario_id uuid REFERENCES scenario(id)
    );
    CREATE TABLE IF NOT EXISTS workspace_baseline (
      workspace_id integer PRIMARY KEY REFERENCES workspace(id),
      revision_id uuid NOT NULL UNIQUE REFERENCES scenario_revision(id)
    );
    CREATE OR REPLACE FUNCTION reject_scenario_revision_change() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Published scenario revisions are immutable'; END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS immutable_scenario_revision ON scenario_revision;
    CREATE TRIGGER immutable_scenario_revision BEFORE UPDATE OR DELETE ON scenario_revision
      FOR EACH ROW EXECUTE FUNCTION reject_scenario_revision_change();
  `;

const upgradeSql = `
  ALTER TABLE scenario_revision DROP CONSTRAINT IF EXISTS scenario_revision_scenario_id_fkey;
  ALTER TABLE scenario_revision ADD CONSTRAINT scenario_revision_scenario_id_fkey
    FOREIGN KEY (scenario_id) REFERENCES scenario(id) ON DELETE RESTRICT;
  ALTER TABLE linear_project_cache ADD COLUMN IF NOT EXISTS in_scope boolean NOT NULL DEFAULT true;
  ALTER TABLE linear_project_cache ADD COLUMN IF NOT EXISTS external_blockers text[] NOT NULL DEFAULT '{}';
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS selected boolean NOT NULL DEFAULT true;
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS must_include boolean NOT NULL DEFAULT false;
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS priority_rank integer NOT NULL DEFAULT 1000;
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS earliest_cycle integer;
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS preferred_cycle integer;
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS pause_reason text NOT NULL DEFAULT '';
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS earliest_linear_cycle_id text;
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS preferred_linear_cycle_id text;
  ALTER TABLE stream ADD COLUMN IF NOT EXISTS allocation numeric NOT NULL DEFAULT 0;
  ALTER TABLE stream ADD COLUMN IF NOT EXISTS retired_at timestamptz;
  ALTER TABLE stream ADD COLUMN IF NOT EXISTS retirement_reason text NOT NULL DEFAULT '';
  ALTER TABLE stream_lifecycle_event ALTER COLUMN stream_id DROP NOT NULL;
  ALTER TABLE stream DROP CONSTRAINT IF EXISTS stream_position_key;
  CREATE UNIQUE INDEX IF NOT EXISTS stream_active_position_key ON stream(position) WHERE active=true;
  CREATE UNIQUE INDEX IF NOT EXISTS stream_active_name_key ON stream(lower(name)) WHERE active=true;
  ALTER TABLE workspace ADD COLUMN IF NOT EXISTS legacy_cycles_migrated boolean NOT NULL DEFAULT false;
  ALTER TABLE workspace ADD COLUMN IF NOT EXISTS legacy_cycle_source_at timestamptz;
  ALTER TABLE workspace ADD COLUMN IF NOT EXISTS linear_sync_generation bigint NOT NULL DEFAULT 0;
  ALTER TABLE workspace ADD COLUMN IF NOT EXISTS cycle_sync_generation bigint NOT NULL DEFAULT 0;
  ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS team_timezone text NOT NULL DEFAULT 'America/New_York';
  ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS cycles_enabled boolean NOT NULL DEFAULT false;
  ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS cycle_duration integer;
  ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS cycle_start_day integer;
  ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS cycle_cooldown_time integer;
  ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS upcoming_cycle_count integer;
  ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS cycles_refreshed_at timestamptz;
  INSERT INTO workspace (id) VALUES (1) ON CONFLICT DO NOTHING;
  INSERT INTO stream (id,name,position) VALUES
    ('stream-1','Stream 1',1),('stream-2','Stream 2',2),('stream-3','Stream 3',3),('stream-4','Stream 4',4),('stream-5','Stream 5',5)
    ON CONFLICT DO NOTHING;
`;

export const migrations = [
  { version: 1, name: "initial-schema", sql: schemaSql },
  { version: 2, name: "upgrade-existing-proof-schema", sql: upgradeSql },
] as const;

export const latestMigrationVersion = migrations.at(-1)!.version;

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function readTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await db().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

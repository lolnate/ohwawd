import { Pool, type PoolClient } from "pg";

declare global {
  // Reuse the pool across Next.js development reloads.
  // eslint-disable-next-line no-var
  var ohwawdPool: Pool | undefined;
}

export function db(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return (globalThis.ohwawdPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));
}

let ready: Promise<void> | undefined;
export function ensureSchema(): Promise<void> {
  return (ready ??= createSchema().catch((error) => {
    ready = undefined;
    throw error;
  }));
}

async function createSchema(): Promise<void> {
  await db().query(schemaSql);
  await db().query("ALTER TABLE linear_project_cache ADD COLUMN IF NOT EXISTS in_scope boolean NOT NULL DEFAULT true");
  await db().query("ALTER TABLE linear_project_cache ADD COLUMN IF NOT EXISTS external_blockers text[] NOT NULL DEFAULT '{}'");
  await db().query("ALTER TABLE work_package ADD COLUMN IF NOT EXISTS selected boolean NOT NULL DEFAULT true");
  await db().query("ALTER TABLE work_package ADD COLUMN IF NOT EXISTS must_include boolean NOT NULL DEFAULT false");
  await db().query("ALTER TABLE work_package ADD COLUMN IF NOT EXISTS priority_rank integer NOT NULL DEFAULT 1000");
  await db().query("ALTER TABLE work_package ADD COLUMN IF NOT EXISTS earliest_cycle integer");
  await db().query("ALTER TABLE work_package ADD COLUMN IF NOT EXISTS preferred_cycle integer");
  await db().query("ALTER TABLE work_package ADD COLUMN IF NOT EXISTS pause_reason text NOT NULL DEFAULT ''");
  await db().query("ALTER TABLE work_package ADD COLUMN IF NOT EXISTS earliest_linear_cycle_id text");
  await db().query("ALTER TABLE work_package ADD COLUMN IF NOT EXISTS preferred_linear_cycle_id text");
  await db().query("ALTER TABLE stream ADD COLUMN IF NOT EXISTS allocation numeric NOT NULL DEFAULT 0");
  await db().query("ALTER TABLE workspace ADD COLUMN IF NOT EXISTS legacy_cycles_migrated boolean NOT NULL DEFAULT false");
  await db().query("ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS team_timezone text NOT NULL DEFAULT 'America/New_York'");
  await db().query("ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS cycles_enabled boolean NOT NULL DEFAULT false");
  await db().query("ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS cycle_duration integer");
  await db().query("ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS cycle_start_day integer");
  await db().query("ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS cycle_cooldown_time integer");
  await db().query("ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS upcoming_cycle_count integer");
  await db().query("ALTER TABLE linear_connection ADD COLUMN IF NOT EXISTS cycles_refreshed_at timestamptz");
  await db().query("INSERT INTO workspace (id) VALUES (1) ON CONFLICT DO NOTHING");
  for (let position = 1; position <= 5; position++) {
    await db().query(
      "INSERT INTO stream (id, name, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [`stream-${position}`, `Stream ${position}`, position],
    );
  }
}

export const schemaSql = `
    CREATE TABLE IF NOT EXISTS workspace (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      timezone text NOT NULL DEFAULT 'America/New_York',
      legacy_cycles_migrated boolean NOT NULL DEFAULT false,
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
      position integer NOT NULL UNIQUE,
      wip_limit integer NOT NULL DEFAULT 1,
      allocation numeric NOT NULL DEFAULT 0 CHECK (allocation >= 0 AND allocation <= 1),
      active boolean NOT NULL DEFAULT true
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
  `;

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

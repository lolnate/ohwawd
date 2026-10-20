import type { PoolClient } from "pg";
import { HttpError, validDateString } from "./security";
import { mondayOf } from "./planning-calendar";

export async function saveWeeklyAvailability(client: Pick<PoolClient, "query">, input: { weekStart?: unknown; availability?: unknown; label?: unknown; remove?: unknown }): Promise<void> {
  if (!validDateString(input.weekStart) || mondayOf(input.weekStart) !== input.weekStart) throw new HttpError(400, "Choose a Monday-start calendar week.");
  if (input.remove === true) { await client.query("DELETE FROM weekly_capacity_adjustment WHERE week_start=$1::date", [input.weekStart]); return; }
  if (typeof input.availability !== "number" || !Number.isFinite(input.availability) || input.availability < 0 || input.availability > 1) throw new HttpError(400, "Weekly availability must be 0–100%.");
  const label = input.label ?? "";
  if (typeof label !== "string" || label.length > 120) throw new HttpError(400, "Week label must be at most 120 characters.");
  await client.query(`INSERT INTO weekly_capacity_adjustment(week_start,availability,label) VALUES($1::date,$2,$3)
    ON CONFLICT(week_start) DO UPDATE SET availability=$2,label=$3`, [input.weekStart, input.availability, label.trim()]);
}

export async function saveHolidayPreset(client: Pick<PoolClient, "query">, enabled: unknown): Promise<void> {
  if (typeof enabled !== "boolean") throw new HttpError(400, "Choose whether to enable holiday availability.");
  await client.query(`INSERT INTO capacity_profile(workspace_id,holidays_enabled) VALUES(1,$1)
    ON CONFLICT(workspace_id) DO UPDATE SET holidays_enabled=$1`, [enabled]);
}

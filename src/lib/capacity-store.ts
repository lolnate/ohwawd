import type { PoolClient } from "pg";
import { HttpError } from "./security";

const finite = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

/** Shared by the board API and database-backed planning UI fixtures. */
export async function saveCapacityProfile(client: PoolClient, input: { baseline?: unknown; reserve?: unknown; horizon?: unknown; reason?: unknown }) {
  if ((input.baseline !== null && !finite(input.baseline, 0, 100000)) || !finite(input.reserve, 0, 100000) || !Number.isInteger(input.horizon) || !finite(input.horizon, 1, 104) || typeof input.reason !== "string" || input.reason.length > 1000) throw new HttpError(400, "Enter a baseline, reserve, and horizon.");
  const team = await client.query<{ cycle_duration: number | null }>("SELECT cycle_duration FROM linear_connection WHERE workspace_id=1");
  const cycleDays = team.rows[0]?.cycle_duration ? team.rows[0].cycle_duration * 7 : 14;
  if (input.baseline !== null && !input.reason.trim()) throw new HttpError(400, "Explain the provisional baseline or override.");
  if (input.baseline === null) {
    const observed = await client.query("SELECT 1 FROM cycle_observation WHERE cycle_days=$1 ORDER BY completed_at DESC LIMIT 3", [cycleDays]);
    if ((observed.rowCount ?? 0) < 3) throw new HttpError(400, "Fewer than three comparable completed cycles; enter a provisional baseline.");
  }
  await client.query(`INSERT INTO capacity_profile(workspace_id,cycle_days,baseline,baseline_reason,reserve,horizon) VALUES(1,$1,$2,$3,$4,$5)
    ON CONFLICT(workspace_id) DO UPDATE SET cycle_anchor=NULL,cycle_days=$1,baseline=$2,baseline_reason=$3,reserve=$4,horizon=$5`,
  [cycleDays, input.baseline, input.reason.trim(), input.reserve, input.horizon]);
}

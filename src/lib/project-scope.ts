export type ScopeIssue = { linear_id: string; project_id: string; estimate: number | null; state_type: string };
export type IssueBaseline = { id: string; estimate: number | null; open: boolean }[];
export type ExtraScope = { package_id: string; points: number; notes: string; issue_ids: string[]; issue_baseline: IssueBaseline; legacy_review: string | null };
export type ScopeReadiness = { packageId: string; status: "none" | "scheduled" | "needs_scoping" | "date_unavailable"; dueDate: string | null; review: string | null };

export const isOpenIssue = (issue: ScopeIssue) => !["completed", "canceled"].includes(issue.state_type);
export function issueBaseline(issues: ScopeIssue[]): IssueBaseline {
  return issues.map((issue) => ({ id: issue.linear_id, estimate: issue.estimate, open: isOpenIssue(issue) })).sort((a, b) => a.id.localeCompare(b.id));
}

export function scopeChangeSummary(scope: ExtraScope, issues: ScopeIssue[]): string | null {
  const current = issueBaseline(issues);
  const previous = new Map(scope.issue_baseline.map((item) => [item.id, item]));
  const currentIds = new Set(current.map((item) => item.id));
  const added = current.filter((item) => !previous.has(item.id)).length;
  const removed = scope.issue_baseline.filter((item) => !currentIds.has(item.id)).length;
  const changed = current.filter((item) => { const old = previous.get(item.id); return old && (old.estimate !== item.estimate || old.open !== item.open); }).length;
  const parts = [added ? `${added} added` : "", removed ? `${removed} removed` : "", changed ? `${changed} estimates or completion states changed` : ""].filter(Boolean);
  return parts.length ? `Linear issue scope changed: ${parts.join(", ")}. Review remaining Extra scope to avoid counting the same work twice.` : scope.legacy_review || null;
}

export function teamLocalDate(timestamp: string | Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}

/** Find the next local date boundary, including 23/25-hour DST days. */
export function millisecondsUntilNextTeamDate(now: Date, timezone: string): number {
  const today = teamLocalDate(now, timezone);
  let low = 0, high = 36 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (teamLocalDate(new Date(now.getTime() + middle), timezone) === today) low = middle;
    else high = middle;
  }
  return high;
}

export function scopeReadiness(input: { packageId: string; selected: boolean; complete: boolean; status: string; extra: boolean;
  startDate: string | null; leadDays: number; evaluatedAt: string; timezone: string; review: string | null }): ScopeReadiness {
  const result: ScopeReadiness = { packageId: input.packageId, status: "none", dueDate: null, review: input.review };
  if (!input.extra || !input.selected || input.complete) return result;
  if (input.startDate) {
    const date = new Date(`${input.startDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - input.leadDays);
    result.dueDate = date.toISOString().slice(0, 10);
    result.status = teamLocalDate(input.evaluatedAt, input.timezone) >= result.dueDate ? "needs_scoping" : "scheduled";
  } else result.status = "date_unavailable";
  if (/started|progress/i.test(input.status)) result.status = "needs_scoping";
  return result;
}

export const linearPriorityLabel = (priority: number | null | undefined) => priority === null || priority === undefined ? "Unknown" : ["No priority", "Urgent", "High", "Normal", "Low"][priority] ?? "Unknown";

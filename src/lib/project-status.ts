export function isCurrentOrFutureProjectStatus(status: string): boolean {
  const normalized = status.trim().toLocaleLowerCase().replace(/[\s_-]+/g, " ");
  return ["backlog", "todo", "to do", "planned", "in progress", "started", "active"].includes(normalized);
}

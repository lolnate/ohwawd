import assert from "node:assert/strict";
import { test } from "node:test";
import { indexCatalog, queryCatalog, type CatalogFilters } from "../src/lib/outcome-catalog";

const unrestricted: CatalogFilters = { search: "", owner: "all", stream: "all", projects: "all", targetDate: "all" };

function catalog() {
  return indexCatalog({
    outcomes: [
      { id: "one", title: "Launch API", description: "Customer migration", owner: " Engineering ", success_signal: "Adopted", needed_by: "2026-11-21", stream_id: "core", created_at: "2026-10-20T12:00:00Z" },
      { id: "two", title: "Launch API", description: "", owner: "engineering", success_signal: "", needed_by: "2026-11-22", stream_id: "delivery", created_at: "2026-10-21T12:00:00Z" },
      { id: "three", title: "Discovery", description: "", owner: "  ", success_signal: "", needed_by: null, stream_id: null, created_at: "2026-10-19T12:00:00Z" },
    ],
    projects: [
      { id: "visible", name: "API implementation", in_scope: true },
      { id: "hidden", name: "Legacy migration", in_scope: false },
    ],
    links: [
      { outcome_id: "one", project_id: "visible", requirement: "minimum" },
      { outcome_id: "one", project_id: "hidden", requirement: "optional" },
      { outcome_id: "two", project_id: "missing", requirement: "optional" },
      { outcome_id: "two", project_id: "visible", requirement: "optional" },
    ],
    streams: [{ id: "core", name: "Core" }, { id: "delivery", name: "Delivery" }],
  });
}

test("catalog indexes direct links without changing saved planning data", () => {
  const index = catalog();
  assert.deepEqual(index.owners, [{ value: "owner:engineering", label: "Engineering" }]);
  assert.deepEqual(index.rows.find((row) => row.id === "one")?.projects.map((project) => project.name), ["API implementation", "Legacy migration"]);
  assert.deepEqual(index.rows.find((row) => row.id === "two")?.projects, [
    { id: "missing", name: null, inScope: null, requirement: "optional" },
    { id: "visible", name: "API implementation", inScope: true, requirement: "optional" },
  ]);
  assert.equal(index.rows.find((row) => row.id === "one")?.requiredProjectCount, 1);
  assert.equal(index.rows.find((row) => row.id === "two")?.optionalProjectCount, 2);
});

test("catalog combines normalized search and saved-data facets", () => {
  const index = catalog();
  const result = queryCatalog(index, { ...unrestricted, search: " launch legacy ", owner: "owner:engineering", stream: "core", projects: "required", targetDate: "next30" }, "name", "2026-10-23");
  assert.deepEqual(result.map((row) => row.id), ["one"]);
  assert.deepEqual(queryCatalog(index, { ...unrestricted, owner: "none", stream: "unassigned", projects: "none", targetDate: "none" }, "name", "2026-10-23").map((row) => row.id), ["three"]);
  assert.deepEqual(queryCatalog(index, { ...unrestricted, projects: "optional" }, "name", "2026-10-23").map((row) => row.id), ["two"]);
});

test("catalog date boundaries and deterministic sorting use explicit local dates", () => {
  const index = catalog();
  assert.deepEqual(queryCatalog(index, { ...unrestricted, targetDate: "next30" }, "name", "2026-10-23").map((row) => row.id), ["one"]);
  assert.deepEqual(queryCatalog(index, unrestricted, "neededBy", "2026-10-23").map((row) => row.id), ["one", "two", "three"]);
  assert.deepEqual(queryCatalog(index, unrestricted, "newest", "2026-10-23").map((row) => row.id), ["two", "one", "three"]);
  assert.deepEqual(queryCatalog(index, unrestricted, "name", "2026-10-23").map((row) => row.id), ["three", "one", "two"]);
});

test("catalog queries do not mutate the indexed planning state", () => {
  const index = catalog();
  const before = structuredClone(index);
  queryCatalog(index, { ...unrestricted, search: "api", targetDate: "next30" }, "newest", "2026-10-23");
  assert.deepEqual(index, before);
});

test("saved owners cannot collide with unrestricted or blank-owner filter modes", () => {
  const owners = [" All ", "None", "Engineering", "  ", "all", "owner:all"];
  const index = indexCatalog({
    outcomes: owners.map((owner, id) => ({ ...catalog().rows[0], id: String(id), title: String(id), owner })),
    projects: [], links: [], streams: [],
  });
  assert.deepEqual(index.owners.map((option) => option.value), ["owner:all", "owner:engineering", "owner:none", "owner:owner:all"]);
  const ids = (owner: CatalogFilters["owner"]) => queryCatalog(index, { ...unrestricted, owner }, "name", "2026-10-23").map((row) => row.id);
  assert.deepEqual(ids("all"), ["0", "1", "2", "3", "4", "5"]);
  assert.deepEqual(ids("none"), ["3"]);
  assert.deepEqual(ids("owner:all"), ["0", "4"]);
  assert.deepEqual(ids("owner:none"), ["1"]);
  assert.deepEqual(ids("owner:engineering"), ["2"]);
  assert.deepEqual(ids("owner:owner:all"), ["5"]);
});

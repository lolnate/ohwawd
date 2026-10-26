import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { schemaSql } from "../src/lib/db";
import { planPlacements, orderConflicts, type QueueState } from "../src/lib/sequencing";
import { placeProjects, rejectNewOrderConflicts, sequenceToken, sequencingState } from "../src/lib/sequence-store";

const state = (): QueueState => ({ streamIds: ["one", "two"], dependencies: [], packages: ["a", "b", "c", "x"].map((id, index) => ({
  id, name: id.toUpperCase(), streamId: id === "x" ? "two" : "one", selected: true, complete: false, position: index + 1,
})) });

test("explicit reorder and cross-stream insertion preserve other members", () => {
  const input = state();
  const packages = planPlacements(input, [{ packageId: "c", streamId: "one", selected: true, beforeId: "a" }]);
  assert.deepEqual(packages.filter((item) => item.streamId === "one").sort((a, b) => a.position! - b.position!).map((item) => item.id), ["c", "a", "b"]);
  const moved = planPlacements({ ...input, packages }, [{ packageId: "b", streamId: "two", selected: true, beforeId: "x" }]);
  assert.deepEqual(moved.filter((item) => item.streamId === "two").sort((a, b) => a.position! - b.position!).map((item) => item.id), ["b", "x"]);
  assert.equal(input.packages.find((item) => item.id === "c")!.position, 3);
});

test("direct and transitive precedence is enforced, including paths through other streams", () => {
  const input = state();
  input.dependencies = [{ predecessorId: "a", successorId: "x" }, { predecessorId: "x", successorId: "c" }];
  assert.throws(() => planPlacements(input, [{ packageId: "c", streamId: "one", selected: true, beforeId: "a" }]), /A → X → C/);
  input.packages[0].complete = true;
  assert.doesNotThrow(() => planPlacements(input, [{ packageId: "c", streamId: "one", selected: true, beforeId: "a" }]));
  input.packages[0].complete = false;
  input.dependencies[0].waived = true;
  assert.doesNotThrow(() => planPlacements(input, [{ packageId: "c", streamId: "one", selected: true, beforeId: "a" }]));
});

test("location-only and bulk assignment append in dependency-valid order and remain idempotent", () => {
  const input = state();
  input.dependencies = [{ predecessorId: "x", successorId: "b" }, { predecessorId: "a", successorId: "x" }];
  const packages = planPlacements(input, [{ packageId: "x", streamId: "one", selected: true }]);
  assert.deepEqual(packages.filter((item) => item.streamId === "one").sort((a, b) => a.position! - b.position!).map((item) => item.id), ["a", "x", "b", "c"]);
  assert.deepEqual(planPlacements({ ...input, packages }, [{ packageId: "x", streamId: "one", selected: true }]), packages);
  const bulk = planPlacements(input, ["x", "a"].map((packageId) => ({ packageId, streamId: "two", selected: true })));
  assert.deepEqual(bulk.filter((item) => item.streamId === "two").sort((a, b) => a.position! - b.position!).map((item) => item.id), ["a", "x"]);
});

test("source conflicts can be repaired incrementally without introducing new ones", () => {
  const input = state();
  input.dependencies = [{ predecessorId: "c", successorId: "b" }, { predecessorId: "b", successorId: "a" }];
  assert.equal(orderConflicts(input).length, 3);
  const packages = planPlacements(input, [{ packageId: "c", streamId: "one", selected: true, beforeId: "a" }]);
  assert.equal(orderConflicts({ ...input, packages }).length, 1);
  const repaired = planPlacements({ ...input, packages }, [{ packageId: "b", streamId: "one", selected: true, beforeId: "a" }]);
  assert.equal(orderConflicts({ ...input, packages: repaired }).length, 0);
});

test("server rejects stale placement tokens and a failed bulk plan writes no partial moves", async () => {
  const database = new PGlite();
  try {
    await database.exec(schemaSql);
    await database.query("INSERT INTO workspace(id) VALUES(1)");
    await database.query("INSERT INTO stream(id,name,position) VALUES('one','One',1),('two','Two',2)");
    for (const id of ["a", "b", "c"]) {
      await database.query(`INSERT INTO linear_project_cache(linear_id,team_id,name,status,url,source_updated_at,last_seen_at,last_seen_import_id)
        VALUES($1,'team',$1,'planned','https://linear.app',now(),now(),'00000000-0000-4000-8000-000000000001')`, [id]);
      await database.query("INSERT INTO work_package(id,project_id,team_id,stream_id,sequence_position) VALUES($1,$1,'team','one',$2)", [id, id.charCodeAt(0)]);
    }
    const client = database as unknown as PoolClient;
    const token = sequenceToken(await sequencingState(client));
    await placeProjects(client, [{ packageId: "c", streamId: "one", selected: true, beforeId: "a" }], token);
    await assert.rejects(() => placeProjects(client, [{ packageId: "a", streamId: "two", selected: true }], token), /project sequence, outcome priority or dependencies changed/);
    const before = await sequencingState(client);
    await assert.rejects(() => placeProjects(client, [{ packageId: "a", streamId: "two", selected: true }, { packageId: "missing", streamId: "two", selected: true }]), /Project not found/);
    assert.deepEqual(await sequencingState(client), before);
    await database.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('b','a','local')");
    await assert.rejects(() => rejectNewOrderConflicts(client, before), /must precede/);
    await database.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('a','b','linear')");
    await assert.rejects(() => rejectNewOrderConflicts(client, before), /create a cycle/);
  } finally { await database.close(); }
});

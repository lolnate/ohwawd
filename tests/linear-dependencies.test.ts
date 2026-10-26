import assert from "node:assert/strict";
import { test } from "node:test";
import { linearProjectDependencies, linearRemainingScope } from "../src/lib/linear";

test("Linear project dependency relations retain finish-to-start direction in either collection", () => {
  const relation = { type: "dependency", anchorType: "end", relatedAnchorType: "start", projectId: "identity", relatedProjectId: "self-service" };
  assert.deepEqual(linearProjectDependencies([relation, relation]), [{ predecessorId: "identity", successorId: "self-service" }]);
  assert.deepEqual(linearProjectDependencies([{ ...relation, archivedAt: new Date() }, { ...relation, type: "related" }, { ...relation, anchorType: "start" }]), []);
  assert.deepEqual(linearProjectDependencies([{ type: "blocks", projectId: "identity", relatedProjectId: "self-service" }]), [{ predecessorId: "identity", successorId: "self-service" }]);
});

test("Linear aggregate scope subtracts completed points without using weighted progress", () => {
  assert.equal(linearRemainingScope(150, [10, 44]), 106);
  assert.equal(linearRemainingScope(40, [50]), 0);
  assert.equal(linearRemainingScope(0, []), null);
  assert.equal(linearRemainingScope(Number.NaN, []), null);
});

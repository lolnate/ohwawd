import assert from "node:assert/strict";
import { test } from "node:test";
import { linearProjectDependencies } from "../src/lib/linear";

test("Linear project dependency relations retain finish-to-start direction in either collection", () => {
  const relation = { type: "dependency", anchorType: "end", relatedAnchorType: "start", projectId: "identity", relatedProjectId: "self-service" };
  assert.deepEqual(linearProjectDependencies([relation, relation]), [{ predecessorId: "identity", successorId: "self-service" }]);
  assert.deepEqual(linearProjectDependencies([{ ...relation, archivedAt: new Date() }, { ...relation, type: "related" }, { ...relation, anchorType: "start" }]), []);
  assert.deepEqual(linearProjectDependencies([{ type: "blocks", projectId: "identity", relatedProjectId: "self-service" }]), [{ predecessorId: "identity", successorId: "self-service" }]);
});

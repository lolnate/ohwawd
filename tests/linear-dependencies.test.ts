import assert from "node:assert/strict";
import { test } from "node:test";
import { LinearError, LinearErrorType } from "@linear/sdk";
import { createLinearRequestCounter, linearProjectDependencies, linearReadError, linearRemainingScope, retryLinearRead } from "../src/lib/linear";

test("Linear project dependency relations retain finish-to-start direction in either collection", () => {
  const relation = { type: "dependency", anchorType: "end", relatedAnchorType: "start", projectId: "identity", relatedProjectId: "self-service" };
  assert.deepEqual(linearProjectDependencies([relation, relation]), [{ predecessorId: "identity", successorId: "self-service" }]);
  assert.deepEqual(linearProjectDependencies([{ ...relation, archivedAt: new Date() }, { ...relation, type: "related" }, { ...relation, anchorType: "start" }]), []);
  assert.deepEqual(linearProjectDependencies([{ type: "blocks", projectId: "identity", relatedProjectId: "self-service" }]), [{ predecessorId: "identity", successorId: "self-service" }]);
});

test("Linear aggregate scope subtracts completed points without using weighted progress", () => {
  assert.equal(linearRemainingScope(150, [10, 44]), 106);
  assert.equal(linearRemainingScope(40, [50]), 0);
  assert.equal(linearRemainingScope(108, [], 108), 0);
  assert.equal(linearRemainingScope(150, [44], 50), 100);
  assert.equal(linearRemainingScope(0, []), null);
  assert.equal(linearRemainingScope(Number.NaN, []), null);
});

test("Linear reads retry transient network failures", async () => {
  let attempts = 0;
  const requests = createLinearRequestCounter();
  const result = await retryLinearRead(() => requests.attempt(async () => {
    attempts += 1;
    if (attempts < 3) throw new LinearError(undefined, undefined, LinearErrorType.NetworkError);
    return "loaded";
  }), [0, 0]);

  assert.equal(result, "loaded");
  assert.equal(attempts, 3);
  assert.equal(requests.count(), 3);
});

test("Linear reads do not retry non-network failures", async () => {
  let attempts = 0;
  await assert.rejects(retryLinearRead(async () => {
    attempts += 1;
    throw new LinearError(undefined, undefined, LinearErrorType.AuthenticationError);
  }, [0, 0]), (error: unknown) => error instanceof LinearError && error.type === LinearErrorType.AuthenticationError);
  assert.equal(attempts, 1);
});

test("Linear network errors explain that the server connection failed", async () => {
  const response = linearReadError(new LinearError(undefined, undefined, LinearErrorType.NetworkError), "import projects and issues");
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "The application server temporarily lost its connection to Linear. Try the sync again." });
});

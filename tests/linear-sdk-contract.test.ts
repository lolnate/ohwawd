import assert from "node:assert/strict";
import { test } from "node:test";
import { LinearError, LinearGraphQLClient } from "@linear/sdk";

test("Linear SDK raw requests preserve data and reject partial GraphQL errors", async () => {
  const query = "query Viewer { viewer { id } }";
  const variables = { teamId: "team-1" };
  const client = new LinearGraphQLClient("https://api.linear.app/graphql", {
    fetch: async (_url, init) => {
      assert.deepEqual(JSON.parse(String(init.body)), { query, variables });
      return Response.json({ data: { viewer: { id: "owner-1" } } });
    },
  });

  const result = await client.rawRequest<{ viewer: { id: string } }>(query, variables);
  assert.equal(result.data?.viewer.id, "owner-1");

  const partialClient = new LinearGraphQLClient("https://api.linear.app/graphql", {
    fetch: async () => Response.json({
      data: { viewer: { id: "owner-1" } },
      errors: [{ message: "Access denied", extensions: { type: "Forbidden" } }],
    }),
  });
  await assert.rejects(partialClient.rawRequest(query, variables), (error: unknown) => error instanceof LinearError);
});

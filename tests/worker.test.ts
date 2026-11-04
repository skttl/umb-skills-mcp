import assert from "node:assert/strict";
import test from "node:test";
import { createWorker } from "../src/worker.js";
import type { Catalog } from "../src/catalog.js";
const rev = "a".repeat(40);
const catalog: Catalog = {
  sources: [
    {
      id: "test-17",
      major: 17,
      ref: "main",
      repository: "test/repo",
      revision: rev,
    },
  ],
  skills: [
    {
      id: "test-17/demo",
      source: "test-17",
      name: "demo",
      description: "Show toast notifications",
      path: "plugins/a/skills/demo/SKILL.md",
    },
  ],
  files: {
    "test-17": [
      "plugins/a/skills/demo/SKILL.md",
      "plugins/a/skills/demo/ref.md",
    ],
  },
};
const worker = createWorker(catalog);
const env = {
  RATE_LIMITER: {
    async limit() {
      return { success: true };
    },
  },
  ASSETS: {
    async fetch(request: Request) {
      assert.match(
        request.url,
        /test-17\/a{40}\/plugins\/a\/skills\/demo\/SKILL.md$/,
      );
      return new Response("[Read](ref.md)\nDemo instructions");
    },
  },
};
const headers = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};
async function rpc(method: string, params: unknown, id = 1) {
  const response = await worker.fetch(
    new Request("https://umb-skills.skttl.dev/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
    env,
  );
  assert.equal(response.status, 200);
  return response.json() as Promise<any>;
}
test("MCP initializes, lists exactly two read-only tools, searches and retrieves references", async () => {
  const init = await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  assert.equal(init.result.serverInfo.name, "umb-skills-mcp");
  const listed = await rpc("tools/list", {});
  assert.deepEqual(
    listed.result.tools.map((t: any) => t.name),
    ["search_skills", "get_skill"],
  );
  assert(listed.result.tools.every((t: any) => t.annotations.readOnlyHint));
  const search = await rpc("tools/call", {
    name: "search_skills",
    arguments: { query: "toast notifications", umbraco_major: 17 },
  });
  const result = JSON.parse(search.result.content[0].text);
  assert.equal(result.results[0].id, "test-17/demo");
  const get = await rpc("tools/call", {
    name: "get_skill",
    arguments: { id: "test-17/demo", umbraco_major: 17, revision: rev },
  });
  const file = JSON.parse(get.result.content[0].text);
  assert.match(file.content, /Demo instructions/);
  assert.equal(file.links[0].file, "plugins/a/skills/demo/ref.md");
});
test("MCP returns actionable tool errors and validates input", async () => {
  const mismatch = await rpc("tools/call", {
    name: "get_skill",
    arguments: { id: "test-17/demo", umbraco_major: 18, revision: rev },
  });
  assert.equal(mismatch.result.isError, true);
  assert.match(mismatch.result.content[0].text, /version/i);
  const invalid = await rpc("tools/call", {
    name: "search_skills",
    arguments: { query: "toast", umbraco_major: 17, limit: 1000 },
  });
  assert(invalid.error || invalid.result?.isError);
});
test("HTTP rejects untrusted origins, oversized requests and direct asset access", async () => {
  const origin = await worker.fetch(
    new Request("https://umb-skills.skttl.dev/mcp", {
      method: "POST",
      headers: { ...headers, origin: "https://evil.example" },
      body: "{}",
    }),
    env,
  );
  assert.equal(origin.status, 403);
  const size = await worker.fetch(
    new Request("https://umb-skills.skttl.dev/mcp", {
      method: "POST",
      headers,
      body: " ".repeat(70_000),
    }),
    env,
  );
  assert.equal(size.status, 413);
  const privateFile = await worker.fetch(
    new Request(
      "https://umb-skills.skttl.dev/test-17/" +
        rev +
        "/plugins/a/skills/demo/SKILL.md",
    ),
    env,
  );
  assert.equal(privateFile.status, 404);
});

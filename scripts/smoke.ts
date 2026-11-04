import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const endpoint = process.env.MCP_URL;
const local = !endpoint;
const url = endpoint ?? "http://127.0.0.1:8787/mcp";
const child = local
  ? spawn(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "dev",
        "--local",
        "--ip",
        "127.0.0.1",
        "--port",
        "8787",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      },
    )
  : undefined;
let output = "";
child?.stdout?.on("data", (data) => {
  output += String(data);
});
child?.stderr?.on("data", (data) => {
  output += String(data);
});
const rpc = async (method: string, params: unknown) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const payload = (await response.json()) as any;
  assert(!payload.error, JSON.stringify(payload.error));
  return payload.result;
};
try {
  if (local) {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (child?.exitCode !== null) throw new Error(output);
      try {
        const r = await fetch(new URL("/", url), {
          signal: AbortSignal.timeout(1000),
        });
        ready = r.ok;
      } catch {}
      if (ready) break;
      await setTimeout(500);
    }
    assert(ready, output);
  }
  const init = await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "umb-skills-smoke", version: "1" },
  });
  assert.equal(init.serverInfo.name, "umb-skills-mcp");
  const tools = await rpc("tools/list", {});
  assert.deepEqual(
    tools.tools.map((t: any) => t.name),
    ["search_skills", "get_skill"],
  );
  for (const [query, major, expected] of [
    [
      "create a dashboard in the backoffice",
      18,
      "backoffice-18/umbraco-dashboard",
    ],
    ["show a toast notification", 17, "backoffice-17/umbraco-notifications"],
    [
      "server-side C# notification handler content published",
      17,
      "implementation-17/umbraco-notifications",
    ],
    ["add a document type", 17, "implementation-17/umbraco-add-document-type"],
  ] as const) {
    const response = await rpc("tools/call", {
      name: "search_skills",
      arguments: { query, umbraco_major: major },
    });
    assert(!response.isError, response.content[0].text);
    const search = JSON.parse(response.content[0].text);
    assert(
      search.results.some((r: any) => r.id === expected),
      `Missing ${expected}: ${response.content[0].text}`,
    );
    const skill = search.results.find((r: any) => r.id === expected);
    const got = await rpc("tools/call", {
      name: "get_skill",
      arguments: {
        id: skill.id,
        umbraco_major: major,
        revision: skill.revision,
      },
    });
    assert(!got.isError, got.content[0].text);
    const file = JSON.parse(got.content[0].text);
    assert.match(file.content, /^---/);
    assert.match(file.source_url, /https:\/\/github.com\/umbraco\//);
    if (major === 18) {
      const metadata = await rpc("tools/call", {
        name: "get_skill",
        arguments: {
          id: skill.id,
          umbraco_major: major,
          revision: skill.revision,
          file: "plugins/umbraco-backoffice-skills/.claude-plugin/plugin.json",
        },
      });
      assert(!metadata.isError, metadata.content[0].text);
      assert.match(
        JSON.parse(JSON.parse(metadata.content[0].text).content).version,
        /^18\./,
      );
    }
    if (file.links.length) {
      const ref = await rpc("tools/call", {
        name: "get_skill",
        arguments: {
          id: skill.id,
          umbraco_major: major,
          revision: skill.revision,
          file: file.links[0].file,
        },
      });
      assert(!ref.isError, ref.content[0].text);
      assert(JSON.parse(ref.content[0].text).content.length > 0);
    }
    console.log(`PASS ${expected} and linked file retrieval`);
  }
  const maintenanceSearch = await rpc("tools/call", {
    name: "search_skills",
    arguments: {
      query: "custom maintenance page during upgrade",
      umbraco_major: 17,
    },
  });
  const maintenance = JSON.parse(
    maintenanceSearch.content[0].text,
  ).results.find(
    (r: any) => r.id === "implementation-17/umbraco-custom-maintenance-page",
  );
  assert(maintenance, "Missing maintenance skill");
  const html = await rpc("tools/call", {
    name: "get_skill",
    arguments: {
      id: maintenance.id,
      umbraco_major: 17,
      revision: maintenance.revision,
      file: "plugins/implementation/skills/umbraco-custom-maintenance-page/assets/cloud-error-page.html",
    },
  });
  assert(!html.isError, html.content[0].text);
  assert.match(JSON.parse(html.content[0].text).content, /<html/i);
  console.log("PASS HTML supporting asset retrieval");
  const hidden = await fetch(new URL("/backoffice-18/hidden.md", url));
  assert.equal(hidden.status, 404);
  console.log(`MCP smoke passed: ${url}`);
} finally {
  if (child?.pid) {
    if (process.platform === "win32")
      await new Promise<void>((resolve) => {
        const kill = spawn(
          "taskkill",
          ["/pid", String(child.pid), "/T", "/F"],
          { stdio: "ignore" },
        );
        kill.on("close", () => resolve());
      });
    else {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        if (child.exitCode !== null) resolve();
        else child.once("exit", () => resolve());
      });
    }
  }
}

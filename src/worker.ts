import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  searchSkills,
  selectFile,
  linkedFiles,
  type Catalog,
} from "./catalog.js";
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const major = z.number().int().min(1).max(100);
const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});
export function createWorker(catalog: Catalog) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === "/" && request.method === "GET")
        return Response.json({
          name: "umb-skills-mcp",
          endpoint: "/mcp",
          skills: catalog.skills.length,
          sources: catalog.sources,
          documentation_mcp: "https://docs.umbraco.com/~gitbook/mcp",
          notice: "Independent project. Not affiliated with Umbraco A/S.",
        });
      if (url.pathname !== "/mcp")
        return new Response("Not found", { status: 404 });
      const origin = request.headers.get("origin");
      const allowed = new Set([
        url.origin,
        "https://chatgpt.com",
        "https://claude.ai",
      ]);
      if (origin && !allowed.has(origin))
        return new Response("Origin not allowed", { status: 403 });
      const cors: Record<string, string> = {
        ...(origin
          ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
          : {}),
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id",
        "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id",
      };
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: cors });
      if (
        !(
          await env.RATE_LIMITER.limit({
            key: request.headers.get("CF-Connecting-IP") ?? "local",
          })
        ).success
      )
        return new Response("Too many requests", {
          status: 429,
          headers: { ...cors, "Retry-After": "60" },
        });
      const server = new McpServer({
        name: "umb-skills-mcp",
        version: "0.1.0",
      });
      server.registerTool(
        "search_skills",
        {
          description:
            "Find Umbraco skills for a task and major version. Returns compact matches with source-qualified IDs and revisions; retrieve instructions using get_skill.",
          inputSchema: {
            query: z.string().trim().min(2).max(1000),
            umbraco_major: major,
            limit: z.number().int().min(1).max(5).default(3),
          },
          annotations,
        },
        async ({ query, umbraco_major, limit }) => {
          try {
            return json(searchSkills(catalog, query, umbraco_major, limit));
          } catch (error) {
            return {
              isError: true,
              content: [{ type: "text", text: (error as Error).message }],
            };
          }
        },
      );
      server.registerTool(
        "get_skill",
        {
          description:
            "Retrieve a skill or linked file from a matching snapshot. Use the ID, major and revision from search_skills. Optional file is an exact repository path returned in links; omit for SKILL.md.",
          inputSchema: {
            id: z.string().min(1).max(200),
            umbraco_major: major,
            revision: z.string().regex(/^[a-f0-9]{40}$/),
            file: z.string().min(1).max(1000).optional(),
          },
          annotations,
        },
        async ({ id, umbraco_major, revision, file }) => {
          try {
            const selected = selectFile(
              catalog,
              id,
              umbraco_major,
              revision,
              file,
            );
            const response = await env.ASSETS.fetch(
              new Request(selected.asset),
            );
            if (!response.ok)
              throw new Error("Packaged file is unavailable. Try again later.");
            const content = await response.text();
            return json({
              id,
              umbraco_major,
              revision,
              file: selected.path,
              source_url: selected.url,
              content,
              links: linkedFiles(
                catalog,
                selected.source,
                selected.path,
                content,
              ),
            });
          } catch (error) {
            return {
              isError: true,
              content: [{ type: "text", text: (error as Error).message }],
            };
          }
        },
      );
      const transport = new WebStandardStreamableHTTPServerTransport({
        enableJsonResponse: true,
        maxRequestBodySize: 65_536,
      });
      await server.connect(transport);
      try {
        const response = await transport.handleRequest(request);
        const outgoing = new Response(response.body, response);
        for (const [key, value] of Object.entries(cors))
          outgoing.headers.set(key, value);
        return outgoing;
      } finally {
        await server.close();
      }
    },
  };
}

# umb-skills-mcp

Find and retrieve skills for Umbraco development without installing the full upstream catalogs.

Independent project, not affiliated with or endorsed by Umbraco A/S. Upstream skill content remains attributed to its authors; retrieval includes a link to the exact source revision. No Umbraco brand assets are used.

## Connect

Configure **both** remote HTTP MCP connections in your agent:

| Connection | URL | Purpose |
| --- | --- | --- |
| umb-skills | `https://umb-skills.skttl.dev/mcp` | Discover skills and retrieve instructions/references |
| Umbraco documentation | `https://docs.umbraco.com/~gitbook/mcp` | Check official version-specific documentation |

The first URL becomes available after deployment and custom-domain provisioning.

For clients supporting this configuration shape:

```json
{
  "mcpServers": {
    "umb-skills": { "type": "http", "url": "https://umb-skills.skttl.dev/mcp" },
    "umbraco-docs": { "type": "http", "url": "https://docs.umbraco.com/~gitbook/mcp" }
  }
}
```

Other clients use different configuration formats; add the same two URLs through their MCP settings. Install the small companion skill from [`skills/umb-skills/SKILL.md`](skills/umb-skills/SKILL.md) in your client's skill directory. With the Vercel Skills CLI, target your actual agent, for example:

```sh
npx skills add skttl/umb-skills-mcp --skill umb-skills -a codex
```

Installing the skill does not automatically configure either MCP connection. Its description is deliberately short: `Use for Umbraco-specific development or troubleshooting.`

## Tools

- `search_skills(query, umbraco_major, limit?)`: returns up to three matches by default, at most five, with source-qualified IDs, descriptions and revisions. Queries should describe the task in English, as the source metadata is English.
- `get_skill(id, umbraco_major, revision, file?)`: retrieves SKILL.md by default. Pass an exact repository path from the returned `links` to retrieve a supporting file from the same snapshot.

Both tools are read-only. Files are returned as text; upstream scripts are never executed by this service. The server does not use an LLM and does not proxy the documentation MCP. Search is lexical; a result's relevance still needs agent judgment.

## Sources and versions

[`sources.json`](sources.json) is the explicit source/version allowlist:

| Source ID | Repository | Branch | Exposed major |
| --- | --- | --- | --- |
| backoffice-18 | [Backoffice Skills](https://github.com/umbraco/Umbraco-CMS-Backoffice-Skills) | main | 18 |
| backoffice-17 | [Backoffice Skills](https://github.com/umbraco/Umbraco-CMS-Backoffice-Skills) | v17/main | 17 |
| implementation-17 | [Implementation Skills](https://github.com/umbraco/Umbraco-CMS-Implementation-Skills) | main | 17 |

Implementation guidance is initially exposed only for 17, matching the repository's reference instance, even where individual descriptions say 17+. Broader compatibility requires review. Plugin version `1.0.0` is not a CMS version.

Every build clones the configured branches, records their commit SHAs, discovers published SKILL.md files and packages tracked UTF-8 text files. Required metadata, duplicate IDs, text size and source-major signals are validated. Symlinks and unsupported text fail the build; binary extensions are excluded. No upstream build, install or script runs.

When an upstream source moves to a new major, sync fails until the allowlist is reviewed. A failed refresh leaves the deployed Worker unchanged. If a client requests a revision that has since been replaced, it must search again. Static files are available only through the validated MCP retrieval tool, not public asset paths. Relative Markdown links are resolved into retrievable repository paths; external documentation links remain in the original content.

## Development

Requires Node.js 22+, npm and Git.

```sh
npm ci
npm test
npm run sync
npm run typecheck
npm run build
npm run smoke
npm run dev
```

`sync` writes ignored `.generated/` assets and catalog. `build` performs a Wrangler dry-run. `smoke` starts Wrangler locally, initializes MCP, lists tools, searches real snapshots and retrieves skills and linked references. It stops its local server afterward. To test an existing deployment, set `MCP_URL` before running `npm run smoke`.

## Cloudflare and GitHub Actions

The Worker uses static assets and a rate-limit binding. No database, KV, R2 or Durable Object is required. [`wrangler.jsonc`](wrangler.jsonc) binds `umb-skills.skttl.dev` as a custom domain and also enables the account's `workers.dev` address. The `skttl.dev` zone must be active in the selected account, with no conflicting DNS record for the chosen subdomain.

The workflow runs tests, actionlint, source sync, typechecking, a dry-run build and a local runtime smoke test. Successful runs on main deploy when both secrets exist. Pull requests never deploy. Missing credentials skip deployment with an explanation in the run summary. A daily schedule and manual dispatch refresh upstream sources without requiring a source-code commit. Production is smoke-tested after deployment; a failed production smoke test reports failure but does not automatically roll back.

The daily schedule is at 05:23 UTC; GitHub may delay scheduled runs. Upstream content changes are automatically ingested, so source revisions should be reviewed when debugging changed guidance.

## Operational limits

The public MCP accepts bodies up to 64 KiB and limits each client IP to approximately 120 MCP requests per minute per Cloudflare location. This is abuse mitigation, not a strict account-wide cost cap. Allowed browser origins are the endpoint itself, `https://chatgpt.com` and `https://claude.ai`; clients without an Origin header can connect normally. Add another trusted origin explicitly if a browser-based client needs it.

No paid plan is selected by this repository. Verify CPU use and account quotas on the deployed service; a successful local smoke test does not prove it fits the Workers Free CPU budget.

The companion skill and server tools add discovery context. Only retrieved instructions and references enter task context; no claim of measured end-to-end token savings is made.

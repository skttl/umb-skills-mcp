# umb-skills-mcp

Independent read-only MCP on Cloudflare Workers at https://umb-skills.skttl.dev/mcp.
Sources: Umbraco-CMS-Backoffice-Skills (main for 18, v17/main for 17) and
Umbraco-CMS-Implementation-Skills (main; initially expose for 17 only, matching its
reference instance; broader compatibility is not inferred from plugin versions).

Two tools: search_skills(query, umbraco_major, limit?) and
get_skill(id, umbraco_major, revision, file?). Source-qualified IDs distinguish
duplicates. Search returns compact metadata, not instructions. Retrieval returns
one file, its upstream URL, revision, and resolvable links to other packaged files.
Stale revisions and unsupported majors fail explicitly. No upstream code executes.

Build clones sources, validates YAML frontmatter and expected major metadata, and
generates a metadata catalog plus text assets. Static assets are private to the
Worker binding. Only listed tracked regular files may be retrieved; path escape,
symlinks, binary files and oversized files are rejected or excluded.

Use the official MCP SDK and stateless JSON HTTP transport. No database, login,
LLM, vector store, docs proxy or local stdio distribution. Validate HTTP origins
and request sizes. The server deliberately exposes public upstream guidance.

GitHub Actions tests PRs and deploys main, daily refreshes and manual runs only
after validation and dry-run build. Cloudflare credentials are repository secrets;
custom domain setup uses a scoped Cloudflare token. Keep previous deployment on
build failure. Actions and application dependencies are pinned.

Companion skill description: Use for Umbraco-specific development or troubleshooting.
Document both required MCP connections: this server and https://docs.umbraco.com/~gitbook/mcp.

Validation: unit tests for ranking, version rejection, source collisions, stale
revision and file traversal; indexer tests against real miniature Git fixtures;
HTTP MCP initialize/list/call smoke test on Wrangler; actionlint and dry-run bundle.

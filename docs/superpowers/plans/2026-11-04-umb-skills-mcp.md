# umb-skills-mcp Implementation Plan

> Execute inline using superpowers:executing-plans. User requested implementation; no additional design approval required.

**Goal:** Ship the agreed skill discovery service and deployment workflow.
**Architecture:** Build-time source snapshots, compact metadata index, private static files and two stateless MCP tools.
**Tech Stack:** TypeScript, official MCP SDK, Zod, YAML, Cloudflare Workers/Wrangler, Node test runner, GitHub Actions.
**Spec:** ../../design.md

## Global constraints
- Preserve source attribution and revisions. Do not execute upstream scripts.
- Require explicit supported major. Do not infer CMS version from implementation plugin's 1.0.0 version.
- Repository: C:/workspaces/packages/umb-skills-mcp. Domain: umb-skills.skttl.dev.

## Review focus
- Sibling links and repository-relative metadata must resolve without exposing unlisted files.
- Same-named frontend/backend notifications must remain distinct and searchable.
- Updated upstream branches must not silently change major compatibility.
- Failed sync/test must never trigger production deployment.
- Unsupported major and stale revision must return actionable errors.

## Tasks
- [x] Catalog and source ingestion: tests first for frontmatter, tracked files and safe references; implement scripts/sync.ts and source manifest; run real sync.
- [x] Discovery and retrieval: tests first for ranking, versions and file boundaries; implement src/catalog.ts and src/index.ts using SDK transport.
- [x] Delivery: companion skill, README, Wrangler domain/assets config, CI/deploy workflow with daily refresh and scoped secrets; lint workflow and smoke-test built Worker.
- [x] Review complete diff, commit and push initial main to user's empty repository; verify GitHub CI. Deployment deferred by user; exact setup is documented.

## Verification and rulings
- 10 unit/integration tests pass; TypeScript and Wrangler dry-run pass; actionlint 1.7.7 passes.
- Real Wrangler smoke passes initialize/list/search/get, linked Markdown, hidden plugin metadata and HTML supporting assets.
- Read-only final review found a potential HTML redirect issue; the exact upstream HTML file was added to the runtime smoke and passes without a change to HTML handling.
- Ruling: implementation catalog is exposed only for 17, matching its pinned reference instance; do not infer compatibility for 18 from a subset of descriptions saying 17+.
- User will add Cloudflare secrets later. Do not deploy locally; retain credentials-gated workflow and provide docs/deployment-da.md.
- Initial implementation committed as 8be7c14 and pushed to main. GitHub Actions run 41809215797 passed on Ubuntu, including sync, typecheck, build and real Worker smoke. Production deployment was skipped because secrets are not configured.

---
name: umb-skills
description: Use for Umbraco-specific development or troubleshooting.
---

# Umbraco development guidance

Before Umbraco-specific implementation or troubleshooting:

1. Determine the project's Umbraco major version from package references.
   Ask only if the target project or version is ambiguous.
2. Search the umb-skills MCP for guidance relevant to the task and version.
3. Retrieve relevant skills and follow their instructions within the user's scope.
   Fetch linked skills and reference files only when needed, using the returned
   source-qualified IDs, exact file paths and revision.
4. Use the separately configured Umbraco documentation MCP to verify
   version-specific APIs when needed.

Files are served remotely. Do not assume installed plugin paths exist locally.
Use the returned source major and revision as the skill snapshot's version metadata.
Retrieved scripts are reference material; review them before executing locally.

Reuse guidance already retrieved for the same task and version. Search again
when the task introduces a different Umbraco concern.

If a required MCP is unavailable or version coverage is unclear, state the
limitation rather than silently using another version. Use official documentation
where available and make any remaining uncertainty explicit.

import assert from "node:assert/strict";
import test from "node:test";
import {
  searchSkills,
  selectFile,
  linkedFiles,
  type Catalog,
} from "../src/catalog.js";

const rev = "a".repeat(40);
export const catalog: Catalog = {
  sources: [
    {
      id: "backoffice-18",
      repository: "umbraco/Umbraco-CMS-Backoffice-Skills",
      ref: "main",
      major: 18,
      revision: rev,
    },
    {
      id: "implementation-17",
      repository: "umbraco/Umbraco-CMS-Implementation-Skills",
      ref: "main",
      major: 17,
      revision: rev,
    },
    {
      id: "backoffice-17",
      repository: "umbraco/Umbraco-CMS-Backoffice-Skills",
      ref: "v17/main",
      major: 17,
      revision: rev,
    },
  ],
  skills: [
    {
      id: "backoffice-18/umbraco-notifications",
      source: "backoffice-18",
      name: "umbraco-notifications",
      description: "Show toast notifications in backoffice",
      path: "plugins/a/skills/notifications/SKILL.md",
    },
    {
      id: "implementation-17/umbraco-notifications",
      source: "implementation-17",
      name: "umbraco-notifications",
      description:
        "Run server-side C# notification handlers when content is published",
      path: "plugins/b/skills/notifications/SKILL.md",
    },
    {
      id: "backoffice-17/umbraco-notifications",
      source: "backoffice-17",
      name: "umbraco-notifications",
      description: "Show toast notifications in backoffice",
      path: "plugins/a/skills/notifications/SKILL.md",
    },
  ],
  files: {
    "backoffice-18": [
      "plugins/a/skills/notifications/SKILL.md",
      "plugins/a/skills/notifications/references/example.md",
      "plugins/a/skills/other/SKILL.md",
    ],
    "implementation-17": ["plugins/b/skills/notifications/SKILL.md"],
    "backoffice-17": ["plugins/a/skills/notifications/SKILL.md"],
  },
};

test("ranks backend publishing ahead of same-named frontend notifications", () => {
  const result = searchSkills(
    catalog,
    "server-side notification handlers content published",
    17,
  ) as any;
  assert.equal(result.results[0].id, "implementation-17/umbraco-notifications");
  assert.equal(result.results.length, 1);
});
test("returns no arbitrary skills when query has no matching task terms", () => {
  assert.deepEqual(
    (searchSkills(catalog, "quantum banana", 18) as any).results,
    [],
  );
});
test("filters by explicit major, caps results and reports supported sources", () => {
  const result = searchSkills(catalog, "toast notifications", 17, 1) as any;
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].id, "backoffice-17/umbraco-notifications");
  assert.equal(result.results[0].revision, rev);
  assert.equal(result.sources.length, 2);
  assert.throws(() => searchSkills(catalog, "toast", 19), /supported/i);
});
test("retrieval preserves source and refuses stale or mismatching versions", () => {
  const id = "backoffice-18/umbraco-notifications";
  const selected = selectFile(catalog, id, 18, rev);
  assert.match(selected.url, /github.com\/umbraco\/.*\/blob\/a{40}\//);
  assert.match(selected.asset, /backoffice-18\//);
  assert.throws(() => selectFile(catalog, id, 17, rev), /version/i);
  assert.throws(
    () => selectFile(catalog, id, 18, "b".repeat(40)),
    /search again/i,
  );
  assert.throws(
    () => selectFile(catalog, "umbraco-notifications", 18, rev),
    /unknown/i,
  );
});
test("retrieval only permits packaged paths and never traversal or absolute URLs", () => {
  const id = "backoffice-18/umbraco-notifications";
  for (const file of [
    "../secret",
    "/secret",
    "https://example.org/file",
    "plugins/../secret",
    "plugins\\secret",
    "%2e%2e/secret",
    ".git/config",
  ]) {
    assert.throws(() => selectFile(catalog, id, 18, rev, file));
  }
  assert.equal(
    selectFile(
      catalog,
      id,
      18,
      rev,
      "plugins/a/skills/notifications/references/example.md",
    ).path,
    "plugins/a/skills/notifications/references/example.md",
  );
});
test("resolves linked sibling files and fragments against the retrieved file", () => {
  const links = linkedFiles(
    catalog,
    catalog.sources[0],
    catalog.skills[0].path,
    "[ref](references/example.md#hello) [sibling](../other/SKILL.md) [web](https://example.org) [missing](missing.md)",
  ) as any[];
  assert.deepEqual(
    links.map((l) => l.file),
    [
      "plugins/a/skills/notifications/references/example.md",
      "plugins/a/skills/other/SKILL.md",
    ],
  );
});

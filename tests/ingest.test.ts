import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ingest } from "../scripts/ingest.js";

test("discovers tracked skills, multiline frontmatter and sibling references without executing scripts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "umb-ingest-"));
  try {
    execFileSync("git", ["init", root]);
    const dir = path.join(root, "plugins/example/skills/demo");
    await mkdir(path.join(dir, "references"), { recursive: true });
    await writeFile(
      path.join(dir, "SKILL.md"),
      "---\nname: demo\ndescription: >-\n  Handle server notifications\n  when publishing content.\n---\n[Example](references/example.md)",
    );
    await writeFile(path.join(dir, "references/example.md"), "Reference");
    await writeFile(
      path.join(dir, "danger.mjs"),
      "throw Error('must never execute')",
    );
    await writeFile(path.join(dir, "image.png"), new Uint8Array([0, 1, 2]));
    execFileSync("git", ["-C", root, "add", "."]);
    await writeFile(path.join(dir, "untracked.md"), "Not packaged");
    const result = await ingest(root, {
      id: "test-17",
      major: 17,
      ref: "main",
      repository: "test/repo",
      revision: "a".repeat(40),
    });
    assert.equal(result.skills.length, 1);
    assert.equal(result.skills[0].id, "test-17/demo");
    assert.equal(
      result.skills[0].description,
      "Handle server notifications when publishing content.",
    );
    assert.equal(
      result.files["plugins/example/skills/demo/references/example.md"],
      "Reference",
    );
    assert.equal(
      result.files["plugins/example/skills/demo/untracked.md"],
      undefined,
    );
    assert.equal(
      result.files["plugins/example/skills/demo/image.png"],
      undefined,
    );
    await writeFile(
      path.join(dir, "SKILL.md"),
      "---\nname: demo\n---\nMissing description",
    );
    await assert.rejects(
      ingest(root, {
        id: "test-17",
        major: 17,
        ref: "main",
        repository: "test/repo",
        revision: "a".repeat(40),
      }),
      /description/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

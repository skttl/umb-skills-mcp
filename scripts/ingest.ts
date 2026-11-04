import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import type { Skill, Source } from "../src/catalog.js";

export async function ingest(
  root: string,
  source: Source,
): Promise<{ skills: Skill[]; files: Record<string, string> }> {
  const tracked = execFileSync(
    "git",
    ["-C", root, "ls-files", "--stage", "-z"],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  )
    .split("\0")
    .filter(Boolean);
  const files: Record<string, string> = {};
  const skills: Skill[] = [];
  for (const entry of tracked) {
    const [mode, , stage, ...rest] = entry.split(/[ \t]/);
    const file = entry.slice(entry.indexOf("\t") + 1);
    if (stage !== "0" || rest.length === 0)
      throw new Error(`Unmerged upstream file: ${file}`);
    if (
      !/\.(?:md|json|m?js|tsx?|cs|cshtml|props|csproj|html|css|txt|xml|sh|ps1|ya?ml|toml|config|sql)$/i.test(
        file,
      ) &&
      !/(?:^|\/)(?:LICENSE|NOTICE)(?:\.[^/]*)?$/i.test(file)
    )
      continue;
    if (mode !== "100644" && mode !== "100755")
      throw new Error(`Not a regular upstream file: ${file}`);
    const bytes = await readFile(path.join(root, ...file.split("/")));
    if (bytes.length > 512 * 1024 || bytes.includes(0))
      throw new Error(`Unsupported text file: ${file}`);
    const text = new TextDecoder("utf-8", { fatal: true })
      .decode(bytes)
      .replace(/\r\n/g, "\n");
    files[file] = text;
    if (!/^plugins\/[^/]+\/skills\/[^/]+\/SKILL\.md$/.test(file)) continue;
    const front = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    if (!front) throw new Error(`Missing YAML frontmatter: ${file}`);
    const meta = parse(front[1]);
    if (
      typeof meta?.name !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.name)
    )
      throw new Error(`Invalid skill name: ${file}`);
    if (typeof meta.description !== "string" || !meta.description.trim())
      throw new Error(`Missing description: ${file}`);
    const id = `${source.id}/${meta.name}`;
    if (skills.some((s) => s.id === id))
      throw new Error(`Duplicate skill ID: ${id}`);
    skills.push({
      id,
      source: source.id,
      name: meta.name,
      description: meta.description.trim(),
      path: file,
    });
  }
  if (!skills.length) throw new Error(`No skills discovered in ${source.id}`);
  return { skills, files };
}

import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { ingest } from "./ingest.js";
import type { Catalog } from "../src/catalog.js";

const root = process.cwd();
const upstream = path.join(root, ".upstream");
await mkdir(upstream, { recursive: true });
const sources = JSON.parse(
  await readFile(path.join(root, "sources.json"), "utf8"),
) as Array<{
  id: string;
  repository: string;
  ref: string;
  major: number;
  versionFile: string;
}>;
const catalog: Catalog = { sources: [], skills: [], files: {} };
const documents: Array<{ asset: string; text: string }> = [];
for (const config of sources) {
  if (
    !/^[a-z0-9-]+$/.test(config.id) ||
    !/^[\w-]+\/[\w.-]+$/.test(config.repository) ||
    !Number.isInteger(config.major)
  )
    throw new Error("Invalid source configuration");
  const checkout = await mkdtemp(path.join(upstream, `${config.id}-`));
  try {
    execFileSync(
      "git",
      [
        "-c",
        "core.longpaths=true",
        "-c",
        "core.autocrlf=false",
        "clone",
        "--depth",
        "1",
        "--branch",
        config.ref,
        `https://github.com/${config.repository}.git`,
        checkout,
      ],
      { stdio: "inherit" },
    );
    const revision = execFileSync(
      "git",
      ["-C", checkout, "rev-parse", "HEAD"],
      { encoding: "utf8" },
    ).trim();
    const versionText = await readFile(
      path.join(checkout, config.versionFile),
      "utf8",
    );
    const declared = config.versionFile.endsWith(".json")
      ? Number(JSON.parse(versionText).version.split(".")[0])
      : Number(
          versionText.match(/Include="Umbraco\.Cms"\s+Version="(\d+)\./)?.[1],
        );
    if (declared !== config.major)
      throw new Error(
        `${config.id}: upstream now targets ${declared}, expected ${config.major}. Review sources.json before deployment.`,
      );
    const { versionFile, ...source } = config;
    const snapshot = { ...source, revision };
    const result = await ingest(checkout, snapshot);
    catalog.sources.push(snapshot);
    catalog.skills.push(...result.skills);
    catalog.files[source.id] = Object.keys(result.files).sort();
    documents.push(
      ...Object.entries(result.files).map(([file, text]) => ({
        asset: `${source.id}/${revision}/${file}`,
        text,
      })),
    );
    console.log(
      `${source.id}: ${result.skills.length} skills, ${catalog.files[source.id].length} files at ${revision}`,
    );
  } finally {
    if (!path.resolve(checkout).startsWith(path.resolve(upstream) + path.sep))
      throw new Error("Unsafe cleanup path");
    await rm(checkout, { recursive: true, force: true });
  }
}
const output = path.join(root, ".generated");
// Only replace generated output after every source has passed validation.
if (path.dirname(path.resolve(output)) !== path.resolve(root))
  throw new Error("Unsafe output path");
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "assets"), { recursive: true });
for (const { asset, text } of documents) {
  const target = path.join(output, "assets", ...asset.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
}
await writeFile(path.join(output, "catalog.json"), JSON.stringify(catalog));
await writeFile(path.join(output, "assets", ".assetsignore"), "**/.git/**\n");
console.log(`Indexed ${catalog.skills.length} version-qualified skills.`);

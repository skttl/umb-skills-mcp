export interface Source {
  id: string;
  repository: string;
  ref: string;
  major: number;
  revision: string;
}
export interface Skill {
  id: string;
  source: string;
  name: string;
  description: string;
  path: string;
}
export interface Catalog {
  sources: Source[];
  skills: Skill[];
  files: Record<string, string[]>;
}
const stop = new Set(
  "a an the in on at to for of and or with my our i we want need use using create add implement custom umbraco skill skills please".split(
    " ",
  ),
);
function terms(text: string): string[] {
  return [
    ...new Set(
      (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
        .filter((t) => !stop.has(t))
        .map((t) => (t.length > 4 ? t.replace(/s$/, "") : t)),
    ),
  ];
}
export function searchSkills(
  catalog: Catalog,
  query: string,
  major: number,
  limit = 3,
) {
  const sources = catalog.sources.filter((s) => s.major === major);
  if (!sources.length)
    throw new Error(
      `Unsupported Umbraco version ${major}. Supported majors: ${[...new Set(catalog.sources.map((s) => s.major))].sort().join(", ")}.`,
    );
  const queryTerms = terms(query);
  const ranked = catalog.skills
    .flatMap((skill) => {
      const source = sources.find((s) => s.id === skill.source);
      if (!source) return [];
      const name = new Set(terms(skill.name));
      const description = new Set(
        terms(skill.description.split(/\bSKIP:|\bNot for:/i)[0]),
      );
      const score = queryTerms.reduce(
        (n, t) => n + (name.has(t) ? 3 : description.has(t) ? 1 : 0),
        0,
      );
      return score ? [{ skill, source, score }] : [];
    })
    .sort((a, b) => b.score - a.score || a.skill.id.localeCompare(b.skill.id));
  // shortcut: lexical ranking only; evaluate semantic search if real tasks miss relevant skills.
  const results = ranked
    .filter((r) => r.score >= ranked[0].score * 0.4)
    .slice(0, Math.max(1, Math.min(5, limit)))
    .map(({ skill, source }) => ({
      id: skill.id,
      description: skill.description,
      umbraco_major: source.major,
      revision: source.revision,
    }));
  return {
    sources: sources.map(({ id, major, ref, revision }) => ({
      id,
      major,
      ref,
      revision,
    })),
    results,
  };
}
export function selectFile(
  catalog: Catalog,
  id: string,
  major: number,
  revision: string,
  file?: string,
): { source: Source; skill: Skill; path: string; url: string; asset: string } {
  const skill = catalog.skills.find((s) => s.id === id);
  if (!skill)
    throw new Error(
      "Unknown skill ID. Use search_skills to obtain a source-qualified ID.",
    );
  const source = catalog.sources.find((s) => s.id === skill.source)!;
  if (source.major !== major)
    throw new Error(
      `Version mismatch: this skill targets Umbraco ${source.major}.`,
    );
  if (source.revision !== revision)
    throw new Error(
      "The source snapshot has changed. Search again and use the returned revision.",
    );
  const selected = file ?? skill.path;
  if (
    selected.includes("\\") ||
    selected.includes("%") ||
    selected.split("/").some((p) => !p || p === "." || p === "..") ||
    !catalog.files[source.id]?.includes(selected)
  ) {
    throw new Error(
      "Unknown or invalid packaged file path. Use a file path returned by get_skill.",
    );
  }
  const encoded = selected.split("/").map(encodeURIComponent).join("/");
  return {
    source,
    skill,
    path: selected,
    url: `https://github.com/${source.repository}/blob/${source.revision}/${encoded}`,
    asset: `https://assets.invalid/${source.id}/${source.revision}/${encoded}`,
  };
}
export function linkedFiles(
  catalog: Catalog,
  source: Source,
  path: string,
  markdown: string,
) {
  const paths = new Set<string>();
  for (const match of markdown.matchAll(
    /\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g,
  )) {
    const link = match[1].replace(/^<|>$/g, "");
    if (/^(?:[a-z]+:|\/|#)/i.test(link)) continue;
    const resolved = new URL(link, `https://files.invalid/${path}`);
    const file = decodeURIComponent(resolved.pathname.slice(1));
    if (catalog.files[source.id]?.includes(file) && file !== path)
      paths.add(file);
  }
  return [...paths].map((file) => ({
    file,
    skill_id: catalog.skills.find(
      (s) => s.source === source.id && s.path === file,
    )?.id,
  }));
}

const ACRONYMS = new Map([
  ["api", "API"],
  ["aws", "AWS"],
  ["cli", "CLI"],
  ["css", "CSS"],
  ["gin", "GIN"],
  ["html", "HTML"],
  ["json", "JSON"],
  ["jsonb", "JSONB"],
  ["pg", "PG"],
  ["pgvector", "pgvector"],
  ["psql", "psql"],
  ["s3", "S3"],
  ["sql", "SQL"],
  ["ui", "UI"],
  ["ux", "UX"],
]);

function normalizeToken(token: string) {
  const normalized = token.toLowerCase();
  if (ACRONYMS.has(normalized)) {
    return ACRONYMS.get(normalized) as string;
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatDisplayTitle(title: string | null | undefined) {
  if (!title) return "";

  const withoutPrefixes = title
    .trim()
    .replace(/^\d+\s*\.\s*/, "")
    .replace(/^\d+[_\s.-]+/, "");

  return withoutPrefixes
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(normalizeToken)
    .join(" ");
}

export function formatDisplaySubtitle(title: string | null | undefined, fallback: string) {
  const formatted = formatDisplayTitle(title);
  return formatted || fallback;
}

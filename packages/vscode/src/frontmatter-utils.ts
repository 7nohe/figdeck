/**
 * Check if lines look like implicit frontmatter (YAML key/value pairs).
 */
export function looksLikeInlineFrontmatter(lines: readonly string[]): boolean {
  let sawKey = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[a-zA-Z][\w-]*:\s*/.test(trimmed)) {
      sawKey = true;
      continue;
    }
    if (/^\s+/.test(line) && sawKey) {
      continue;
    }
    return false;
  }
  return sawKey;
}

/**
 * Check if lines array has meaningful content (non-empty lines).
 */
export function hasMeaningfulContent(lines: readonly string[]): boolean {
  return lines.some((line) => line.trim() !== "");
}

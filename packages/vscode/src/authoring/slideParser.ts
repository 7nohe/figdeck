/**
 * Represents a slide in the outline
 */
export interface SlideInfo {
  index: number;
  title: string;
  startLine: number;
  endLine: number;
}

/**
 * Check if lines look like implicit frontmatter (YAML key/value pairs).
 */
function looksLikeInlineFrontmatter(lines: string[]): boolean {
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
 * Check if lines array has meaningful content (non-empty lines)
 */
function hasMeaningfulContent(lines: string[]): boolean {
  return lines.some((l) => l.trim() !== "");
}

/**
 * Check if content is only frontmatter (no actual slide content)
 */
function isOnlyFrontmatter(lines: string[]): boolean {
  let i = 0;

  // Skip leading empty lines
  while (i < lines.length && !lines[i].trim()) {
    i++;
  }

  if (i >= lines.length) {
    return true; // All empty lines
  }

  // Check for explicit frontmatter (starts with ---)
  if (lines[i]?.trim() === "---") {
    i++;
    // Find closing ---
    while (i < lines.length && lines[i].trim() !== "---") {
      i++;
    }
    // If no closing --- found, it's not valid frontmatter
    if (i >= lines.length) {
      return false;
    }
    i++; // Skip closing ---

    // Skip empty lines after explicit frontmatter
    while (i < lines.length && !lines[i].trim()) {
      i++;
    }

    // Check for additional implicit frontmatter after explicit frontmatter
    if (i < lines.length) {
      const remainingLines = lines.slice(i);
      if (looksLikeInlineFrontmatter(remainingLines)) {
        // Skip the implicit frontmatter
        for (; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (!trimmed) continue;
          if (/^[a-zA-Z][\w-]*:\s*/.test(trimmed)) continue;
          if (/^\s+/.test(lines[i])) continue;
          // Found non-frontmatter content
          break;
        }
      }
    }
  } else {
    // Check for implicit frontmatter
    const remainingLines = lines.slice(i);
    if (looksLikeInlineFrontmatter(remainingLines)) {
      for (; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === "---") {
          i++;
          break;
        }
        if (!trimmed) continue;
        if (/^[a-zA-Z][\w-]*:\s*/.test(trimmed)) continue;
        if (/^\s+/.test(lines[i])) continue;
        // Found non-frontmatter content
        return false;
      }
    } else {
      return false;
    }
  }

  // Check if remaining content is empty or only frontmatter-like
  for (; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    // If there's actual content (not frontmatter), return false
    if (!trimmed.match(/^[a-zA-Z][\w-]*:\s*/) && !/^\s+/.test(lines[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Split markdown content into slides with position information
 */
export function splitIntoSlidesWithRanges(content: string): SlideInfo[] {
  const lines = content.split(/\r?\n/);
  const slides: SlideInfo[] = [];
  let currentLines: string[] = [];
  let currentStartLine = 0;
  let inFrontmatter = false;
  let codeFence: string | null = null;

  const flushSlide = (endLine: number) => {
    if (currentLines.length === 0) return;

    const slideText = currentLines.join("\n").trim();
    if (slideText) {
      // Skip frontmatter-only blocks (global or per-slide)
      if (isOnlyFrontmatter(currentLines)) {
        currentLines = [];
        return;
      }

      const title = extractSlideTitle(currentLines);
      slides.push({
        index: slides.length + 1,
        title,
        startLine: currentStartLine,
        endLine: endLine - 1,
      });
    }
    currentLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track fenced code blocks
    const fenceMatch = trimmed.match(/^(```+|~~~+)/);
    if (fenceMatch) {
      if (codeFence === null) {
        codeFence = fenceMatch[1];
      } else if (trimmed.startsWith(codeFence)) {
        codeFence = null;
      }
      currentLines.push(line);
      continue;
    }

    // Do not treat --- as separators inside code fence
    if (codeFence !== null) {
      currentLines.push(line);
      continue;
    }

    if (trimmed === "---") {
      if (inFrontmatter) {
        currentLines.push(line);
        inFrontmatter = false;
        continue;
      }

      if (!hasMeaningfulContent(currentLines)) {
        // Start of per-slide frontmatter
        inFrontmatter = true;
        currentLines.push(line);
        continue;
      }

      // Implicit frontmatter closer
      if (looksLikeInlineFrontmatter(currentLines)) {
        currentLines.push(line);
        continue;
      }

      // Slide separator
      flushSlide(i);
      currentStartLine = i + 1;
      inFrontmatter = false;
      continue;
    }

    currentLines.push(line);
  }

  // Flush remaining content
  flushSlide(lines.length);

  return slides;
}

/**
 * Extract the title from slide lines
 * Looks for # or ## heading, falls back to first non-empty line
 */
export function extractSlideTitle(lines: string[]): string {
  // Skip frontmatter
  let i = 0;
  if (lines[0]?.trim() === "---") {
    i++;
    while (i < lines.length && lines[i].trim() !== "---") {
      i++;
    }
    i++; // Skip closing ---
  } else {
    // Check for implicit frontmatter
    let tempI = 0;
    while (tempI < lines.length) {
      const trimmed = lines[tempI].trim();
      if (!trimmed) {
        tempI++;
        continue;
      }
      if (/^[a-zA-Z][\w-]*:\s*/.test(trimmed)) {
        tempI++;
        continue;
      }
      if (/^\s+/.test(lines[tempI])) {
        tempI++;
        continue;
      }
      break;
    }
    // If we found implicit frontmatter followed by ---
    if (tempI < lines.length && lines[tempI].trim() === "---") {
      i = tempI + 1;
    }
  }

  // Look for heading
  for (; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match # or ## heading
    const headingMatch = line.match(/^#{1,2}\s+(.+)$/);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
  }

  // Fallback: first non-empty non-frontmatter line
  for (let j = i; j < lines.length; j++) {
    const line = lines[j].trim();
    if (line && !line.startsWith(":::") && !line.match(/^[a-zA-Z][\w-]*:\s*/)) {
      // Truncate if too long
      return line.length > 50 ? `${line.slice(0, 47)}...` : line;
    }
  }

  return "(untitled)";
}

/**
 * Check if a document has `figdeck: true` in its global frontmatter.
 * Only global frontmatter (at the start of the file) is checked.
 */
export function isFigdeckDocument(content: string): boolean {
  const lines = content.split(/\r?\n/);
  let i = 0;

  // Skip leading empty lines
  while (i < lines.length && !lines[i].trim()) {
    i++;
  }

  // Must start with ---
  if (lines[i]?.trim() !== "---") {
    return false;
  }
  i++;

  // Look for figdeck: true until closing ---
  while (i < lines.length && lines[i].trim() !== "---") {
    const trimmed = lines[i].trim();
    // Match figdeck: true (case insensitive for value)
    if (/^figdeck:\s*true$/i.test(trimmed)) {
      return true;
    }
    i++;
  }

  return false;
}

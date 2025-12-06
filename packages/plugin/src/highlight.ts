import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { djb2Hash } from "./hash";

// Register languages
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);

// Language aliases
export const LANG_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
};

// Maximum code length for syntax highlighting (chars)
// Larger blocks will use plain text to avoid performance issues
const MAX_HIGHLIGHT_LENGTH = 10000;

// Cache for highlight results: maps "lang:hash" to segments
const highlightCache = new Map<string, HighlightSegment[]>();

/**
 * Compute cache key for highlight results.
 * Uses full hash since code is already limited by MAX_HIGHLIGHT_LENGTH.
 */
function computeHighlightCacheKey(code: string, lang: string | null): string {
  return `${lang || "plain"}:${djb2Hash(code)}`;
}

// Theme colors (VS Code dark theme inspired)
export const THEME_COLORS: Record<string, RGB> = {
  keyword: { r: 0.78, g: 0.47, b: 0.81 }, // Purple #c678dd
  string: { r: 0.6, g: 0.76, b: 0.45 }, // Green #98c379
  number: { r: 0.82, g: 0.68, b: 0.47 }, // Orange #d19a66
  comment: { r: 0.45, g: 0.5, b: 0.55 }, // Gray #737d8c
  function: { r: 0.38, g: 0.68, b: 0.93 }, // Blue #61afef
  variable: { r: 0.88, g: 0.53, b: 0.49 }, // Red #e06c75
  type: { r: 0.9, g: 0.78, b: 0.48 }, // Yellow #e5c07b
  punctuation: { r: 0.67, g: 0.7, b: 0.75 }, // Light gray #abb2bf
  default: { r: 0.67, g: 0.7, b: 0.75 }, // Light gray #abb2bf
};

// Map hljs class names to theme colors
function getColorForClass(className: string): RGB {
  if (className.includes("keyword") || className.includes("built_in")) {
    return THEME_COLORS.keyword;
  }
  if (className.includes("string") || className.includes("regexp")) {
    return THEME_COLORS.string;
  }
  if (className.includes("number") || className.includes("literal")) {
    return THEME_COLORS.number;
  }
  if (className.includes("comment")) {
    return THEME_COLORS.comment;
  }
  if (className.includes("function") || className.includes("title")) {
    return THEME_COLORS.function;
  }
  if (className.includes("variable") || className.includes("attr")) {
    return THEME_COLORS.variable;
  }
  if (className.includes("type") || className.includes("class")) {
    return THEME_COLORS.type;
  }
  if (className.includes("punctuation") || className.includes("operator")) {
    return THEME_COLORS.punctuation;
  }
  return THEME_COLORS.default;
}

export interface HighlightSegment {
  text: string;
  color: RGB;
}

// Parse highlighted HTML to extract text segments with colors
function parseHighlightedCode(html: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let currentText = "";
  let currentColor = THEME_COLORS.default;
  let i = 0;

  while (i < html.length) {
    if (html[i] === "<") {
      // Flush current text
      if (currentText) {
        segments.push({ text: currentText, color: currentColor });
        currentText = "";
      }

      // Find the end of the tag
      const tagEnd = html.indexOf(">", i);
      if (tagEnd === -1) break;

      const tag = html.slice(i, tagEnd + 1);

      if (tag.startsWith("<span")) {
        // Extract class name
        const classMatch = tag.match(/class="([^"]+)"/);
        if (classMatch) {
          currentColor = getColorForClass(classMatch[1]);
        }
      } else if (tag === "</span>") {
        currentColor = THEME_COLORS.default;
      }

      i = tagEnd + 1;
    } else if (html[i] === "&") {
      // Handle HTML entities
      const entityEnd = html.indexOf(";", i);
      if (entityEnd !== -1) {
        const entity = html.slice(i, entityEnd + 1);
        if (entity === "&lt;") currentText += "<";
        else if (entity === "&gt;") currentText += ">";
        else if (entity === "&amp;") currentText += "&";
        else if (entity === "&quot;") currentText += '"';
        else if (entity === "&#x27;") currentText += "'";
        else currentText += entity;
        i = entityEnd + 1;
      } else {
        currentText += html[i];
        i++;
      }
    } else {
      currentText += html[i];
      i++;
    }
  }

  // Flush remaining text
  if (currentText) {
    segments.push({ text: currentText, color: currentColor });
  }

  return segments;
}

/**
 * Highlight code and return segments with colors.
 * Uses caching to avoid re-highlighting identical code.
 * Skips highlighting for very large code blocks.
 */
export function highlightCode(
  code: string,
  language?: string,
): HighlightSegment[] {
  let lang = language ? language.toLowerCase() : null;
  if (lang && LANG_ALIASES[lang]) {
    lang = LANG_ALIASES[lang];
  }

  // Check cache first (before any processing, including large block handling)
  const cacheKey = computeHighlightCacheKey(code, lang);
  const cached = highlightCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let segments: HighlightSegment[];

  // Guard: skip highlighting for very large code blocks
  if (code.length > MAX_HIGHLIGHT_LENGTH) {
    segments = [{ text: code, color: THEME_COLORS.default }];
  } else if (lang && hljs.getLanguage(lang)) {
    const result = hljs.highlight(code, { language: lang });
    segments = parseHighlightedCode(result.value);
  } else {
    segments = [{ text: code, color: THEME_COLORS.default }];
  }

  // Store in cache
  highlightCache.set(cacheKey, segments);

  return segments;
}

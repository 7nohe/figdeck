#!/usr/bin/env node
/**
 * Build script for ui.html that injects the plugin version and protocol version
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const workspaceRoot = resolve(projectRoot, "../..");

// Read package.json version
const pkg = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf-8"),
);
const version = pkg.version;

// Read PROTOCOL_VERSION directly from the shared source to avoid requiring a prebuilt dist
const sharedTypesPaths = [
  resolve(workspaceRoot, "packages/shared/src/types.ts"),
  resolve(workspaceRoot, "packages/shared/dist/types.js"),
];

let protocolVersion = "1";
for (const candidate of sharedTypesPaths) {
  try {
    const contents = readFileSync(candidate, "utf-8");
    const match = contents.match(/PROTOCOL_VERSION\s*=\s*"([^"]+)"/);
    if (match) {
      protocolVersion = match[1];
      break;
    }
  } catch {
    // Try the next candidate
  }
}

// Read ui.html
let html = readFileSync(resolve(projectRoot, "src/ui.html"), "utf-8");

// Replace the hardcoded version with the actual version from package.json
html = html.replace(
  /var PLUGIN_VERSION = '[^']*';/,
  `var PLUGIN_VERSION = '${version}';`,
);

// Replace PROTOCOL_VERSION with the shared value
html = html.replace(
  /var PROTOCOL_VERSION = '[^']*';/,
  `var PROTOCOL_VERSION = '${protocolVersion}';`,
);

// Ensure dist directory exists
mkdirSync(resolve(projectRoot, "dist"), { recursive: true });

// Write to dist
writeFileSync(resolve(projectRoot, "dist/ui.html"), html, "utf-8");

console.log(`Built ui.html with version ${version}, protocol ${protocolVersion}`);

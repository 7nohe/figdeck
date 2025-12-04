#!/usr/bin/env node
/**
 * Build script for ui.html that injects the plugin version from package.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Read package.json version
const pkg = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf-8")
);
const version = pkg.version;

// Read ui.html
let html = readFileSync(resolve(projectRoot, "src/ui.html"), "utf-8");

// Replace the hardcoded version with the actual version from package.json
html = html.replace(
  /var PLUGIN_VERSION = '[^']*';/,
  `var PLUGIN_VERSION = '${version}';`
);

// Ensure dist directory exists
mkdirSync(resolve(projectRoot, "dist"), { recursive: true });

// Write to dist
writeFileSync(resolve(projectRoot, "dist/ui.html"), html, "utf-8");

console.log(`Built ui.html with version ${version}`);

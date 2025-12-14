import {
  existsSync,
  mkdirSync,
  readFileSync,
  watchFile,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { parseMarkdown } from "./markdown.js";
import {
  getAgentsTemplate,
  getClaudeTemplate,
  getCopilotTemplate,
  getCursorTemplate,
  getInitTemplate,
} from "./templates.js";
import { generateSecret, isLoopbackHost, startServer } from "./ws-server.js";

// Debounce delay for file watch (ms)
const WATCH_DEBOUNCE_MS = 200;

// Read CLI version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const CLI_VERSION: string = pkg.version;

const program = new Command();

program
  .name("figdeck")
  .description("Convert Markdown to Figma Slides")
  .version(CLI_VERSION);

// Valid AI rules targets
const AI_RULES_TARGETS = ["agents", "claude", "cursor", "copilot"] as const;
type AiRulesTarget = (typeof AI_RULES_TARGETS)[number];

type FileToWrite = {
  absPath: string;
  content: string;
  displayPath: string;
};

const AI_RULES_FILES: Record<
  AiRulesTarget,
  {
    displayPath: string;
    pathParts: string[];
    template: () => string;
  }
> = {
  agents: {
    displayPath: "AGENTS.md",
    pathParts: ["AGENTS.md"],
    template: getAgentsTemplate,
  },
  claude: {
    displayPath: ".claude/rules/figdeck.md",
    pathParts: [".claude", "rules", "figdeck.md"],
    template: getClaudeTemplate,
  },
  cursor: {
    displayPath: ".cursor/rules/figdeck.mdc",
    pathParts: [".cursor", "rules", "figdeck.mdc"],
    template: getCursorTemplate,
  },
  copilot: {
    displayPath: ".github/instructions/figdeck.instructions.md",
    pathParts: [".github", "instructions", "figdeck.instructions.md"],
    template: getCopilotTemplate,
  },
};

function parseAiRulesTargets(aiRules: boolean | string | undefined): {
  targets: AiRulesTarget[];
  invalidTargets: string[];
} {
  if (aiRules === true || aiRules === "all") {
    return { targets: [...AI_RULES_TARGETS], invalidTargets: [] };
  }
  if (typeof aiRules !== "string") {
    return { targets: [], invalidTargets: [] };
  }

  const raw = aiRules
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const invalidTargets = raw.filter(
    (t) => !AI_RULES_TARGETS.includes(t as AiRulesTarget),
  );
  if (invalidTargets.length) {
    return { targets: [], invalidTargets };
  }

  const targets = Array.from(new Set(raw)) as AiRulesTarget[];
  return { targets, invalidTargets: [] };
}

// init: create template slides.md and optional AI rules files
program
  .command("init")
  .description("Create a template slides.md file and optional AI agent rules")
  .option("-o, --out <path>", "Output file path", "slides.md")
  .option("-f, --force", "Overwrite existing files")
  .option(
    "--ai-rules [targets]",
    "Generate AI agent rules (agents,claude,cursor,copilot or all)",
  )
  .option("--no-slides", "Skip generating slides.md")
  .action(
    (options: {
      out: string;
      force?: boolean;
      aiRules?: boolean | string;
      slides: boolean;
    }) => {
      try {
        const outputPath = resolve(options.out);
        const outputDir = dirname(outputPath);
        const slidesPath = options.out;

        // Parse --ai-rules targets
        const { targets, invalidTargets } = parseAiRulesTargets(
          options.aiRules,
        );
        if (invalidTargets.length) {
          console.error(
            `Error: Invalid --ai-rules targets: ${invalidTargets.join(", ")}`,
          );
          console.error(`Valid targets: ${AI_RULES_TARGETS.join(", ")}, all`);
          process.exit(1);
        }

        // Format template by replacing {{slidesPath}} placeholder
        const format = (content: string) =>
          content.replaceAll("{{slidesPath}}", slidesPath);

        // Build list of files to write
        const filesToWrite: FileToWrite[] = [];

        if (options.slides !== false) {
          filesToWrite.push({
            absPath: outputPath,
            content: getInitTemplate(),
            displayPath: options.out,
          });
        }
        for (const target of targets) {
          const file = AI_RULES_FILES[target];
          filesToWrite.push({
            absPath: join(outputDir, ...file.pathParts),
            content: format(file.template()),
            displayPath: file.displayPath,
          });
        }

        if (filesToWrite.length === 0) {
          console.error("Error: No files to generate.");
          console.error(
            "Use --ai-rules to generate AI agent rules, or remove --no-slides.",
          );
          process.exit(1);
        }

        // Check for existing files
        const existing = filesToWrite.filter((f) => existsSync(f.absPath));
        if (existing.length && !options.force) {
          console.error("Error: The following files already exist:");
          for (const f of existing) {
            console.error(`  - ${f.displayPath}`);
          }
          console.error("\nTo resolve:");
          console.error("  - Use --force to overwrite existing files");
          if (existing.some((f) => f.displayPath === options.out)) {
            console.error("  - Use --no-slides to skip slides.md generation");
          }
          process.exit(1);
        }

        // Create necessary directories
        for (const f of filesToWrite) {
          mkdirSync(dirname(f.absPath), { recursive: true });
        }

        // Write all files
        for (const f of filesToWrite) {
          writeFileSync(f.absPath, f.content, "utf-8");
          console.log(`Created ${f.displayPath}`);
        }

        // Show next steps if slides.md was generated
        if (options.slides !== false) {
          console.log(`\nNext steps:`);
          console.log(`  1. Run: figdeck serve ${options.out}`);
          console.log(`  2. Connect the Figma plugin to generate slides`);
        }
      } catch (error) {
        console.error("Error:", (error as Error).message);
        process.exit(1);
      }
    },
  );

// build: one-shot parse and output JSON
program
  .command("build")
  .description("Parse Markdown and output slides JSON")
  .argument("<file>", "Markdown file path")
  .option("-o, --out <path>", "Output file path (default: stdout)")
  .action((file: string, options: { out?: string }) => {
    try {
      const resolvedPath = resolve(file);
      const basePath = dirname(resolvedPath);
      const markdown = readFileSync(resolvedPath, "utf-8");
      const slides = parseMarkdown(markdown, { basePath });
      const json = JSON.stringify(slides, null, 2);

      if (options.out) {
        writeFileSync(options.out, json, "utf-8");
        console.log(`Wrote ${slides.length} slides to ${options.out}`);
      } else {
        console.log(json);
      }
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

// serve: start WebSocket server, optionally watch for changes (default command)
program
  .command("serve", { isDefault: true })
  .description("Start WebSocket server for Figma plugin connection")
  .argument("<file>", "Markdown file path")
  .option("--host <host>", "WebSocket host", "127.0.0.1")
  .option("-p, --port <port>", "WebSocket port", "4141")
  .option("--no-watch", "Disable watching for file changes")
  .option("--allow-remote", "Allow binding to non-loopback hosts")
  .option("--secret <secret>", "Require authentication with this secret")
  .option("--no-auth", "Disable authentication (not recommended for remote)")
  .action(
    async (
      file: string,
      options: {
        host: string;
        port: string;
        watch: boolean;
        allowRemote?: boolean;
        secret?: string;
        auth: boolean;
      },
    ) => {
      try {
        const host = options.host;
        const isLoopback = isLoopbackHost(host);

        // Security check: require --allow-remote for non-loopback hosts
        if (!isLoopback && !options.allowRemote) {
          console.error(
            `Error: Binding to non-loopback host "${host}" requires --allow-remote flag`,
          );
          console.error(
            "This exposes the server to the network. Use --allow-remote to confirm.",
          );
          process.exit(1);
        }

        // Generate or use provided secret for auth
        let secret: string | undefined;
        if (options.auth !== false) {
          if (!isLoopback) {
            // Always require auth for remote connections
            secret = options.secret || generateSecret();
          } else if (options.secret) {
            // Use provided secret even for loopback
            secret = options.secret;
          }
          // For loopback without explicit secret, no auth required (backwards compat)
        }

        const resolvedPath = resolve(file);
        const basePath = dirname(resolvedPath);
        let markdown = readFileSync(resolvedPath, "utf-8");
        let slides = parseMarkdown(markdown, { basePath });

        console.log(`Parsed ${slides.length} slides from ${file}`);

        if (!isLoopback) {
          console.log(
            "\n⚠️  WARNING: Server is exposed to the network. Ensure firewall is configured.",
          );
        }

        const server = await startServer(slides, {
          host,
          port: parseInt(options.port, 10),
          secret,
          cliVersion: CLI_VERSION,
        });

        if (options.watch) {
          console.log(`Watching ${file} for changes...`);

          let debounceTimer: ReturnType<typeof setTimeout> | null = null;
          watchFile(file, { interval: 300 }, () => {
            // Debounce rapid file changes
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
              debounceTimer = null;
              try {
                markdown = readFileSync(resolvedPath, "utf-8");
                slides = parseMarkdown(markdown, { basePath });
                console.log(
                  `File changed. Parsed ${slides.length} slides from ${file}`,
                );
                server.broadcast(slides);
              } catch (error) {
                console.error("Error reading file:", (error as Error).message);
              }
            }, WATCH_DEBOUNCE_MS);
          });
        }

        console.log("Press Ctrl+C to stop the server.");
        process.on("SIGINT", () => {
          console.log("\nShutting down...");
          server.close();
          process.exit(0);
        });
      } catch (error) {
        console.error("Error:", (error as Error).message);
        process.exit(1);
      }
    },
  );

program.parse();

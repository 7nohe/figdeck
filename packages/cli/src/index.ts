import { existsSync, readFileSync, watchFile, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { parseMarkdown } from "./markdown.js";
import { getInitTemplate } from "./templates.js";
import { generateSecret, isLoopbackHost, startServer } from "./ws-server.js";

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

// init: create template slides.md
program
  .command("init")
  .description("Create a template slides.md file")
  .option("-o, --out <path>", "Output file path", "slides.md")
  .option("-f, --force", "Overwrite existing file")
  .action((options: { out: string; force?: boolean }) => {
    try {
      const outputPath = resolve(options.out);

      if (!options.force && existsSync(outputPath)) {
        console.error(`Error: File already exists: ${options.out}`);
        console.error("Use --force to overwrite.");
        process.exit(1);
      }

      const template = getInitTemplate();
      writeFileSync(outputPath, template, "utf-8");
      console.log(`Created ${options.out}`);
      console.log(`\nNext steps:`);
      console.log(`  1. Run: figdeck serve ${options.out}`);
      console.log(`  2. Connect the Figma plugin to generate slides`);
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

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

          watchFile(file, { interval: 300 }, () => {
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

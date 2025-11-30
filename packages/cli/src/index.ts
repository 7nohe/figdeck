import { readFileSync, watchFile, writeFileSync } from "node:fs";
import { Command } from "commander";
import { parseMarkdown } from "./markdown.js";
import { generateSecret, isLoopbackHost, startServer } from "./ws-server.js";

const program = new Command();

program
  .name("figdeck")
  .description("Convert Markdown to Figma Slides")
  .version("0.1.0");

// build: one-shot parse and output JSON
program
  .command("build")
  .description("Parse Markdown and output slides JSON")
  .argument("<file>", "Markdown file path")
  .option("-o, --out <path>", "Output file path (default: stdout)")
  .action((file: string, options: { out?: string }) => {
    try {
      const markdown = readFileSync(file, "utf-8");
      const slides = parseMarkdown(markdown);
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

// serve: start WebSocket server, optionally watch for changes
program
  .command("serve")
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

        let markdown = readFileSync(file, "utf-8");
        let slides = parseMarkdown(markdown);

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
        });

        if (options.watch) {
          console.log(`Watching ${file} for changes...`);

          watchFile(file, { interval: 300 }, () => {
            try {
              markdown = readFileSync(file, "utf-8");
              slides = parseMarkdown(markdown);
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

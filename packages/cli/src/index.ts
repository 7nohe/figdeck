import { readFileSync, watchFile } from "node:fs";
import { Command } from "commander";
import { parseMarkdown } from "./markdown.js";
import { startServer } from "./ws-server.js";

const program = new Command();

program
  .name("figdeck")
  .description("Convert Markdown to Figma Slides")
  .version("0.1.0");

program
  .command("build")
  .description("Build slides from Markdown file")
  .argument("<file>", "Markdown file path")
  .option("--host <host>", "WebSocket host", "localhost")
  .option("-p, --port <port>", "WebSocket port", "4141")
  .option("-w, --watch", "Watch for file changes", false)
  .action(
    async (
      file: string,
      options: { host: string; port: string; watch: boolean },
    ) => {
      try {
        let markdown = readFileSync(file, "utf-8");
        let slides = parseMarkdown(markdown);

        console.log(`Parsed ${slides.length} slides from ${file}`);

        const server = await startServer(slides, {
          host: options.host,
          port: parseInt(options.port, 10),
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

          // Keep the process running
          process.on("SIGINT", () => {
            console.log("\nShutting down...");
            server.close();
            process.exit(0);
          });
        } else {
          console.log("Done! Press Ctrl+C to exit.");
          process.on("SIGINT", () => {
            console.log("\nShutting down...");
            server.close();
            process.exit(0);
          });
        }
      } catch (error) {
        console.error("Error:", (error as Error).message);
        process.exit(1);
      }
    },
  );

program.parse();

import { type WebSocket, WebSocketServer } from "ws";
import type { GenerateSlidesMessage, SlideContent } from "./types.js";

export interface WsServerOptions {
  host: string;
  port: number;
}

export interface WsServerInstance {
  broadcast: (slides: SlideContent[]) => void;
  close: () => void;
}

export function startServer(
  initialSlides: SlideContent[],
  options: WsServerOptions,
): Promise<WsServerInstance> {
  return new Promise((resolve, reject) => {
    let latestSlides = initialSlides;
    const wss = new WebSocketServer({ host: options.host, port: options.port });
    const clients = new Set<WebSocket>();

    console.log(
      `WebSocket server started on ws://${options.host}:${options.port}`,
    );
    console.log("Waiting for Figma plugin to connect...");

    function broadcast(slides: SlideContent[]) {
      latestSlides = slides;
      const message: GenerateSlidesMessage = {
        type: "generate-slides",
        slides: latestSlides,
      };
      const data = JSON.stringify(message);

      for (const client of clients) {
        if (client.readyState === client.OPEN) {
          client.send(data);
          console.log(`Sent ${slides.length} slides to plugin`);
        }
      }
    }

    wss.on("connection", (ws: WebSocket) => {
      console.log("Figma plugin connected");
      clients.add(ws);

      // Send initial slides on connection
      const message: GenerateSlidesMessage = {
        type: "generate-slides",
        slides: latestSlides,
      };
      ws.send(JSON.stringify(message));
      console.log(`Sent ${latestSlides.length} slides to plugin`);

      ws.on("message", (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.type === "success") {
            console.log(
              `Plugin successfully generated ${response.count} slides`,
            );
          } else if (response.type === "error") {
            console.error("Plugin error:", response.message);
          }
        } catch {
          // Ignore parse errors
        }
      });

      ws.on("close", () => {
        console.log("Plugin disconnected");
        clients.delete(ws);
      });
    });

    wss.on("error", (error) => {
      console.error("WebSocket server error:", error.message);
      reject(error);
    });

    wss.on("listening", () => {
      resolve({
        broadcast,
        close: () => wss.close(),
      });
    });
  });
}

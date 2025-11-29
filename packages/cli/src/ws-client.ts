import WebSocket from "ws";
import type { GenerateSlidesMessage, SlideContent } from "./types.js";

export interface WsClientOptions {
  host: string;
  port: number;
}

export function sendSlides(
  slides: SlideContent[],
  options: WsClientOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `ws://${options.host}:${options.port}`;
    console.log(`Connecting to ${url}...`);

    const ws = new WebSocket(url);

    ws.on("open", () => {
      console.log("Connected to Figma plugin");
      const message: GenerateSlidesMessage = {
        type: "generate-slides",
        slides,
      };
      ws.send(JSON.stringify(message));
      console.log(`Sent ${slides.length} slides`);
      ws.close();
      resolve();
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error.message);
      reject(error);
    });

    ws.on("close", () => {
      console.log("Connection closed");
    });
  });
}

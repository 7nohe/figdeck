import { randomBytes } from "node:crypto";
import {
  type GenerateSlidesMessage,
  type HelloMessage,
  PROTOCOL_VERSION,
  type SlideContent,
} from "@figdeck/shared";
import { type WebSocket, WebSocketServer } from "ws";

const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const AUTH_TIMEOUT_MS = 5000;

export interface WsServerOptions {
  host: string;
  port: number;
  secret?: string; // If provided, require auth handshake
  cliVersion: string; // CLI package version for compatibility checking
}

export interface WsServerInstance {
  broadcast: (slides: SlideContent[]) => void;
  close: () => void;
  secret: string | null;
}

export function generateSecret(): string {
  return randomBytes(16).toString("hex");
}

export function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

export function startServer(
  initialSlides: SlideContent[],
  options: WsServerOptions,
): Promise<WsServerInstance> {
  return new Promise((resolve, reject) => {
    let latestSlides = initialSlides;
    const secret = options.secret ?? null;
    const cliVersion = options.cliVersion;
    const authenticatedClients = new WeakSet<WebSocket>();

    const wss = new WebSocketServer({
      host: options.host,
      port: options.port,
      maxPayload: MAX_PAYLOAD_BYTES,
    });
    const clients = new Set<WebSocket>();

    console.log(
      `WebSocket server started on ws://${options.host}:${options.port}`,
    );
    console.log(
      `CLI version: ${cliVersion}, Protocol version: ${PROTOCOL_VERSION}`,
    );
    if (secret) {
      console.log(`Authentication secret: ${secret}`);
    }
    console.log("Waiting for Figma plugin to connect...");

    function isAuthenticated(ws: WebSocket): boolean {
      return !secret || authenticatedClients.has(ws);
    }

    function broadcast(slides: SlideContent[]) {
      latestSlides = slides;
      const message: GenerateSlidesMessage = {
        type: "generate-slides",
        slides: latestSlides,
      };
      const data = JSON.stringify(message);

      for (const client of clients) {
        if (client.readyState === client.OPEN && isAuthenticated(client)) {
          client.send(data);
          console.log(`Sent ${slides.length} slides to plugin`);
        }
      }
    }

    wss.on("connection", (ws: WebSocket) => {
      console.log("Client connected");
      clients.add(ws);

      let authTimer: ReturnType<typeof setTimeout> | null = null;

      // Send hello message immediately on connection
      const helloMessage: HelloMessage = {
        type: "hello",
        protocolVersion: PROTOCOL_VERSION,
        cliVersion: cliVersion,
      };
      ws.send(JSON.stringify(helloMessage));

      if (secret) {
        // Set auth timeout - close if not authenticated in time
        authTimer = setTimeout(() => {
          if (!authenticatedClients.has(ws)) {
            console.log("Client failed to authenticate in time, closing");
            ws.close(4001, "Authentication timeout");
          }
        }, AUTH_TIMEOUT_MS);
      } else {
        // No auth required - send initial slides immediately
        authenticatedClients.add(ws);
        sendInitialSlides(ws);
      }

      function sendInitialSlides(client: WebSocket) {
        const message: GenerateSlidesMessage = {
          type: "generate-slides",
          slides: latestSlides,
        };
        client.send(JSON.stringify(message));
        console.log(`Sent ${latestSlides.length} slides to plugin`);
      }

      ws.on("message", (data) => {
        try {
          const response = JSON.parse(data.toString());

          // Handle hello response from plugin (version check)
          if (response.type === "hello" && response.pluginVersion) {
            const pluginVersion = response.pluginVersion as string;
            const pluginProtocol = response.protocolVersion as string;

            if (pluginProtocol !== PROTOCOL_VERSION) {
              console.warn(
                `[WARNING] Protocol version mismatch: CLI=${PROTOCOL_VERSION}, Plugin=${pluginProtocol}. ` +
                  `Update both to the same version to avoid compatibility issues.`,
              );
            } else if (pluginVersion !== cliVersion) {
              console.log(
                `[INFO] Version difference: CLI=${cliVersion}, Plugin=${pluginVersion}. ` +
                  `Consider updating to ensure compatibility.`,
              );
            } else {
              console.log(
                `Version check passed: CLI=${cliVersion}, Plugin=${pluginVersion}`,
              );
            }
            return;
          }

          // Handle auth message
          if (response.type === "auth") {
            if (!secret) {
              ws.send(JSON.stringify({ type: "auth-ok" }));
              return;
            }
            if (response.secret === secret) {
              if (authTimer) clearTimeout(authTimer);
              authenticatedClients.add(ws);
              console.log("Client authenticated successfully");
              ws.send(JSON.stringify({ type: "auth-ok" }));
              sendInitialSlides(ws);
            } else {
              console.log("Client provided invalid secret");
              ws.send(
                JSON.stringify({
                  type: "auth-error",
                  message: "Invalid secret",
                }),
              );
              ws.close(4002, "Invalid secret");
            }
            return;
          }

          // Reject non-auth messages from unauthenticated clients
          if (!isAuthenticated(ws)) {
            console.log("Rejecting message from unauthenticated client");
            return;
          }

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
        if (authTimer) clearTimeout(authTimer);
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
        secret,
      });
    });
  });
}

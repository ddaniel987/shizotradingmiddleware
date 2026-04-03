import WebSocket, { WebSocketServer } from "ws";
import { log } from "../utils/logger";

const PORT = Number(process.env.LOCAL_WS_PORT ?? 8080);

let wss: WebSocketServer | null = null;

export function startLocalWS(): void {
  wss = new WebSocketServer({ port: PORT });

  wss.on("listening", () => {
    log.success("LocalWS", `Listening on ws://0.0.0.0:${PORT}`);
  });

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress ?? "unknown";
    log.info("LocalWS", `Client connected: ${ip} (total: ${wss!.clients.size})`);

    ws.on("close", () => {
      log.info("LocalWS", `Client disconnected: ${ip} (total: ${wss!.clients.size})`);
    });

    ws.on("error", (err) => {
      log.error("LocalWS", `Client error [${ip}]: ${err.message}`);
    });
  });

  wss.on("error", (err) => {
    log.error("LocalWS", `Server error: ${err.message}`);
  });
}

/**
 * Broadcast raw JSON string to all connected clients.
 * Called with the original BloFin frame — no re-serialization.
 */
export function broadcast(data: string): void {
  if (!wss || wss.clients.size === 0) return;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { log } from "../utils/logger";

let wss: WebSocketServer;

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress;
    log.info("WebSocket", `Client connected from ${ip}`);

    ws.on("close", () => {
      log.info("WebSocket", `Client disconnected (${ip})`);
    });
  });

  log.success("WebSocket", "Server initialized");
}

export function broadcast(data: object) {
  if (!wss) return;

  const message = JSON.stringify(data);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

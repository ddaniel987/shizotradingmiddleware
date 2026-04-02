import express from "express";
import { createServer } from "http";
import routes from "./requests";
import { log } from "../utils/logger";
import { initWebSocket } from "../services/websocket";

const app = express();
const PORT = 6969;

app.use(express.json());
app.use(routes);

const server = createServer(app);

export function startServer() {
  server.listen(PORT, "0.0.0.0", () => {
    log.success("Server", `Running on http://0.0.0.0:${PORT}`);
    initWebSocket(server);
  });
}

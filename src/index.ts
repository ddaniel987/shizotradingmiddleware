import "dotenv/config";
import { startLocalWS } from "./services/localBroadcast";
import { startBlofinWS } from "./services/websocket";

startLocalWS();
startBlofinWS();

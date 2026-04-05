import WebSocket from "ws";
import crypto from "crypto";
import { log } from "../utils/logger";
import { orderService } from "./orderService";
import { broadcast } from "./localBroadcast";

const WS_URL = "wss://openapi.blofin.com/ws/private";
const PING_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 15_000;
const BASE_RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 60_000;
const MAX_SEEN_SIZE = 1_000;

function generateSign(secret: string, timestamp: string, nonce: string): string {
  const msg = `/users/self/verify` + `GET` + timestamp + nonce;
  const hexSig = crypto.createHmac("sha256", secret).update(msg).digest("hex");
  return Buffer.from(hexSig).toString("base64");
}

// Deduplicate processed events; evict oldest half when cap is reached
const seenOrders = new Set<string>();
const seenAlgoOrders = new Set<string>();

function trackSeen(set: Set<string>, id: string): void {
  if (set.size >= MAX_SEEN_SIZE) {
    const iter = set.values();
    for (let i = 0; i < MAX_SEEN_SIZE / 2; i++) {
      set.delete(iter.next().value!);
    }
  }
  set.add(id);
}

async function handleOrders(orders: any[]): Promise<void> {
  for (const order of orders) {
    const {
      orderId, state, reduceOnly, orderCategory,
      instId, marginMode, positionSide, orderType, side, size,
      tpTriggerPrice, tpOrderPrice, slTriggerPrice, slOrderPrice,
      leverage, createTime,
    } = order;

    log.info("Order Event", `${state} | ${side} ${size} ${instId} (${orderType}) reduceOnly=${reduceOnly} category=${orderCategory} TP=${tpTriggerPrice ?? "none"} SL=${slTriggerPrice ?? "none"}`);

    const isClosing =
      reduceOnly === "true" ||
      orderCategory === "tp" ||
      orderCategory === "sl";

    // New opening order
    if (!seenOrders.has(orderId) && !isClosing && (state === "live" || state === "partially_filled")) {
      trackSeen(seenOrders, orderId);
      await orderService.placeOrder({
        order_type: orderType,
        margin_mode: marginMode,
        symbol: instId,
        order_side: side,
        position_side: positionSide,
        reduce_only: false,
        quantity: size,
        leverage: leverage ?? "?",
        create_time: createTime,
        tp_sl: tpTriggerPrice
          ? {
              trigger_price_type: "last",
              tp_trigger_price: tpTriggerPrice ?? "",
              tp_order_type: "market",
              tp_order_price: tpOrderPrice ?? "-1",
              sl_trigger_price: slTriggerPrice ?? "",
              sl_order_type: "market",
              sl_order_price: slOrderPrice ?? "-1",
            }
          : undefined,
      });
    }

    // Closing order filled
    if (state === "filled" && isClosing && !seenOrders.has(orderId)) {
      trackSeen(seenOrders, orderId);
      await orderService.closePosition({
        symbol: instId,
        margin_mode: marginMode,
        position_side: positionSide,
      });
    }
  }
}

async function handleAlgoOrders(orders: any[]): Promise<void> {
  for (const order of orders) {
    const {
      algoId, state, orderType,
      instId, marginMode, side, positionSide, size,
      tpTriggerPrice, tpOrderPrice, slTriggerPrice, slOrderPrice,
    } = order;

    if (orderType !== "conditional" && orderType !== "oco") continue;

    log.info("Algo Event", `${state} | ${instId} TP=${tpTriggerPrice ?? "none"} SL=${slTriggerPrice ?? "none"}`);

    if (state === "canceled") {
      if (seenAlgoOrders.has(algoId)) {
        seenAlgoOrders.delete(algoId);
        await orderService.cancelTpSl({ order_id: 0, symbol: instId });
      }
      continue;
    }

    if (state === "live" || state === "effective") {
      const isNew = !seenAlgoOrders.has(algoId);
      trackSeen(seenAlgoOrders, algoId);

      const tpSlBody = {
        symbol: instId,
        margin_mode: marginMode,
        order_side: side,
        position_side: positionSide,
        quantity: size,
        reduce_only: true,
        trigger_price_type: "last",
        tp_trigger_price: tpTriggerPrice ?? "",
        tp_order_type: "market",
        tp_order_price: tpOrderPrice ?? "-1",
        sl_trigger_price: slTriggerPrice ?? "",
        sl_order_type: "market",
        sl_order_price: slOrderPrice ?? "-1",
        tp_sl_quantity_type: "contracts",
      };

      if (isNew) {
        await orderService.placeTpSl(tpSlBody);
      } else {
        const existing = orderService.getOpenOrders().find(
          (o) => o.symbol.toLowerCase() === instId.toLowerCase()
        );
        if (existing) {
          await orderService.amendTpSl({ id: existing.id, ...tpSlBody });
        }
      }
    }
  }
}

// --- Connection with exponential backoff, connect timeout, pong timeout ---

let reconnectAttempts = 0;

function scheduleReconnect(): void {
  const exp = Math.min(reconnectAttempts, 6);
  const delay = Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(2, exp), MAX_RECONNECT_DELAY_MS)
    + Math.random() * 2_000;
  reconnectAttempts++;
  log.info("WebSocket", `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts})...`);
  setTimeout(connect, delay);
}

function connect(): void {
  const apiKey = process.env.BLOFIN_API_KEY;
  const secret = process.env.BLOFIN_API_SECRET;
  const passphrase = process.env.BLOFIN_PASSPHRASE;

  if (!apiKey || !secret || !passphrase) {
    log.error("WebSocket", "Missing BLOFIN_API_KEY, BLOFIN_API_SECRET, or BLOFIN_PASSPHRASE");
    process.exit(1);
  }

  log.info("WebSocket", `Connecting to ${WS_URL}...`);

  let ws: WebSocket;
  try {
    ws = new WebSocket(WS_URL);
  } catch (err: any) {
    log.error("WebSocket", `Failed to create socket: ${err.message}`);
    scheduleReconnect();
    return;
  }

  let pingTimer: NodeJS.Timeout | null = null;
  let pongTimer: NodeJS.Timeout | null = null;
  let connectTimer: NodeJS.Timeout | null = null;
  let closed = false;

  function cleanup(): void {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    if (pongTimer) { clearTimeout(pongTimer); pongTimer = null; }
    if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
  }

  function forceClose(reason: string): void {
    if (closed) return;
    log.warn("WebSocket", `Force-closing: ${reason}`);
    cleanup();
    try { ws.terminate(); } catch { /* ignore */ }
    // close event fires → scheduleReconnect
  }

  // Abort if we never get "open" within the timeout
  connectTimer = setTimeout(() => forceClose("connection timed out"), CONNECT_TIMEOUT_MS);

  ws.on("open", () => {
    if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
    log.success("WebSocket", "Connected");

    const timestamp = String(Date.now());
    const nonce = timestamp;
    const sign = generateSign(secret, timestamp, nonce);

    ws.send(JSON.stringify({
      op: "login",
      args: [{ apiKey, passphrase, timestamp, sign, nonce }],
    }));
  });

  ws.on("message", async (raw) => {
    const data = raw.toString();

    if (data === "pong") {
      if (pongTimer) { clearTimeout(pongTimer); pongTimer = null; }
      return;
    }

    let msg: any;
    try {
      msg = JSON.parse(data);
    } catch {
      log.warn("WebSocket", `Unexpected non-JSON frame: ${data.slice(0, 120)}`);
      return;
    }

    if (msg.event === "login") {
      if (msg.code === "0") {
        log.success("WebSocket", "Authenticated — subscribing to orders & orders-algo");
        reconnectAttempts = 0; // reset backoff on successful auth

        ws.send(JSON.stringify({
          op: "subscribe",
          args: [{ channel: "orders" }, { channel: "orders-algo" }],
        }));

        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
            // If no pong arrives in time, the connection is dead — force reconnect
            pongTimer = setTimeout(() => forceClose("pong timeout"), PONG_TIMEOUT_MS);
          }
        }, PING_INTERVAL_MS);
      } else {
        log.error("WebSocket", `Login failed (${msg.code}): ${msg.msg} — will reconnect`);
        ws.close();
      }
      return;
    }

    if (msg.event === "subscribe") {
      log.success("WebSocket", `Subscribed to ${msg.arg?.channel}`);
      return;
    }

    if (msg.event === "error") {
      log.error("WebSocket", `Server error ${msg.code}: ${msg.msg}`);
      return;
    }

    try {
      if (msg.arg?.channel === "orders" && Array.isArray(msg.data)) {
        broadcast(data);
        await handleOrders(msg.data);
      } else if (msg.arg?.channel === "orders-algo" && Array.isArray(msg.data)) {
        broadcast(data);
        await handleAlgoOrders(msg.data);
      }
    } catch (err: any) {
      log.error("WebSocket", `Handler threw: ${err.message}`);
    }
  });

  ws.on("close", (code) => {
    if (closed) return;
    closed = true;
    cleanup();
    log.warn("WebSocket", `Disconnected (code ${code})`);
    scheduleReconnect();
  });

  ws.on("error", (err) => {
    // "close" will always follow "error" — just log here
    log.error("WebSocket", `Socket error: ${err.message}`);
  });
}

export function startBlofinWS(): void {
  connect();
}

import axios from "axios";
import { log } from "../utils/logger";
import { broadcast } from "./websocket";

const BOT_TOKEN = "8558943809:AAGc6XlLF89XkXnI54mTMSrjSOMHh-44S6M";
const CHAT_ID = "-1003833393398";
const TOPIC_ID = 2;

const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

async function send(text: string, event: string, data: object): Promise<void> {
  broadcast({ event, ...data, timestamp: Date.now() });

  try {
    await axios.post(API_URL, {
      chat_id: CHAT_ID,
      message_thread_id: TOPIC_ID,
      text,
      parse_mode: "HTML",
    });
    log.info("Telegram", "Message sent");
  } catch (err: any) {
    const detail = err.response?.data?.description || err.message;
    log.error("Telegram", `Failed to send message: ${detail}`);
  }
}

export const telegram = {
  newOrder(symbol: string, side: string, qty: string, orderType: string, tp?: string, sl?: string) {
    let msg = `🟢 <b>New Order Placed</b>\n\n`;
    msg += `<b>Symbol:</b> ${symbol}\n`;
    msg += `<b>Side:</b> ${side}\n`;
    msg += `<b>Qty:</b> ${qty}\n`;
    msg += `<b>Type:</b> ${orderType}\n`;
    if (tp) msg += `<b>TP:</b> ${tp}\n`;
    if (sl) msg += `<b>SL:</b> ${sl}\n`;
    send(msg, "newOrder", { symbol, side, qty, orderType, tp, sl });
  },

  orderClosed(symbol: string) {
    let msg = `🔴 <b>Order Closed</b>\n\n`;
    msg += `<b>Symbol:</b> ${symbol}\n`;
    send(msg, "orderClosed", { symbol });
  },

  tpSlPlaced(symbol: string, tp: string, sl: string) {
    let msg = `📌 <b>TP/SL Updated</b>\n\n`;
    msg += `<b>Symbol:</b> ${symbol}\n`;
    if (tp) msg += `<b>TP:</b> ${tp}\n`;
    if (sl) msg += `<b>SL:</b> ${sl}\n`;
    send(msg, "tpSlPlaced", { symbol, tp, sl });
  },

  tpSlAmended(symbol: string, tp: string, sl: string) {
    let msg = `✏️ <b>TP/SL Updated</b>\n\n`;
    msg += `<b>Symbol:</b> ${symbol}\n`;
    if (tp) msg += `<b>New TP:</b> ${tp}\n`;
    if (sl) msg += `<b>New SL:</b> ${sl}\n`;
    send(msg, "tpSlAmended", { symbol, tp, sl });
  },

  tpSlCancelled(symbol: string) {
    let msg = `❌ <b>TP/SL Canceled</b>\n\n`;
    msg += `<b>Symbol:</b> ${symbol}\n`;
    send(msg, "tpSlCancelled", { symbol });
  },
};

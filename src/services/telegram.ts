import axios from "axios";
import { log } from "../utils/logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";
const TOPIC_ID = 2;

const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

function formatPrice(price: string | null | undefined): string {
  if (!price) return "\u2014";
  const n = parseFloat(price);
  if (isNaN(n) || n === 0) return "\u2014";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function formatSide(side: string): string {
  return side === "buy" ? "\ud83d\udcc8 LONG" : "\ud83d\udcc9 SHORT";
}

function formatTime(ms: string): string {
  return new Date(Number(ms)).toISOString().replace("T", " ").substring(0, 16) + " UTC";
}

async function send(text: string, replyToMessageId?: number): Promise<number | null> {
  try {
    const res = await axios.post(API_URL, {
      chat_id: CHAT_ID,
      message_thread_id: TOPIC_ID,
      text,
      parse_mode: "HTML",
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    });
    const messageId = Number(res.data?.result?.message_id);
    log.info("Telegram", `Message sent${messageId ? ` (#${messageId})` : ""}`);
    return Number.isFinite(messageId) ? messageId : null;
  } catch (err: any) {
    const detail = err.response?.data?.description || err.message;
    log.error("Telegram", `Failed to send message: ${detail}`);
    return null;
  }
}

export const telegram = {
  newOrder(
    symbol: string,
    side: string,
    qty: string,
    orderType: string,
    leverage: string,
    createTime: string,
    tp?: string,
    sl?: string,
  ): Promise<number | null> {
    const dir = formatSide(side);
    const type = orderType === "market" ? "Market" : orderType === "limit" ? "Limit" : orderType;
    let msg = `\ud83d\ude80 <b>New Position Opened</b>\n`;
    msg += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    msg += `\ud83e\ude99 <b>${symbol}</b>  ${dir}  \u26a1${leverage}x\n`;
    msg += `\ud83d\udce6 Size: <code>${qty}</code>  ·  ${type}\n`;
    msg += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    msg += `\ud83d\udcb0 TP: <code>${formatPrice(tp)}</code>\n`;
    msg += `\ud83d\uded1 SL: <code>${formatPrice(sl)}</code>\n`;
    msg += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    msg += `\ud83d\udd52 <i>${formatTime(createTime)}</i>`;
    return send(msg);
  },

  orderClosed(symbol: string, side: string, qty: string, leverage: string, replyToMessageId?: number): Promise<number | null> {
    const dir = formatSide(side);
    let msg = `\ud83d\udd34 <b>Position Closed</b>\n`;
    msg += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    msg += `\ud83e\ude99 <b>${symbol}</b>  ${dir}  \u26a1${leverage}x\n`;
    msg += `\ud83d\udce6 Size: <code>${qty}</code>`;
    return send(msg, replyToMessageId);
  },

  tpSlPlaced(symbol: string, side: string, qty: string, leverage: string, tp: string, sl: string, replyToMessageId?: number): Promise<number | null> {
    const dir = formatSide(side);
    let msg = `\ud83d\udccc <b>TP/SL Set</b>\n`;
    msg += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    msg += `\ud83e\ude99 <b>${symbol}</b>  ${dir}  \u26a1${leverage}x\n`;
    msg += `\ud83d\udce6 Size: <code>${qty}</code>\n`;
    msg += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    msg += `\ud83d\udcb0 TP: <code>${formatPrice(tp)}</code>\n`;
    msg += `\ud83d\uded1 SL: <code>${formatPrice(sl)}</code>`;
    return send(msg, replyToMessageId);
  },

  tpSlAmended(
    symbol: string,
    side: string,
    qty: string,
    leverage: string,
    oldTp: string,
    oldSl: string,
    newTp: string,
    newSl: string,
    replyToMessageId?: number,
  ): Promise<number | null> {
    const dir = formatSide(side);
    const tpChanged = formatPrice(oldTp) !== formatPrice(newTp);
    const slChanged = formatPrice(oldSl) !== formatPrice(newSl);
    let msg = `\u270f\ufe0f <b>TP/SL Updated</b>\n`;
    msg += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    msg += `\ud83e\ude99 <b>${symbol}</b>  ${dir}  \u26a1${leverage}x\n`;
    msg += `\ud83d\udce6 Size: <code>${qty}</code>\n`;
    msg += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    if (tpChanged) {
      msg += `\ud83d\udcb0 TP: <code>${formatPrice(oldTp)}</code> \u2192 <code>${formatPrice(newTp)}</code>\n`;
    } else {
      msg += `\ud83d\udcb0 TP: <code>${formatPrice(newTp)}</code>\n`;
    }
    if (slChanged) {
      msg += `\ud83d\uded1 SL: <code>${formatPrice(oldSl)}</code> \u2192 <code>${formatPrice(newSl)}</code>`;
    } else {
      msg += `\ud83d\uded1 SL: <code>${formatPrice(newSl)}</code>`;
    }
    return send(msg, replyToMessageId);
  },

  tpSlCancelled(symbol: string, side: string, qty: string, leverage: string, lastTp: string, lastSl: string, replyToMessageId?: number): Promise<number | null> {
    const dir = formatSide(side);
    let msg = `\u274c <b>TP/SL Cancelled</b>\n`;
    msg += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    msg += `\ud83e\ude99 <b>${symbol}</b>  ${dir}  \u26a1${leverage}x\n`;
    msg += `\ud83d\udce6 Size: <code>${qty}</code>\n`;
    msg += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    msg += `<i>Removed TP: <code>${formatPrice(lastTp)}</code>  ·  SL: <code>${formatPrice(lastSl)}</code></i>`;
    return send(msg, replyToMessageId);
  },
};


import { Order, TpSl } from "../models/order";
import { log } from "../utils/logger";
import { telegram } from "./telegram";

class OrderService {
  private orders: Order[] = [];
  private nextOrderId = 1;

  placeOrder(body: {
    order_type: string;
    margin_mode: string;
    symbol: string;
    order_side: string;
    position_side: string;
    reduce_only: boolean;
    quantity: string;
    tp_sl?: {
      trigger_price_type: string;
      tp_trigger_price: string;
      tp_order_type: string;
      tp_order_price: string;
      sl_trigger_price: string;
      sl_order_type: string;
      sl_order_price: string;
    };
  }): Order {
    let tpSl: TpSl | null = null;
    if (body.tp_sl) {
      tpSl = {
        trigger_price_type: body.tp_sl.trigger_price_type,
        tp_trigger_price: body.tp_sl.tp_trigger_price,
        tp_order_type: body.tp_sl.tp_order_type,
        tp_order_price: body.tp_sl.tp_order_price,
        sl_trigger_price: body.tp_sl.sl_trigger_price,
        sl_order_type: body.tp_sl.sl_order_type,
        sl_order_price: body.tp_sl.sl_order_price,
      };
    }

    const order: Order = {
      id: this.nextOrderId++,
      order_type: body.order_type,
      margin_mode: body.margin_mode,
      symbol: body.symbol,
      order_side: body.order_side,
      position_side: body.position_side,
      reduce_only: body.reduce_only,
      quantity: body.quantity,
      status: "open",
      tp_sl: tpSl,
    };

    this.orders.push(order);
    log.order("PLACED", order.symbol, `#${order.id} ${order.order_side} ${order.quantity} (${order.order_type})`);
    if (tpSl) {
      log.info("Order", `  TP: ${tpSl.tp_trigger_price} | SL: ${tpSl.sl_trigger_price}`);
    }
    telegram.newOrder(
      order.symbol,
      order.order_side,
      order.quantity,
      order.order_type,
      tpSl?.tp_trigger_price,
      tpSl?.sl_trigger_price,
    );
    return order;
  }

  closePosition(body: {
    symbol: string;
    margin_mode: string;
    position_side: string;
  }): Order | null {
    const order = this.findOpenBySymbol(body.symbol);

    if (!order) {
      log.warn("Order", `No open position found for ${body.symbol}`);
      return null;
    }

    order.status = "closed";
    order.tp_sl = null;
    log.order("CLOSED", order.symbol, `#${order.id}`);
    telegram.orderClosed(order.symbol);
    return order;
  }

  placeTpSl(body: {
    symbol: string;
    margin_mode: string;
    order_side: string;
    position_side: string;
    quantity: string;
    reduce_only: boolean;
    trigger_price_type: string;
    tp_trigger_price: string | number;
    tp_order_type: string;
    tp_order_price: string;
    sl_trigger_price: string | number;
    sl_order_type: string;
    sl_order_price: string;
    tp_sl_quantity_type: string;
  }): Order | null {
    const order = this.findOpenBySymbol(body.symbol);

    if (!order) {
      log.warn("TP/SL", `No open order found for ${body.symbol}`);
      return null;
    }

    order.tp_sl = {
      trigger_price_type: body.trigger_price_type,
      tp_trigger_price: String(body.tp_trigger_price),
      tp_order_type: body.tp_order_type,
      tp_order_price: body.tp_order_price,
      sl_trigger_price: String(body.sl_trigger_price),
      sl_order_type: body.sl_order_type,
      sl_order_price: body.sl_order_price,
      tp_sl_quantity_type: body.tp_sl_quantity_type,
      quantity: body.quantity,
    };

    log.order("TP/SL PLACED", order.symbol, `#${order.id} TP=${order.tp_sl.tp_trigger_price} SL=${order.tp_sl.sl_trigger_price}`);
    telegram.tpSlPlaced(order.symbol, order.tp_sl.tp_trigger_price, order.tp_sl.sl_trigger_price);
    return order;
  }

  amendTpSl(body: {
    id: number;
    symbol: string;
    trigger_price_type: string;
    tp_order_type: string;
    sl_order_type: string;
    tp_order_price: string;
    sl_order_price: string;
    tp_sl_quantity_type: string;
    tp_trigger_price: string | number;
    quantity: string;
    sl_trigger_price: string | number;
  }): Order | null {
    const order = this.findOpenBySymbol(body.symbol);

    if (!order || !order.tp_sl) {
      log.warn("TP/SL", `No open order with TP/SL found for ${body.symbol}`);
      return null;
    }

    const oldTp = order.tp_sl.tp_trigger_price;
    const oldSl = order.tp_sl.sl_trigger_price;

    order.tp_sl.trigger_price_type = body.trigger_price_type;
    order.tp_sl.tp_trigger_price = String(body.tp_trigger_price);
    order.tp_sl.tp_order_type = body.tp_order_type;
    order.tp_sl.tp_order_price = body.tp_order_price;
    order.tp_sl.sl_trigger_price = String(body.sl_trigger_price);
    order.tp_sl.sl_order_type = body.sl_order_type;
    order.tp_sl.sl_order_price = body.sl_order_price;
    order.tp_sl.tp_sl_quantity_type = body.tp_sl_quantity_type;
    order.tp_sl.quantity = body.quantity;

    log.order("TP/SL AMENDED", order.symbol, `#${order.id} TP: ${oldTp} → ${order.tp_sl.tp_trigger_price} | SL: ${oldSl} → ${order.tp_sl.sl_trigger_price}`);
    telegram.tpSlAmended(order.symbol, order.tp_sl.tp_trigger_price, order.tp_sl.sl_trigger_price);
    return order;
  }

  cancelTpSl(body: {
    order_id: number;
    symbol: string;
  }): Order | null {
    const order = this.findOpenBySymbol(body.symbol);

    if (!order || !order.tp_sl) {
      log.warn("TP/SL", `No open order with TP/SL found for ${body.symbol}`);
      return null;
    }

    log.order("TP/SL CANCELED", order.symbol, `#${order.id}`);
    telegram.tpSlCancelled(order.symbol);
    order.tp_sl = null;
    return order;
  }

  private findOpenBySymbol(symbol: string): Order | undefined {
    return this.orders.findLast(
      (o) => o.status === "open" && o.symbol.toLowerCase() === symbol.toLowerCase()
    );
  }

  getOrders(): Order[] {
    return this.orders;
  }

  getOpenOrders(): Order[] {
    return this.orders.filter((o) => o.status === "open");
  }
}

export const orderService = new OrderService();

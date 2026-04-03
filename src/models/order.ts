export interface TpSl {
  trigger_price_type: string;
  tp_trigger_price: string;
  tp_order_type: string;
  tp_order_price: string;
  sl_trigger_price: string;
  sl_order_type: string;
  sl_order_price: string;
  tp_sl_quantity_type?: string;
  quantity?: string;
}

export interface Order {
  id: number;
  order_type: string;
  margin_mode: string;
  symbol: string;
  order_side: string;
  position_side: string;
  reduce_only: boolean;
  quantity: string;
  leverage: string;
  create_time: string;
  status: "open" | "closed";
  tp_sl: TpSl | null;
}

import { Request, Response } from "express";
import { orderService } from "../../services/orderService";

export async function tpSlPlace(req: Request, res: Response): Promise<void> {
  const order = await orderService.placeTpSl(req.body);
  if (!order) {
    res.status(404).json({ message: "no open position found for symbol" });
    return;
  }
  res.json({ message: "tp/sl placed", order });
}

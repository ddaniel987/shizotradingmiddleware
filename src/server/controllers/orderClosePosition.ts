import { Request, Response } from "express";
import { orderService } from "../../services/orderService";

export async function orderClosePosition(req: Request, res: Response): Promise<void> {
  const order = await orderService.closePosition(req.body);
  if (!order) {
    res.status(404).json({ message: "no open position found" });
    return;
  }
  res.json({ message: "position closed", order });
}

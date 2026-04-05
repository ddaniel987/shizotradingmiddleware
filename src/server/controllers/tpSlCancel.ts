import { Request, Response } from "express";
import { orderService } from "../../services/orderService";

export async function tpSlCancel(req: Request, res: Response): Promise<void> {
  const order = await orderService.cancelTpSl(req.body);
  if (!order) {
    res.status(404).json({ message: "tp/sl not found" });
    return;
  }
  res.json({ message: "tp/sl cancelled", order });
}

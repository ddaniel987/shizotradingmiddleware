import { Request, Response } from "express";
import { orderService } from "../../services/orderService";

export async function orderPlace(req: Request, res: Response): Promise<void> {
  const order = await orderService.placeOrder(req.body);
  res.json({ message: "order placed", order });
}

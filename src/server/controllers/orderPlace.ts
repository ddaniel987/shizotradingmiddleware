import { Request, Response } from "express";
import { orderService } from "../../services/orderService";

export function orderPlace(req: Request, res: Response) {
  const order = orderService.placeOrder(req.body);
  res.json({ message: "order placed", order });
}

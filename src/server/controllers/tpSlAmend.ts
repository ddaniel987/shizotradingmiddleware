import { Request, Response } from "express";
import { orderService } from "../../services/orderService";

export function tpSlAmend(req: Request, res: Response) {
  const order = orderService.amendTpSl(req.body);
  if (!order) {
    res.status(404).json({ message: "tp/sl not found" });
    return;
  }
  res.json({ message: "tp/sl amended", order });
}

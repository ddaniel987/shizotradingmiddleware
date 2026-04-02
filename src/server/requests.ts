import { Router, Request, Response, NextFunction } from "express";
import { orderPlace } from "./controllers/orderPlace";
import { orderClosePosition } from "./controllers/orderClosePosition";
import { tpSlAmend } from "./controllers/tpSlAmend";
import { tpSlCancel } from "./controllers/tpSlCancel";
import { tpSlPlace } from "./controllers/tpSlPlace";
import { log } from "../utils/logger";

const router = Router();

router.use((req: Request, _res: Response, next: NextFunction) => {
  log.request(req.method, req.path, req.body);
  next();
});

router.post("/master/order/place", orderPlace);
router.post("/master/order/close_position", orderClosePosition);
router.post("/master/tp_sl/amend", tpSlAmend);
router.post("/master/tp_sl/cancel", tpSlCancel);
router.post("/master/tp_sl/place", tpSlPlace);

export default router;

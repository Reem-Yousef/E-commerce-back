import express from "express";
import { isAuth } from "../../middleware/isauthMiddleware.js";
import {
  placeOrder,
  GetAllOrders,
  createOrder,
  createCheckoutSession,
  verifyPayment,
} from "./order-controller.js";

const router = express.Router();

router.get("/orders", isAuth, GetAllOrders);
router.post("/", createOrder);
router.post("/checkout", isAuth, placeOrder);
router.post("/create-checkout-session", isAuth, createCheckoutSession);
router.post("/verify-payment", verifyPayment);

export default router;
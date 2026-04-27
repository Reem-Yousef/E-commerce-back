import Stripe from "stripe";
import Order from "../../../DB/models/checkout-model.js";
import Cart from "../../../DB/models/cart-model.js";
import { createOrderBodySchema, createCheckoutSessionSchema } from "./order.validation.js";

// ✅ Stripe يتعمل هنا بس — مش في الراوتر
// dotenv.config() المفروض يتعمل في server.js قبل أي import
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─────────────────────────────────────────
// POST /
// ─────────────────────────────────────────
export const createOrder = async (req, res, next) => {
  try {
    const { error } = createOrderBodySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { user, items, shippingAddress, phoneNumbers, totalAmount } = req.body;

    const newOrder = new Order({
      user,
      items,
      shippingAddress,
      phoneNumbers,
      totalAmount,
      status: [{ step: "pending", time: new Date() }],
      deliveryStatus: "pending",
    });

    await newOrder.save();

    res.status(201).json({
      message: "Order placed successfully!",
      orderId: newOrder._id,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────
// POST /checkout
// ─────────────────────────────────────────
export const placeOrder = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const cart = await Cart.findOne({ user: req.user.id }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const { shippingAddress, phoneNumbers } = req.body;

    if (!shippingAddress || !phoneNumbers?.length) {
      return res.status(400).json({
        message: "Missing shipping address or phone numbers",
        required: {
          shippingAddress: "Required fields: address, city, postalCode, country",
          phoneNumbers: "At least one phone number is required",
        },
      });
    }

    const requiredAddressFields = ["address", "city", "postalCode", "country"];
    for (const field of requiredAddressFields) {
      if (!shippingAddress[field]) {
        return res.status(400).json({
          message: `Missing required shipping address field: ${field}`,
        });
      }
    }

    const items = cart.items.map((item) => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.product.price,
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    const newOrder = new Order({
      user: req.user.id,
      username: req.user.username || "",
      email: req.user.email || "",
      items,
      shippingAddress: {
        address: shippingAddress.address,
        city: shippingAddress.city,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      phoneNumbers,
      totalAmount,
      status: [{ step: "pending", time: new Date() }],
      deliveryStatus: "pending",
    });

    await newOrder.save();

    await Cart.findOneAndDelete({ user: req.user.id });

    res.status(201).json({
      message: "Order created successfully",
      order: {
        id: newOrder._id,
        totalAmount: newOrder.totalAmount,
        deliveryStatus: newOrder.deliveryStatus,
        orderedAt: newOrder.orderedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────
// POST /create-checkout-session
// ─────────────────────────────────────────
export const createCheckoutSession = async (req, res, next) => {
  try {
    const { error } = createCheckoutSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: error.details[0].message,
        details: error.details,
      });
    }

    const { items, shippingAddress, phoneNumbers, totalAmount } = req.body;

    const newOrder = new Order({
      user: req.user.id,
      username: req.user.username || "",
      email: req.user.email || "",
      items,
      shippingAddress,
      phoneNumbers,
      totalAmount,
      status: [{ step: "pending", time: new Date() }],
      deliveryStatus: "pending",
    });

    await newOrder.save();

    const lineItems = items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: { name: `Product ${item.product}` },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: {
        orderId: newOrder._id.toString(),
        userId: req.user.id,
      },
      customer_email: req.user.email,
    });

    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
      orderId: newOrder._id,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────
// POST /verify-payment
// ─────────────────────────────────────────
export const verifyPayment = async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Session ID is required" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
        payment_status: session.payment_status,
      });
    }

    await Order.findByIdAndUpdate(session.metadata.orderId, {
      deliveryStatus: "completed",
      stripeSessionId: sessionId,
      paidAt: new Date(),
    });

    res.json({
      success: true,
      message: "Payment verified successfully",
      session: {
        id: session.id,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────
// GET /orders
// ─────────────────────────────────────────
export const GetAllOrders = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const orders = await Order.find({ user: req.user.id })
      .sort({ orderedAt: -1 })
      .populate("items.product")
      .select("-__v");

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────
// GET /orders/:orderId
// ─────────────────────────────────────────
export const getOrderById = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user.id,
    }).populate("items.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────
// PATCH /orders/:orderId/cancel
// ─────────────────────────────────────────
export const cancelOrder = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user.id,
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (["delivered", "cancelled"].includes(order.deliveryStatus)) {
      return res.status(400).json({
        message: `Cannot cancel order that is ${order.deliveryStatus}`,
      });
    }

    order.status.push({ step: "cancelled", time: new Date() });
    order.deliveryStatus = "cancelled";
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order: { id: order._id, deliveryStatus: order.deliveryStatus },
    });
  } catch (err) {
    next(err);
  }
};
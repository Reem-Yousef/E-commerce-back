import User from "../../DB/models/user-model.js";
import jwt from "jsonwebtoken";

export const isAuth = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    if (!token) {
      console.warn('Auth Middleware: No token provided');
      return res.status(403).json({ message: "Please provide token" });
    }

    // Handle "Bearer " prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    // Clean up quotes if present (common issue with JSON.stringify)
    token = token.replace(/['"]+/g, '');

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);

    if (!user) {
      console.warn('Auth Middleware: User not found for ID:', payload.userId);
      return res.status(403).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err.message);
    return res.status(401).json({ message: "Invalid or expired token", error: err.message });
  }
};

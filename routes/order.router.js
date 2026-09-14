const express = require("express");
const { rateLimit } = require("express-rate-limit");

const router = express.Router();

const order = require("../controller/order.controller");

const auth = require("../middleware/auth")
const orderLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 30 minutes
    limit: 15,                 // 15 requests
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many registration attempts. Please try again later."
    }
});
router.post("/api/order",orderLimiter, auth, order)

module.exports = router

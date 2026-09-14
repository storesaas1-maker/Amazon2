const express = require("express");

const { rateLimit } = require("express-rate-limit");

const router = express.Router();

const register_controller = require("../controller/register.controller");

const logInLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    limit: 4,                 // 4 requests
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many registration attempts. Please try again later."
    }
});

// FIX: logInLimiter was created above but never passed to this route,
// so /api/auth/register had NO rate limiting at all - unlike every
// other sensitive auth endpoint (log_in, register_super_admin,
// add_problem, order, post_review), which all wire their limiter into
// the route. That left registration wide open to abuse (mass account
// creation, bcrypt-hashing DoS, email-enumeration brute forcing).
router.post("/api/auth/register",logInLimiter,register_controller)

module.exports = router
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const router = express.Router();

const log_in_controller = require("../controller/log_in.controller");
const logInLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    limit: 4,                 // 5 requests
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many registration attempts. Please try again later."
    }
});
router.post("/api/auth/log_in",logInLimiter,log_in_controller)

module.exports = router
const express = require("express");

const { rateLimit } = require("express-rate-limit");

const router = express.Router();

const register_super_admin = require("../controller/register_super_admin");
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5,                 // 5 requests
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many registration attempts. Please try again later."
    }
});
router.post("/api/auth/admin/register_super_admin",registerLimiter,register_super_admin)

module.exports = router
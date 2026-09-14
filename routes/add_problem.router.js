const express = require("express");

const { rateLimit } = require("express-rate-limit");

const router = express.Router();

const add_problem = require("../controller/add_problem.controller");

const auth = require("../middleware/auth")

const problemLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    limit: 4,                 // 5 requests
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many registration attempts. Please try again later."
    }
});

router.post("/api/admin/add_problem",problemLimiter,auth,add_problem)

module.exports = router
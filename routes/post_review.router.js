const express = require("express");

const router = express.Router();
const { rateLimit } = require("express-rate-limit");

const post_review = require("../controller/post_review.controller");

const auth = require("../middleware/auth")
const postReviewLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 30 minutes
    limit: 10,                 // 10 requests
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many registration attempts. Please try again later."
    }
});
router.post("/api/post_review",postReviewLimiter,auth,post_review)

module.exports = router
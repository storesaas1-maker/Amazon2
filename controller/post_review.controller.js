const jwt = require("jsonwebtoken");
require("dotenv").config();
const mongoose = require("mongoose");
const products = require("../models/products");
const cache = require("../utils/cache");

const MAX_REVIEW_LENGTH = 1000;

const post_review = async (req, res) => {
    try {
        if (!req.cookies || !req.cookies.token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing",
                data: []
            });
        }

        // FIX: jwt.verify() throws on an invalid/expired token instead
        // of returning a falsy value - that throw was uncaught here, so
        // it fell into the generic catch block below and came back as
        // a 500 "Internal server error" instead of a proper 401.
        let decoded;

        try {
            decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token",
                data: []
            });
        }

        const product_id = req.body.product_id;
        const review_text = req.body.review_text?.trim();

        // FIX: the frontend star-rating picker (product.page.js) has
        // always collected a 1-5 rating and sent it as `rating` in the
        // request body, but this controller never read it or stored it
        // on the review - every saved review permanently had no rating
        // field at all. The product page's rendering code
        // (`Number(r.rating) || 5`) silently papered over that by
        // defaulting every review to 5 stars, so the average
        // rating/rating breakdown shown to customers was fake instead
        // of reflecting what reviewers actually selected.
        const ratingInput = Number(req.body.rating);
        const rating =
            Number.isFinite(ratingInput) && ratingInput >= 1 && ratingInput <= 5
                ? Math.round(ratingInput)
                : 5;

        if (!product_id || !mongoose.Types.ObjectId.isValid(product_id)) {
            return res.status(400).json({
                success: false,
                message: "A valid product_id is required",
                data: []
            });
        }

        if (!review_text) {
            return res.status(400).json({
                success: false,
                message: "review_text is required",
                data: []
            });
        }

        if (review_text.length > MAX_REVIEW_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `review_text must be at most ${MAX_REVIEW_LENGTH} characters`,
                data: []
            });
        }

        const newReview = {
            _id: new mongoose.Types.ObjectId(),
            user_name: decoded.name,
            content: review_text,
            rating: rating,
            created_at: new Date()
        };

        // FIX: the old code did products.findOne() (read), mutated the
        // in-memory array, then product.save() (write) - two separate
        // round trips, and a lost-update risk under concurrent reviews
        // on the same product (two requests can both read the same
        // version, and whichever saves last silently overwrites the
        // other's review). A single atomic $push avoids both problems:
        // one round trip, and MongoDB serializes the two pushes itself
        // so neither review is lost.
        //
        // PERF: this used findOneAndUpdate(..., { new: true, select:
        // "reviews" }), which makes MongoDB read back and transfer the
        // ENTIRE reviews array on every single write. For a popular
        // product with thousands of reviews, that's thousands of
        // documents serialized and sent over the wire just to record
        // one new review, and the cost only grows as more reviews come
        // in - the most expensive part of this whole request scales
        // with total review count instead of staying constant. Nothing
        // downstream actually needs the full array back here: every
        // other connected client gets the new review live via the
        // "new_review" socket event below, and the full list is served
        // by the product-listing endpoint (which is what's cached under
        // "products" and just got invalidated). A plain updateOne (no
        // document read-back) plus returning just the review we already
        // have in memory makes this step O(1) regardless of how many
        // reviews the product has.
        const updateResult = await products.updateOne(
            { _id: product_id },
            { $push: { reviews: newReview } }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "not found",
                data: []
            });
        }

        // PERF: emit the live update first - it doesn't depend on the
        // cache being cleared, so firing it before the cache round trip
        // (cache.delByPrefix) means other viewers see the new review
        // immediately instead of waiting behind that call.
        req.io.to("users").emit("new_review", {
            product_id: product_id,
            review: newReview
        });

        await cache.delByPrefix("products");

        return res.status(201).json({
            success: true,
            message: "review added successfully",
            data: [newReview]
        });
    }
    catch (e) {
        console.log(e.message)
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: e.message
        })
    }
}
module.exports = post_review
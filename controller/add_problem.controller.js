const jwt = require("jsonwebtoken");
require("dotenv").config();

const problems = require("../models/problem");
const mongoose = require("mongoose");
const cache = require("../utils/cache");

const MAX_PROBLEM_LENGTH = 2000;
const MAX_IMAGE_URL_LENGTH = 500;

const add_problem = async (req, res) => {
    try {
        // Check token
        if (!req.cookies || !req.cookies.token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing",
                data: []
            });
        }

        let decoded;

        try {
            decoded = jwt.verify(
                req.cookies.token,
                process.env.JWT_SECRET
            );
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token",
                data: []
            });
        }

        if (!decoded.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
            return res.status(401).json({
                success: false,
                message: "invalid token",
                data: []
            });
        }

        // problem data

        const problem = req.body.problem?.trim();

        // FIX: this used to read `decoded.id` into `user_name`, so every
        // problem report was saved with the customer's MongoDB _id
        // sitting in the name field instead of their actual name (e.g.
        // an admin dashboard would show "670f2a..." instead of
        // "Ahmed") - decoded.name is what jwt.sign() actually puts the
        // display name under (see log_in/register controllers). The
        // schema also has a separate `user_id` field that was never
        // being filled in at all, which meant a problem report could
        // never be traced back to the reporting user's account -
        // that's filled in now too.
        const user_id = decoded.id;
        const user_name = decoded.name;

        const image = req.body.image?.trim();

        const phone_number = req.body.phone_number?.trim();

        const whatsApp_number = req.body.whatsApp_number?.trim();

        // FIX: the schema field is GPS_URL, not GPS — the old code read
        // req.body.GPS and saved it under the key "GPS", which mongoose
        // silently dropped since the schema has no such field, causing
        // "GPS_URL is required" at save time even though GPS was sent.
        const GPS_URL = req.body.GPS_URL?.trim();

        const order_number = req.body.order_number?.trim();

        if (!problem || !phone_number || !whatsApp_number || !GPS_URL) {
            return res.status(400).json({
                success: false,
                message: "problem, phone_number, whatsApp_number and GPS_URL are required",
                data: []
            });
        }

        if (problem.length > MAX_PROBLEM_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `problem must be at most ${MAX_PROBLEM_LENGTH} characters`,
                data: []
            });
        }

        if (image && image.length > MAX_IMAGE_URL_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `image must be at most ${MAX_IMAGE_URL_LENGTH} characters`,
                data: []
            });
        }

        const new_problem = new problems({
            problem,
            user_id,
            user_name,
            phone_number,
            whatsApp_number,
            GPS_URL,
            order_number,
            image,
        });

        await new_problem.save();

        // Socket event
        // FIX: sockets join the "admins" room (see socket.on("join_admin")
        // in server.js which calls socket.join("admins")), but this used
        // to emit to "admin" (no "s") — a silent mismatch that meant no
        // connected admin dashboard ever received this live event.
        //
        // PERF: emit right after save, before awaiting the cache clear
        // below - the live notification doesn't depend on the cache
        // being invalidated, so firing it first means admin dashboards
        // see the new problem immediately instead of waiting behind
        // that call.
        req.io.to("admins").emit("new_problem", {
            problem: new_problem
        });

        // FIX: cache.flushAll() wiped every cached key (product pages,
        // store settings, sections...) on every single problem report,
        // not just the problems cache it actually affects. Only
        // problems:page=* keys (see get_problems.controller.js) need
        // invalidating here.
        await cache.delByPrefix("problems");

        // Response
        return res.status(201).json({
            success: true,
            message: "add successfully",
            data: new_problem
        });

    } catch (e) {

        console.log(e.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: e.message
        });
    }
};

module.exports = add_problem;
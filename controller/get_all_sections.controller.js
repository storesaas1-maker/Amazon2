require("dotenv").config();

const jwt = require("jsonwebtoken");

const sections = require("../models/section");
const cache = require("../utils/cache");

const get_all_sections = async (req, res) => {
    try {

        // Check Cache
        const cachedSections = await cache.get("sections");

        if (cachedSections) {
            console.log("Sections from CACHE");

            return res.status(200).json({
                success: true,
                message: "successfully",
                data: cachedSections
            });
        }

        // Get sections from MongoDB
        const all_sections = await sections.find();

        // No sections found — an empty collection is a normal state
        // (e.g. a brand new store that hasn't created any sections
        // yet), not an error. FIX: this used to respond with 404 +
        // success:false, which every frontend caller (site-shell.js,
        // dashboard, products.page.js) already treats as a hard
        // failure and silently swallows - so nothing broke visibly,
        // but it filled the browser console/Network tab with a
        // permanent red "404 Not Found" on every single page load
        // for as long as the store has zero sections, and disagreed
        // with get_products.controller.js, which already treats
        // "zero results" as a normal 200 response with an empty
        // array. Matching that behavior here removes the false
        // alarm without changing anything callers actually do with
        // the response (they already just use `data || []`).
        if (all_sections.length === 0) {
            return res.status(200).json({
                success: true,
                message: "no sections found",
                data: []
            });
        }

        // Save sections in Cache
        await cache.set("sections", all_sections);

        console.log("Sections from DATABASE");

        return res.status(200).json({
            success: true,
            message: "successfully",
            data: all_sections
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

module.exports = get_all_sections;
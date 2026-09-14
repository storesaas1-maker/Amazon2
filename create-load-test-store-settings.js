/**
 * create-load-test-store-settings.js
 * ------------------------------------------------------------------
 * Seeds the single `store` settings document directly in MongoDB,
 * bypassing the API (POST /api/store requires a super_admin cookie,
 * which is awkward to obtain from a one-off script).
 *
 * Why this is needed:
 * The load test hits GET /api/get_store_settings from the very first
 * request (see "1. Guest Browsing & AI Assistant" in artillery.yml).
 * controller/get_store_settings.controller.js returns 404 whenever
 * `store.findOne()` finds no document at all - which is exactly what
 * happens on a fresh database (including the in-memory one started by
 * local-mongo.js), since nothing ever calls POST /api/store before
 * the test runs. That 404 isn't a bug in the endpoint itself; it's
 * missing seed data. This script is the equivalent of
 * create-load-test-users.js, but for the store settings document
 * instead of user accounts.
 *
 * Usage (same order as create-load-test-users.js):
 *   1. node local-mongo.js            (or point MONGO_URL at a real DB)
 *   2. node create-load-test-users.js
 *   3. node create-load-test-store-settings.js
 *   4. node server.js
 *   5. npx artillery run artillery.yml
 *
 * Safe to run more than once: it only creates the document if none
 * exists yet, exactly like create-load-test-users.js only inserts
 * users that don't already exist.
 * ------------------------------------------------------------------
 */

require("dotenv").config();

const mongoose = require("mongoose");

const store = require("./models/store");

const MONGO_URI =
    process.env.MONGO_URL ||
    process.env.MONGODB_URI;

async function createLoadTestStoreSettings() {
    try {
        if (!MONGO_URI) {
            throw new Error(
                "MONGO_URL or MONGODB_URI is missing from .env"
            );
        }

        console.log("Connecting to MongoDB...");

        await mongoose.connect(MONGO_URI);

        console.log("Connected to MongoDB.");

        const existingSettings = await store.findOne().lean();

        if (existingSettings) {
            console.log(
                "Store settings already exist - nothing to do."
            );
            return;
        }

        const settings = new store({
            store_name: "Load Test Store",
            store_description: "متجر تجريبي لاختبار الحمل",
            store_phone: "01000000000",
            store_whatsApp_number: "01000000000",
            store_GPS: "https://maps.google.com/?q=30.0444,31.2357",
            store_design: {
                theme: "default"
            }
        });

        await settings.save();

        console.log("Successfully created store settings document.");
    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB connection closed.");
    }
}

createLoadTestStoreSettings();
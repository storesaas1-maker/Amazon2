/**
 * check-db.js
 * ------------------------------------------------------------------
 * سكريبت بسيط يتصل مباشرة بنفس MONGO_URL اللي في .env ويطبع كل
 * البيانات الموجودة فعلياً في كل collection - عشان تتأكد بعينك من
 * جوه Atlas نفسه، من غير المرور بأي API أو فرونت اند خالص.
 *
 * الاستخدام:
 *   node check-db.js
 * ------------------------------------------------------------------
 */

require("dotenv").config();
const mongoose = require("mongoose");

const users = require("./models/users");
const products = require("./models/products");
const sections = require("./models/section");
const store = require("./models/store");
const orders = require("./models/order");
const coupons = require("./models/coupon");
const problems = require("./models/problem");

async function main() {
    console.log("Connecting to:", process.env.MONGO_URL?.replace(/:[^:@]+@/, ":****@"));

    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected. DB name:", mongoose.connection.name);
    console.log("=".repeat(60));

    const collections = [
        { name: "users", model: users },
        { name: "products", model: products },
        { name: "sections", model: sections },
        { name: "store settings", model: store },
        { name: "orders", model: orders },
        { name: "coupons", model: coupons },
        { name: "problems", model: problems },
    ];

    for (const { name, model } of collections) {
        const count = await model.countDocuments();
        console.log(`\n--- ${name} (${count} documents) ---`);
        if (count > 0) {
            const docs = await model.find().limit(20).lean();
            console.log(JSON.stringify(docs, null, 2));
        }
    }

    console.log("\n" + "=".repeat(60));
    await mongoose.connection.close();
    process.exit(0);
}

main().catch((err) => {
    console.error("Failed to connect / read:", err.message);
    process.exit(1);
});
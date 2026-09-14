require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const users = require("./models/users");

const MONGO_URI =
    process.env.MONGO_URL ||
    process.env.MONGODB_URI;

const PASSWORD = "TestPassword123";
const NUMBER_OF_USERS = 100;

async function createLoadTestUsers() {
    try {
        if (!MONGO_URI) {
            throw new Error(
                "MONGO_URI or MONGODB_URI is missing from .env"
            );
        }

        console.log("Connecting to MongoDB...");

        await mongoose.connect(MONGO_URI);

        console.log("Connected to MongoDB.");

        // Hash the test password once
        const passwordHash = await bcrypt.hash(PASSWORD, 12);

        const newUsers = [];

        for (let i = 1; i <= NUMBER_OF_USERS; i++) {
            const number = String(i).padStart(3, "0");

            const email = `loadtest${number}@example.com`;

            // Don't create the user if it already exists
            const existingUser = await users.findOne({ email });

            if (existingUser) {
                console.log(`Already exists: ${email}`);
                continue;
            }

            newUsers.push({
                name: `Load Test User ${number}`,
                email: email,
                password: passwordHash,
                role: "user",
                phone_number: `0100000${String(i).padStart(4, "0")}`,
                GPS_URL: "https://maps.google.com/?q=30.0444,31.2357",
                whatsApp_number: `0100000${String(i).padStart(4, "0")}`
            });
        }

        if (newUsers.length === 0) {
            console.log("All 100 test users already exist.");
            return;
        }

        await users.insertMany(newUsers);

        console.log(
            `Successfully created ${newUsers.length} test users.`
        );

        console.log("");
        console.log("Login information:");
        console.log("Email: loadtest001@example.com");
        console.log("Password:", PASSWORD);
        console.log("");
        console.log(
            "Users range from loadtest001@example.com to loadtest100@example.com"
        );

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB connection closed.");
    }
}

createLoadTestUsers();
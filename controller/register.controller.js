const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const users = require("../models/users");

// bcrypt cost factor. Each +1 roughly doubles the CPU time of every
// hash/compare. 12 is very safe but noticeably heavier under high
// concurrent signup load; 10 is still well above OWASP's minimum
// recommendation (>=10) and meaningfully faster per request. Bump this
// back up if signup volume is low and you'd rather trade a bit of
// throughput for extra margin.
const BCRYPT_COST = 10;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const register = async (req, res) => {
    try {

        // ==============================
        // 1. Get data from request
        // ==============================

        const user_name = req.body.name?.trim();

        const email = req.body.email?.trim().toLowerCase();

        const password = req.body.password;

        const phone_number = req.body.phone_number?.trim();

        const GPS_URL = req.body.GPS_URL?.trim();

        const whatsApp_number = req.body.whatsApp_number?.trim();


        // ==============================
        // 2. Validate required data
        // ==============================

        if (
            !user_name ||
            !email ||
            !password ||
            password.length < 8 ||
            !phone_number ||
            !whatsApp_number ||
            !GPS_URL
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email , phone number , whatsApp number , GPS URL are required and password must be at least 8 characters"
            });
        }

        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address"
            });
        }


        // ==============================
        // 3. Check email + hash password
        // ==============================
        // NOTE: this check-then-insert is only a fast, friendly early
        // exit for the common case - it can't fully prevent a race
        // between two concurrent signups with the same email (both
        // could pass this check before either saves). The real
        // guarantee is the unique index on `email` in the schema; step
        // 6 below catches the duplicate-key error that index throws so
        // the race still ends with a correct "already in use" response
        // instead of a 500.
        //
        // PERF: the email lookup (a MongoDB round trip) and the
        // password hash (a CPU-bound bcrypt call) don't depend on each
        // other, but used to run one after another. Running them
        // concurrently overlaps the DB round trip with the hashing
        // time instead of paying for both back to back, which shaves
        // real latency off every signup - the common case (email not
        // taken) benefits every time; the only cost is that on a
        // duplicate-email attempt we end up hashing a password we
        // then discard, which is cheap compared to the latency saved
        // across all the legitimate signups under high concurrency.

        const [find_user, passwordHash] = await Promise.all([
            users.findOne({ email: email }).select("_id").lean(),
            bcrypt.hash(password, BCRYPT_COST)
        ]);

        if (find_user) {
            return res.status(400).json({
                success: false,
                message: "This email address is already in use."
            });
        }


        // ==============================
        // 4. Create user
        // ==============================

        const new_user = new users({
            name: user_name,

            email: email,

            password: passwordHash,

            role: "user",

            phone_number: phone_number,

            GPS_URL: GPS_URL,

            whatsApp_number: whatsApp_number
        });


        // ==============================
        // 5. Save user
        // ==============================

        try {
            await new_user.save();
        } catch (saveError) {
            // Duplicate key on the unique `email` index: this means
            // another request registered the same email in between our
            // check above and this save (the race described in step 3).
            // Report it the same way as the friendly early check instead
            // of falling through to a generic 500.
            if (saveError.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: "This email address is already in use."
                });
            }

            throw saveError;
        }


        // ==============================
        // 6. Create JWT
        // ==============================

        const token = jwt.sign(
            {
                id: new_user._id,
                name: new_user.name,
                role: new_user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );


        // ==============================
        // 7. Save token in cookie
        // ==============================

        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000
        });


        // ==============================
        // 8. Response
        // ==============================

        return res.status(201).json({
            success: true,
            message: "Registration successful"
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

module.exports = register;
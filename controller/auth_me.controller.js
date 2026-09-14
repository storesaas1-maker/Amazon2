require("dotenv").config();

const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const users = require("../models/users");

const auth_me = async (req, res) => {
    try {


        const token = req.cookies.token;


        if (!token) {
            return res.status(401).json({
                authenticated: false,
                message: "Not authenticated"
            });
        }

        let decoded;

        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch (error) {
            return res.status(401).json({
                authenticated: false,
                message: "Invalid or expired token"
            });
        }

        if (!decoded.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
            return res.status(401).json({
                authenticated: false,
                message: "Invalid token"
            });
        }

        // FIX: this select() was missing "role", so req.user.role /
        // user.role was always undefined here — the exact reason
        // role-based redirects and dashboard guards couldn't work, even
        // after middleware/auth.js was fixed separately. /api/auth/me is
        // a different code path and needed the same fix independently.
        const user = await users.findById(decoded.id).select(
            "_id name email role"
        );

        if (!user) {
            return res.status(401).json({
                authenticated: false,
                message: "User not found"
            });
        }

        // FIX: removed the socket emit that fired on every single auth
        // check (e.g. every page load / auth-guard call). Broadcasting
        // "a user checked their own session" to the whole "users" room on
        // every request has no legitimate use case here and would spam
        // every connected client's socket listeners.
        return res.status(200).json({
            authenticated: true,
            message: "User is authenticated",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role:user.role,
            }
        });

    } catch (error) {

        console.log(error.message);

        return res.status(500).json({
            authenticated: false,
            message: "Internal server error"
        });
    }
};

module.exports = auth_me;
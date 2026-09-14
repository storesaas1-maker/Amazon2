const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const users = require("../models/users")

// Used to keep the response time roughly the same whether the email
// exists or not, so timing alone can't be used to enumerate registered
// emails. It's a fixed, precomputed bcrypt hash of a dummy password -
// bcrypt.compare() against it takes about as long as a real compare.
const DUMMY_HASH = "$2b$10$.KDsRgm.5Jay6B2dneRu5.eOjNGv.PbzLD4bxOe565GDa9Yl/Fd8i";

const log_in = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase();

        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            })
        }

        if (password.length < 8) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // FIX: role === "super_admin" is no longer rejected here. That
        // block meant a super admin could log in exactly once at
        // registration time, and then had NO way back into the system
        // once their session cookie expired or was cleared - there is
        // no other login route for that role. Super admin now
        // authenticates through this same endpoint like every other
        // role.

        // .lean() + a narrow .select(): this is a hot path under load,
        // and nothing here needs a full Mongoose document - just the
        // few fields used below.
        const find_log_in_user = await users
            .findOne({ email: email })
            .select("_id name role password")
            .lean();

        if (!find_log_in_user) {
            // Do a dummy compare so a missing-user response takes about
            // as long as a wrong-password one below - otherwise an
            // attacker could tell which emails are registered just by
            // timing responses.
            await bcrypt.compare(password, DUMMY_HASH);

            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            find_log_in_user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // FIX: this used to be wrapped in `if (find_log_in_user &&
        // passwordMatch)` with no `else`. Both conditions are always
        // true by this point (we already returned above otherwise), so
        // the check was dead weight - but if either ever became false
        // in the future, the handler would fall through the bottom of
        // the function with no response sent at all, leaving the
        // client hanging until it timed out. Removing the redundant
        // check removes that landmine.
        const token = jwt.sign(
            {
                id: find_log_in_user._id,
                name: find_log_in_user.name,
                role: find_log_in_user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            success: true,
            message: "Log in successful"
        })
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

module.exports = log_in
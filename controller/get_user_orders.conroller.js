const orders = require("../models/order");

/*
 * FIX: this used to verify the JWT and look the user up in MongoDB
 * itself (jwt.verify + users.findOne, with no .lean()/.select()),
 * duplicating exactly what the `auth` middleware already does on this
 * route (routes/get_user_orders.router.js). That meant every call to
 * this endpoint paid for an extra JWT verification *and* an extra
 * full, un-leaned database round trip on top of the one the
 * middleware already did - one of the most frequently hit endpoints
 * in both authenticated flows, and one of the endpoints that degraded
 * the most under peak load in the last test run. We now just read the
 * user the middleware already fetched, exactly like
 * controller/order.controller.js already does.
 *
 * PERF: .lean() on the orders query too - nothing here calls any
 * Mongoose document method on the results, only serializes them to
 * JSON, so there's no reason to pay for full document hydration.
 */

const get_user_orders = async (req, res) => {
    try {

        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
                data: []
            });
        }

        const all_orders = await orders
            .find({ user_id: user._id })
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: "Orders retrieved successfully",
            data: all_orders
        });
    }
    catch (e) {
        console.log(e.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: e.message
        });
    }
};

module.exports = get_user_orders;
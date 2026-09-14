const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const users = require("../models/users");
const orders = require("../models/order");
const mongoose = require("mongoose");
const cookie = require("cookie-parser");

const get_all_orders = async (req, res) => {
    try {

        // ==============================
        // Authentication
        // ==============================

        if (!req.cookies || !req.cookies.token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing",
                data: []
            });
        }

        const token = jwt.verify(
            req.cookies.token,
            process.env.JWT_SECRET
        );

        if (!token) {
            return res.status(404).json({
                success: false,
                message: "invalid token",
                data: []
            });
        }

        // ==============================
        // Pagination
        // ==============================

        // عدد الطلبات في كل صفحة
        const limit = Math.min(
            parseInt(req.query.limit) || 10,
            50
        );

        // رقم الصفحة
        const page = Math.max(
            parseInt(req.query.page) || 1,
            1
        );

        // عدد الطلبات التي سيتم تخطيها
        const skip = (page - 1) * limit;

        // ==============================
        // Get Orders
        // ==============================

        const all_orders = await orders
            .find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // ==============================
        // Count Orders
        // ==============================
        // FIX (same root cause identified in get_products.controller.js
        // under load testing): countDocuments() with no filter still runs
        // a real query MongoDB has to execute, not a cheap metadata
        // lookup - expensive under concurrent load on top of the find()
        // above. estimatedDocumentCount() reads the collection's stored
        // count from MongoDB metadata directly instead, so it's
        // effectively instant regardless of load. Safe here because
        // there is no filter on the query - the "estimated" count and
        // the true count are exactly the same in that case.

        const totalOrders = await orders.estimatedDocumentCount();

        const totalPages = Math.ceil(
            totalOrders / limit
        );

        // ==============================
        // No Orders
        // ==============================

        if (all_orders.length === 0) {
            return res.status(200).json({
                success: true,
                message: "Orders were not found",
                data: [],
                pagination: {
                    page,
                    limit,
                    totalOrders,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            });
        }

        // ==============================
        // Response
        // ==============================

        return res.status(200).json({
            success: true,
            message: "successfully",
            data: all_orders,
            pagination: {
                page,
                limit,
                totalOrders,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
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

module.exports = get_all_orders;
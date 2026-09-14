const jwt = require("jsonwebtoken");
require("dotenv").config();

const products = require("../models/products");
const mongoose = require("mongoose");
const cache = require("../utils/cache");

const update_product = async (req, res) => {
    try {

        // Check authentication token
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
            return res.status(401).json({
                success: false,
                message: "invalid token",
                data: []
            });
        }

        // Product data
        const product_name = req.body.product_name;
        const product_id = req.body.product_id;
        const product_description = req.body.product_description;

        const product_discount = Number(req.body.product_discount);
        const product_price = Number(req.body.product_price);

        const image = req.body.image;

        // Section ID
        const product_section = req.body.section;

        // Required fields
        if (
            !product_id ||
            !product_name ||
            !product_description ||
            isNaN(product_discount) ||
            isNaN(product_price) ||
            !image ||
            !product_section
        ) {
            return res.status(400).json({
                success: false,
                message: "product id, product name, product description, product discount, product price, image and section are required",
                data: []
            });
        }

        // Validate Product ID
        if (!mongoose.Types.ObjectId.isValid(product_id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product id",
                data: []
            });
        }

        // Validate Section ID
        if (!mongoose.Types.ObjectId.isValid(product_section)) {
            return res.status(400).json({
                success: false,
                message: "Invalid section id",
                data: []
            });
        }

        // Calculate final price
        const final_price =
            product_price * (1 - product_discount / 100);

        // Update product
        const new_product = await products.findOneAndUpdate(
            { _id: product_id },
            {
                name: product_name,
                description: product_description,
                price: product_price,
                discount: product_discount,
                final_price: final_price,
                image: image,

                // Save SECTION ID
                section: product_section
            },
            { new: true }
        );

        // Product not found
        if (!new_product) {
            return res.status(404).json({
                success: false,
                message: "product not found",
                data: []
            });
        }

        // Clear cache
        await cache.delByPrefix("products:");

        // Socket.io
        req.io.to("users").emit("update_product", {
            update_product: new_product
        });

        // Response
        return res.status(200).json({
            success: true,
            message: "updated successfully",
            data: new_product
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

module.exports = update_product;
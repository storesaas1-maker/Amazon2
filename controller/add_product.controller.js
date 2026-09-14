const jwt = require("jsonwebtoken");
require("dotenv").config();

const products = require("../models/products");
const mongoose = require("mongoose");
const cache = require("../utils/cache");

const add_product = async (req, res) => {
    try {

        // Check token
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
        const product_description = req.body.product_description;

        const product_discount = Number(req.body.product_discount);
        const product_price = Number(req.body.product_price);

        const image = req.body.image;

        const quantity = Number(req.body.quantity);
        // Section ID
        const section_id = req.body.section;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(section_id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid section id",
                data: []
            });
        }

        // Validate required fields
        if (
            !product_name ||
            !product_description ||
            isNaN(product_price) ||
            isNaN(product_discount) ||
            !image ||
            !section_id||
            !quantity
        ) {
            return res.status(400).json({
                success: false,
                message: "Product name, description, price, discount, image , quantity and section are required",
                data: []
            });
        }

        // Calculate final price
        const final_price =
            product_price * (1 - product_discount / 100);

        // Create product
        const new_product = new products({
            name: product_name,
            description: product_description,
            price: product_price,
            discount: product_discount,
            final_price: final_price,
            image: image,
            quantity:quantity,
            // Store SECTION ID instead of section name
            section: section_id,

            reviews: []
        });

        await new_product.save();

        // Clear all cache
        await cache.delByPrefix("products:");

        // Socket event
        req.io.to("users").emit("new_product", {
            product: new_product
        });

        // Response
        return res.status(201).json({
            success: true,
            message: "add successfully",
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

module.exports = add_product;
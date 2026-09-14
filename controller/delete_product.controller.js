const jwt = require("jsonwebtoken");
require("dotenv").config();
const products = require("../models/products");
const mongoose = require("mongoose");
const cache = require("../utils/cache");

const DEL_product = async(req,res)=>{
    try{
        if (!req.cookies || !req.cookies.token) {
        return res.status(401).json({
            success: false,
            message: "Authentication token is missing",
            data: []
        });
        }
        const token = jwt.verify(req.cookies.token,process.env.JWT_SECRET);
        if(!token){
            return res.status(404).json({
                success:false,
                message:"invalid token",
                data:[]
            })

        }
        const product_id = req.body.product_id;

        if(!product_id){
            return res.status(400).json({
                success:false,
                message:"product id is required",
                data:[]
            })

        }

        // FIX: `Product` was never imported/defined in this file — this
        // threw "Product is not defined" on every call. The correct,
        // already-imported model is `products` (lowercase, plural, matching
        // the require() at the top of the file).
        const deleted_product = await products.findByIdAndDelete(product_id);

        if (!deleted_product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
                data:[]
            });
        }
        await cache.delByPrefix("products:");
        req.io.to("users").emit("deleted_product", {
        deleted_product: deleted_product
        });
        return res.status(200).json({
            success: true,
            message: "Product deleted successfully",
            data:[]
        });
    }
    catch(e){
        console.log(e.message)
        return res.status(500).json({
            success:false,
            message:"Internal server error",
            error:e.message
        })
    }
}

module.exports = DEL_product
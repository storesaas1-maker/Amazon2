require("dotenv").config();
const products = require("../models/products");
const mongoose = require("mongoose");

const get_product_reviews = async(req,res)=>{
    try{
        // FIX: GET requests should not rely on a request body (many clients,
        // including browsers' fetch with default settings and some proxies,
        // strip or reject bodies on GET). Read product_id from the query
        // string primarily, falling back to body for backward compatibility.
        const product_id = req.query.product_id || req.body.product_id;

        if(!product_id){
            return res.status(400).json({
                success:false,
                message:"product_id is required",
                data:[]
            })
        }

        const product = await products.findOne({
            _id:product_id
        });

        if(!product){
            return res.status(404).json({
                success:false,
                message:"product not found",
                data:[]
            })
        }

        // FIX: was returning product.orders (wrong field, unrelated data).
        // The correct field holding reviews is product.reviews.
        return res.status(200).json({
            success:true,
            message:"reviews retrieved successfully",
            data:product.reviews
        })
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

module.exports = get_product_reviews
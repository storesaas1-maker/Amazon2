const jwt = require("jsonwebtoken");
require("dotenv").config();
const orders = require("../models/order");
const mongoose = require("mongoose");

const DEL_order = async(req,res)=>{
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
        const order_id = req.body.order_id;

        if(!order_id){
            return res.status(400).json({
                success:false,
                message:"order id is required",
                data:[]
            })

        }

        const deleted_order = await orders.findByIdAndDelete(order_id);

        if (!deleted_order) {
            return res.status(404).json({
                success: false,
                message: "order not found",
                data:[]
            });
        }

        req.io.to("admins").emit("deleted_order", {
        deleted_order: deleted_order
        });

        // FIX: success message said "Section deleted successfully" —
        // copy-pasted from the delete_section controller. Corrected to
        // reference the order.
        return res.status(200).json({
            success: true,
            message: "Order deleted successfully",
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

module.exports = DEL_order
const jwt = require("jsonwebtoken");
require("dotenv").config();
const users = require("../models/users");
const orders = require("../models/order");

const updated_status = async(req,res)=>{
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

        const the_new_status = req.body.status_order;

        // FIX: original condition was `if(!order_id||the_new_status)`, which
        // is true (i.e. rejects the request) whenever the_new_status is
        // truthy — meaning every valid request with a real status got
        // rejected. It should reject only when either value is MISSING.
        if(!order_id||!the_new_status){
            return res.status(400).json({
                success:false,
                message:"order_id and status_order are required",
                data:[]
            })

        }

        // FIX: `section` model was never imported/defined in this file —
        // this line would throw "section is not defined" on every call.
        // The correct model for orders is `orders`.
        const update_status = await orders.findOneAndUpdate(
            {_id:order_id},
            {
            status:the_new_status,
        },
        {new:true}
        );

        if(!update_status){
            return res.status(404).json({
                success:false,
                message:"order not found",
                data:[]
            })
        }

        // RESPONSE
        req.io.to("users").emit("update_status", {
        status: update_status
        });
        return res.status(200).json({
            success:true,
            message:"updated successfully",
            data:update_status
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

module.exports = updated_status
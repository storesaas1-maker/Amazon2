const jwt = require("jsonwebtoken");
require("dotenv").config();
const users = require("../models/users");
const mongoose = require("mongoose");

const upgrade_user_to_admin = async(req,res)=>{
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
        
        const user_id = req.body.user_id

        if(!user_id){
            return res.status(400).json({
                success:false,
                message:"user_id is required",
                data:[]
            })
        }

        // FIX: query used `userId` which was never defined anywhere in
        // this file (the actual variable holding the value is `user_id`).
        // This threw "userId is not defined" on every call.
        const upgraded_user = await users.findOneAndUpdate(
            { _id: user_id },
            { role: "admin" },
            { new: true }
        )

        // FIX: the null-check referenced `upgrade_user` (the exported
        // function name / undefined), not `upgraded_user` (the actual
        // result of the query above) — this would have thrown a
        // ReferenceError even if the query itself succeeded.
        if(!upgraded_user){
        return res.status(404).json({
            success: false,
            message: "user not found",
            data:[]
        });
        }

        req.io.to("users").emit("upgrade_user", {
        upgrade_user: upgraded_user
        });

        return res.status(200).json({
            success: true,
            message: "upgrade successful",
            data:upgraded_user
        });
    }
    catch(e){
        console.log(e.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: e.message
        });
    }
}
module.exports = upgrade_user_to_admin
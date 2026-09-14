const jwt = require("jsonwebtoken");
require("dotenv").config();
const section = require("../models/section");
const mongoose = require("mongoose");
const cache = require("../utils/cache");

const updated_section = async(req,res)=>{
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
        // requirement to add section 
        const section_name = req.body.section_name
        const section_id = req.body.section_id

        // FIX: original condition was `if(!section_name||section_id)`, which
        // is true (rejects the request) whenever section_id is truthy —
        // meaning every valid request with a real section_id got rejected.
        // It should reject only when either value is MISSING.
        if(!section_name||!section_id){
            return res.status(400).json({
                success:false,
                message:"section_name and section_id are required",
                data:[]
            })

        }
        const update_section = await section.findOneAndUpdate(
            {_id:section_id},
            {
            name:section_name,
        },
        {new:true}
    );

        if(!update_section){
            return res.status(404).json({
                success:false,
                message:"section not found",
                data:[]
            })
        }
        await cache.del("sections");
        // RESPONSE
        req.io.to("users").emit("update_section", {
        update_section: update_section
        });
        return res.status(200).json({
            success:true,
            message:"updated successfully",
            data:update_section
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

module.exports = updated_section
const jwt = require("jsonwebtoken");
require("dotenv").config();
const section = require("../models/section");
const mongoose = require("mongoose");

const cache = require("../utils/cache")

const DEL_section = async(req,res)=>{
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
        const section_id = req.body.section_id;

        if(!section_id){
            return res.status(400).json({
                success:false,
                message:"section id is required",
                data:[]
            })

        }

        // FIX: `Product` was never imported/defined in this file — this
        // threw "Product is not defined" on every call. The correct,
        // already-imported model for sections is `section`.
        const deleted_section = await section.findByIdAndDelete(section_id);

        if (!deleted_section) {
            return res.status(404).json({
                success: false,
                message: "Section not found",
                data:[]
            });
        }
        await cache.del("sections");
        req.io.to("users").emit("deleted_section", {
        deleted_section: deleted_section
        });
        return res.status(200).json({
            success: true,
            message: "Section deleted successfully",
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

module.exports = DEL_section
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const section = require("../models/section");
const mongoose = require("mongoose");
const cookie = require("cookie-parser")
const cache = require("../utils/cache");

const add_section = async(req,res)=>{
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
        if(!section_name){
            return res.status(401).json({
                success:false,
                message:"section_name is required",
                data:[]
            })

        }
        const new_section = new section({
            name:section_name,
        });

        await new_section.save()
        await cache.del("sections");
        req.io.to("users").emit("new_section", {
        section: new_section
        });
        // RESPONSE

        return res.status(201).json({
            success:true,
            message:"add successfully",
            data:new_section
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
module.exports = add_section
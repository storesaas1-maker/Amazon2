const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const users = require("../models/users");
const mongoose = require("mongoose");
const cookie = require("cookie-parser")

const get_all_users = async(req,res)=>{
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
        const all_users = await users.find()
        if(!all_users){
            return res.status(404).json({
                success:false,
                message: "users were not successfully received",
                data:[]
            })
        }
        return res.status(200).json({
            success:true,
            message:"successfully",
            data:all_users
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
module.exports = get_all_users
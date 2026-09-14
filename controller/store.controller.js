const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const store = require("../models/store");
// FIX: cache was used below (cache.del) but was never imported in this
// file — every call to this controller threw "cache is not defined".
const cache = require("../utils/cache");

const my_setting = async(req,res)=>{
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

        const store_name = req.body.store_name;

        const store_description = req.body.store_description;

        const store_phone = req.body.store_phone;

        const store_whatsApp_number = req.body.store_whatsApp_number;

        const store_GPS = req.body.store_GPS;

        const store_design = req.body.store_design;

        if(!store_name||!store_description||!store_phone||!store_whatsApp_number||!store_GPS||!store_design){
            return res.status(401).json({
                success: false,
                message: "store_name , store_description , store_phone , store_whatsApp_number , store_GPS and store_design  are required",
                data:[]
            });
        }

        await store.deleteMany({});

        const my_store = new store({
            store_name,
            store_description,
            store_phone,
            store_whatsApp_number,
            store_GPS,
            store_design,
        });

        await my_store.save()
        await cache.del("store_settings");
        req.io.to("users").emit("store_setting", {
        store_setting: my_store
        });
        return res.status(201).json({
            success: true,
            message: "update store successful",
            data:my_store
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
module.exports = my_setting
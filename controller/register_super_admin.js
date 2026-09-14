const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const users = require("../models/users");

const register_super_admin = async(req,res)=>{
    try{
        // ==============================
        // 1. Get data from request
        // ==============================

        const user_name = req.body.name?.trim();

        const email = req.body.email?.trim().toLowerCase();

        const password = req.body.password;



        if (
            !user_name ||
            !email ||
            !password ||
            password.length < 8
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email are required and password must be at least 8 characters"
            });
        }
        const find_user2 = await users.findOne({
            role:"super_admin"
        });
        if (find_user2) {
            return res.status(400).json({
                success: false,
                message: "super admin is found you can not register"
            });
        }
        const find_user = await users.findOne({
            email: email,
        });

        if (find_user) {
            return res.status(400).json({
                success: false,
                message: "This email address is already in use"
            });
        }

        // ==============================
        // 4. Hash password
        // ==============================

        const passwordHash = await bcrypt.hash(password, 12);


        // ==============================
        // 5. Create user
        // ==============================

        const new_user = new users({
            name: user_name,

            email: email,

            password: passwordHash,

            role: "super_admin",

        });
        // ==============================
        // 6. Save user
        // ==============================

        await new_user.save();

        // ==============================
        // 7. Create JWT
        // ==============================

        const token = jwt.sign(
            {
                id: new_user._id,
                name: new_user.name,
                role: new_user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );
        // ==============================
        // 8. Save token in cookie
        // ==============================

        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000
        });


        // ==============================
        // 9. Response
        // ==============================

        return res.status(201).json({
            success: true,
            message: "Registration successful"
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
module.exports = register_super_admin
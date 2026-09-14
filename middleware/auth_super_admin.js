require("dotenv").config();

const jwt = require("jsonwebtoken");
const users = require("../models/users");

const auth_super_admin = async(req,res,next)=>{
    try{
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated"
            });
        }
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (!decoded.id) {
            return res.status(401).json({
                success: false,
                message: "Invalid token"
            });
        }
        const user = await users.findById(decoded.id)
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "admin not found in database"
            });
        }
        if(user.role!=="super_admin"&&user.role!=="admin"){
            return res.status(403).json({
                success: false,
                message: "admin not found"
            }); 
        }
        req.user = user;

        next();
    }
    catch(e){
        console.log(e.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}
module.exports = auth_super_admin
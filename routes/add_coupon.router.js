const express = require("express");

const router = express.Router();

const add_coupon = require("../controller/add_coupon.controller");

const auth_super_admin = require("../middleware/auth_super_admin")

router.post("/api/admin/add_coupon",auth_super_admin,add_coupon)

module.exports = router
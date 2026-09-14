const express = require("express");

const router = express.Router();

const get_all_orders = require("../controller/get_all_orders.controller");

const auth_super_admin = require("../middleware/auth_super_admin")

router.get("/api/admin/get_all_orders",auth_super_admin,get_all_orders)

module.exports = router
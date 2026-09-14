const express = require("express");

const router = express.Router();

const delete_order = require("../controller/delete_order.controller");

const auth_super_admin = require("../middleware/auth_super_admin")

router.delete("/api/admin/delete_order",auth_super_admin,delete_order)

module.exports = router
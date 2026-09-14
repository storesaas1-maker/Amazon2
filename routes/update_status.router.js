const express = require("express");

const router = express.Router();

const update_status_of_order = require("../controller/update_status_of_order.controller");

const auth_super_admin = require("../middleware/auth_super_admin")

router.put("/api/admin/update_status_of_order",auth_super_admin,update_status_of_order)

module.exports = router
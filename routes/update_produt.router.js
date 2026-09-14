const express = require("express");

const router = express.Router();

const update_product = require("../controller/update_product.controller");

const auth_super_admin = require("../middleware/auth_super_admin")

router.put("/api/admin/update_product",auth_super_admin,update_product)

module.exports = router
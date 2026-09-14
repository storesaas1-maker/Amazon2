const express = require("express");

const router = express.Router();

const delete_product = require("../controller/delete_product.controller");

const auth_super_admin = require("../middleware/auth_super_admin")

router.delete("/api/admin/delete_product",auth_super_admin,delete_product)

module.exports = router
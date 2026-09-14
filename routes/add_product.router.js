const express = require("express");

const router = express.Router();

const add_product = require("../controller/add_product.controller");

const auth_super_admin = require("../middleware/auth_super_admin")

router.post("/api/admin/add_product",auth_super_admin,add_product)

module.exports = router
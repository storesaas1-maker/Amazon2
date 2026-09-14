const express = require("express");

const router = express.Router();

const add_section = require("../controller/add_section.controller");

const auth_super_admin = require("../middleware/auth_super_admin")

router.post("/api/admin/add_section",auth_super_admin,add_section)

module.exports = router
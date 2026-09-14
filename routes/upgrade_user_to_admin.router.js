const express = require("express");

const router = express.Router();

const upgrade_user_to_admin = require("../controller/upgrade_user_to_admin.controller");

const auth_super_admin = require("../middleware/auth_super_admin")

router.put("/api/admin/upgrade_user_to_admin",auth_super_admin,upgrade_user_to_admin)

module.exports = router
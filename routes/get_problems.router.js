const express = require("express");

const router = express.Router();

const get_problems = require("../controller/get_problems.controller");

const auth_super_admin = require("../middleware/auth_super_admin")

router.get("/api/get_problems",auth_super_admin,get_problems)

module.exports = router
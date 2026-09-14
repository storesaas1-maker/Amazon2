const express = require("express");

const router = express.Router();

const store = require("../controller/store.controller");

const auth_super_admin = require("../middleware/auth_super_admin")

router.post("/api/store",auth_super_admin,store)

module.exports = router
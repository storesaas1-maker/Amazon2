const express = require("express");

const router = express.Router();

const get_store_settings = require("../controller/get_store_settings.controller");

router.get("/api/get_store_settings",get_store_settings)

module.exports = router
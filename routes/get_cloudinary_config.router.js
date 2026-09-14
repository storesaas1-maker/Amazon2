const express = require("express");

const router = express.Router();

const get_cloudinary_config = require("../controller/get_cloudinary_config.controller");

router.get(
    "/api/get_cloudinary_config",
    get_cloudinary_config
);

module.exports = router;
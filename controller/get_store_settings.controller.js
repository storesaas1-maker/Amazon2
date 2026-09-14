require("dotenv").config();

const store = require("../models/store");
const cache = require("../utils/cache");

const get_store_settings = async (req, res) => {
  try {
    // 1. Try to get store data from Cache
    const cachedStore = await cache.get("store_settings");

    if (cachedStore) {
      console.log("Store settings from CACHE");

      return res.status(200).json({
        success: true,
        message: "store get successfully",
        data: cachedStore,
      });
    }

    // 2. If it does not exist in Cache
    // Go to MongoDB
    const my_store_setting = await store.findOne();

    if (!my_store_setting) {
      // No settings document yet — this happens on a brand new store
      // before an admin has saved any settings (see
      // controller/store.controller.js, which is what actually
      // creates this document). FIX: this used to respond 404 +
      // success:false, which theme-engine.js already handles fine by
      // falling back to its own built-in default theme - but it also
      // meant every single page load logged a permanent red "404 Not
      // Found" in the console for as long as no settings have ever
      // been saved, exactly like the same issue fixed in
      // get_all_sections.controller.js. A missing settings doc isn't
      // an error, so this now matches get_products.controller.js's
      // existing "zero results is still a 200" convention.
      return res.status(200).json({
        success: true,
        message: "no store settings configured yet",
        data: null,
      });
    }

    // 3. Store store data in Cache
    await cache.set("store_settings", my_store_setting);

    console.log("Store settings from DATABASE");

    return res.status(200).json({
      success: true,
      message: "store get successfully",
      data: my_store_setting,
    });
  } catch (e) {
    console.log(e.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: e.message,
    });
  }
};

module.exports = get_store_settings;

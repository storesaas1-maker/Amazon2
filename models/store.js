const mongoose = require("mongoose");

const schema = mongoose.Schema(
  {
    store_name: {
      type: String,
    },
    
    store_description: {
      type: String,
    },

    store_phone: {
      type: String,
    },

    store_whatsApp_number: {
      type: String,
    },

    store_GPS: {
      type: String,
    },

    store_design: {
      type: Object,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("store", schema);

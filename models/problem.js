const mongoose = require("mongoose");

const schema = mongoose.Schema(
  {
    user_id: {
      type: String,
    },

    problem: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
    },
  
    user_name: {
      type: String,
      required: true,
    },

    phone_number: {
      type: String,
      required: true,
    },

    GPS_URL: {
      type: String,
      required: true,
    },
    whatsApp_number:{
      type: String,
      required: true,
    },

    order_number:{
      type: String,
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model("problem", schema);


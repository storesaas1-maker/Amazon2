const mongoose = require("mongoose");

const schema = mongoose.Schema(
  {
    name: {
      type: String,
    },

    password: {
      type: String,
    },

    email: {
      type: String,
      unique: true,
    },

    role: {
      type: String,
      default: "user"
    },

    phone_number: {
      type: String,
      trim: true,
    },

    GPS_URL: {
      type: String,
      trim: true,
    },

    whatsApp_number: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("user", schema);
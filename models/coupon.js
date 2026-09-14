const mongoose = require("mongoose");

const schema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    discount: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    end_time: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("coupon", schema);
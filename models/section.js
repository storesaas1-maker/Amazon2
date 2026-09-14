const mongoose = require("mongoose");

const schema = mongoose.Schema(
  {
    name: {
      type: String,
    }, 
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("section", schema);

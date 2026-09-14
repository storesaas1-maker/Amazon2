const mongoose = require("mongoose");

const schema = mongoose.Schema(
  {
    name: {
      type: String,
    },

    description: {
      type: String,
    },

    price: {
      type: Number,
    },

    discount: {
      type: Number,
      default:0
    },

    final_price: {
      type: Number,
      default:0
    },

    image: {
      type: String,
    },
    
    section: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "section",
        required: true
    },
    
    reviews: {
      type: [Object],
    }, 

    quantity: {
      type: Number,
      required: true,
    }, 
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("products", schema);

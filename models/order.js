const mongoose = require("mongoose");

const schema = mongoose.Schema(
  {
    user_id: {
      type: String,
    },

    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    products: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },

        price: {
          type: Number,
          required: true,
          min: 0,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],

    total_price: {
      type: Number,
      required: true,
      min: 0,
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
    status:{
      type: String,
      required: true,
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model("order", schema);


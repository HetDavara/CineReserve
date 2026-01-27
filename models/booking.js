const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    show: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Show",
      required: true
    },
    seats: [
      {
        type: String   // e.g. A1, A2, B5
      }
    ],
    totalAmount: {
      type: Number,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);

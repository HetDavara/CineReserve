const mongoose = require("mongoose");

const screenSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    theatre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theatre",
      required: true
    },
    rows: Number,
    cols: Number
  },
  { timestamps: true }
);

module.exports = mongoose.model("Screen", screenSchema);

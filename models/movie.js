const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  language: String,
  genre: String,
  duration: Number,
  description: String,
  cities: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City"
    }
  ]
});

module.exports = mongoose.model("Movie", movieSchema);

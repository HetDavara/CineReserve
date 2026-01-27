const mongoose = require("mongoose");

const theatreSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  address: { 
    type: String, 
    required: true 
  },
  // Relationship: Each theatre belongs to exactly one City
  city: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "City",
    required: true
  },
  // Optional: Array of screen IDs that belong to this theatre
  screens: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Screen"
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model("Theatre", theatreSchema);
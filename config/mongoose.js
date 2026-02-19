require('dotenv').config(); // Load variables from .env
const mongoose = require("mongoose");

// Use the variable from .env, or a local fallback
const dbURI = process.env.MONGO_URI;

mongoose.connect(dbURI)
  .then(() => console.log("✅ MongoDB connected via environment variables"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1); // Stop the server if DB connection fails
  });

module.exports = mongoose;
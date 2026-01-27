const mongoose = require("mongoose");

const seatLockSchema = new mongoose.Schema(
  {
    show: { type: mongoose.Schema.Types.ObjectId, ref: "Show" },
    seatNumber: String,
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lockTime: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Auto delete lock after 5 minutes
seatLockSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

module.exports = mongoose.model("SeatLock", seatLockSchema);

const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/cinereserve")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

module.exports = mongoose;

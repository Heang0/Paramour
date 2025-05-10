const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  imageUrl: String,
  sizes: [String], // NEW: e.g., ["S", "M", "L"]
  createdAt: { type: Date, default: Date.now }
});



module.exports = mongoose.model('Product', productSchema);

// In models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  imageUrls: [String], // <--- THIS MUST BE AN ARRAY OF STRINGS
  sizes: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
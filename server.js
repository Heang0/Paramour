require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Connect MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ✅ Multer setup for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ✅ Product Schema
const Product = mongoose.model('Product', new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  imageUrl: String,
  sizes: [String],
  createdAt: { type: Date, default: Date.now }
}));

// ✅ Order Schema
const Order = mongoose.model('Order', new mongoose.Schema({
  fullName: String,
  email: String,
  address: String,
  phone: String,
  paymentProof: String,
  items: [{
    productId: String,
    name: String,
    quantity: Number,
    price: Number,
    size: String,
    image: String
  }],
  createdAt: { type: Date, default: Date.now }
}));

// ✅ POST /api/products
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { name, price, description } = req.body;

    let sizes = [];
    try {
      sizes = JSON.parse(req.body.sizes);
      if (!Array.isArray(sizes)) throw new Error();
    } catch {
      if (typeof req.body.sizes === 'string') {
        sizes = req.body.sizes.split(',').map(s => s.trim());
      }
    }

    const imageUrl = req.file ? '/uploads/' + req.file.filename : req.body.image_url;

    const newProduct = new Product({
      name,
      price: parseFloat(price),
      description,
      imageUrl,
      sizes
    });

    await newProduct.save();
    res.json({ message: 'Product added successfully!' });
  } catch (err) {
    console.error('❌ Error saving product:', err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// ✅ GET /api/products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ✅ GET /api/products/:id
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching product' });
  }
});

// ✅ POST /api/orders
app.post('/api/orders', async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerAddress,
      customerPhone,
      items,
      paymentProof
    } = req.body;

    const order = new Order({
      fullName: customerName,
      email: customerEmail,
      address: customerAddress,
      phone: customerPhone,
      paymentProof,
      items,
      createdAt: new Date()
    });

    await order.save();
    res.json({ message: 'Order saved successfully', orderId: order._id });
  } catch (err) {
    console.error('❌ Error saving order:', err);
    res.status(500).json({ error: 'Failed to save order' });
  }
});

// ✅ GET /api/admin/orders
app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

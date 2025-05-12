require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

const app = express();

// ✅ CORS: Allow any origin temporarily (safe fix for Render crash)
app.use(cors({
  origin: true,
  credentials: true
}));

// ✅ Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Static folders
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax' // or 'none' if using HTTPS only
  }
}));

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ✅ Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ✅ Schemas
const Product = mongoose.model('Product', new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  imageUrl: String,
  sizes: [String],
  createdAt: { type: Date, default: Date.now }
}));

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

// ✅ Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  console.log("🛂 Submitted username:", username);
  console.log("🛂 Submitted password:", password);
  console.log("🔒 ENV username:", process.env.ADMIN_USERNAME);
  console.log("🔒 ENV password:", process.env.ADMIN_PASSWORD);

  if (
    username?.trim() === process.env.ADMIN_USERNAME &&
    password?.trim() === process.env.ADMIN_PASSWORD
  ) {
    req.session.isAdmin = true;
    console.log("✅ Login successful");
    res.json({ message: 'Logged in successfully' });
  } else {
    console.warn("❌ Login failed: Invalid credentials");
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// ✅ Logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// ✅ Auth check
app.get('/api/admin/check-auth', (req, res) => {
  res.json({ authenticated: req.session.isAdmin === true });
});

// ✅ Product APIs
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

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching product' });
  }
});

// ✅ Order APIs
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
      items
    });

    await order.save();
    res.json({ message: 'Order saved successfully', orderId: order._id });
  } catch (err) {
    console.error('❌ Error saving order:', err);
    res.status(500).json({ error: 'Failed to save order' });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ✅ Catch-all route to serve frontend (for React or HTML)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

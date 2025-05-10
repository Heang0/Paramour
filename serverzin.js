
// const express = require('express');
// const mongoose = require('mongoose');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const Product = require('./models/Product');
// const Order = require('./models/Order');
// const app = express();
// require('dotenv').config();
// mongoose.connect(process.env.MONGODB_URI);
// ~
// mongoose.connect('mongodb+srv://hakchhaiheang0:iKUo1dULnkNyXV09@cluster0.pv4ugik.mongodb.net/clothez_store')
//   .then(() => console.log('✅ Connected to MongoDB Atlas'))
//   .catch(err => console.error('❌ MongoDB connection error:', err));

// app.use(express.static(path.join(__dirname, 'public')));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, 'uploads/'),
//   filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
// });
// const upload = multer({ storage });

// app.get('/api/products', async (req, res) => {
//   const search = req.query.search;
//   const query = search ? { name: { $regex: search, $options: 'i' } } : {};
//   const products = await Product.find(query);
//   res.json(products);
// });

// app.get('/api/products/:id', async (req, res) => {
//   try {
//     const product = await Product.findById(req.params.id);
//     if (!product) return res.status(404).json({ error: 'Product not found' });
//     res.json(product);
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to fetch product' });
//   }
// });

// app.post('/api/admin/products', upload.single('image'), async (req, res) => {
//   const { name, price, description, imageUrl } = req.body;
//   let image_path = imageUrl || (req.file ? '/uploads/' + req.file.filename : null);
//   if (!name || !price || !image_path) return res.status(400).json({ error: 'Missing required fields' });

//   const product = new Product({ name, price, description, image_url: image_path });
//   await product.save();
//   res.json({ message: 'Product added', product });
// });

// app.post('/api/orders', upload.single('paymentProof'), async (req, res) => {
//   try {
//     const { fullName, email, address, phone, items } = req.body;

//     const parsedItems = JSON.parse(items).map(item => ({
//       productId: item.productId,
//       name: item.name,
//       quantity: item.quantity,
//       price: item.price,
//       size: item.size,
//       image: item.image
//     }));

//     const paymentProof = req.file ? '/uploads/' + req.file.filename : '';

//     const order = new Order({
//       fullName, email, address, phone,
//       items: parsedItems,
//       paymentProof
//     });

//     await order.save();
//     res.json({ message: 'Order placed successfully', order });
//   } catch (err) {
//     console.error('Order error:', err);
//     res.status(500).json({ error: 'Failed to place order' });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

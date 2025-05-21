require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs'); // For file system operations

const app = express();

// ✅ CORS: Allow any origin temporarily (safe fix for Render crash)
app.use(cors({
    origin: process.env.FRONTEND_URL || true,
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

// ✅ Multer setup for payment proof uploads
const paymentProofStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'public/uploads/payment_proofs/';
        // Create the directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'payment_proof_' + unique + path.extname(file.originalname));
    }
});
const uploadPaymentProof = multer({ storage: paymentProofStorage });

// ✅ Multer setup for product images (UPDATED for multiple file inputs)
const productStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'public/uploads/';
        // Create the directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});
// Use uploadProduct to handle specific named file inputs ('main_image', 'carousel_images')
const uploadProduct = multer({ storage: productStorage });


// ✅ Schemas
// IMPORTANT: Ensure your separate models/Product.js file also has imageUrls: [String]
const Product = mongoose.model('Product', new mongoose.Schema({
    name: String,
    price: Number,
    description: String,
    imageUrls: [String], // <--- THIS MUST BE AN ARRAY OF STRINGS to match your separate Product.js
    sizes: [String],
    createdAt: { type: Date, default: Date.now }
}));

const Order = mongoose.model('Order', new mongoose.Schema({
    fullName: String,
    email: String,
    address: String,
    phone: String,
    paymentProof: String, // Store file path
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

const Admin = mongoose.model('Admin', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}));

// ✅ Admin Login (unchanged)
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

// ✅ Logout (unchanged)
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out' });
    });
});

// ✅ Auth check (unchanged)
app.get('/api/admin/check-auth', (req, res) => {
    res.json({ authenticated: req.session.isAdmin === true });
});

// ✅ Product APIs (UPDATED for multiple file inputs: main_image and carousel_images)
app.post('/api/products', uploadProduct.fields([
    { name: 'main_image', maxCount: 1 },
    { name: 'carousel_images', maxCount: 10 } // Allow up to 10 additional carousel images
]), async (req, res) => {
    try {
        const { name, price, description, sizes } = req.body;
        const uploadedFiles = req.files; // req.files will contain objects for 'main_image' and 'carousel_images'

        let parsedSizes = [];
        try {
            parsedSizes = JSON.parse(sizes);
            if (!Array.isArray(parsedSizes)) throw new Error();
        } catch (err) {
            console.error("❌ Error parsing sizes from JSON, attempting string split:", err);
            if (typeof sizes === 'string') {
                parsedSizes = sizes.split(',').map(s => s.trim()).filter(s => s);
            }
        }

        let imageUrls = [];

        // Handle main_image (should be the first in the array)
        if (uploadedFiles && uploadedFiles.main_image && uploadedFiles.main_image.length > 0) {
            imageUrls.push('/uploads/' + uploadedFiles.main_image[0].filename);
        } else {
            // If no main image is uploaded, send an error if required (or a default image)
            // Based on your previous admin.html, a main image is expected.
            return res.status(400).json({ error: 'A main product image is required.' });
        }

        // Handle carousel_images
        if (uploadedFiles && uploadedFiles.carousel_images && uploadedFiles.carousel_images.length > 0) {
            uploadedFiles.carousel_images.forEach(file => {
                imageUrls.push('/uploads/' + file.filename);
            });
        }

        const newProduct = new Product({
            name,
            price: parseFloat(price),
            description,
            imageUrls: imageUrls, // Store the array of URLs
            sizes: parsedSizes
        });

        await newProduct.save();
        res.json({ message: 'Product added successfully!' });
    } catch (err) {
        console.error('❌ Error saving product:', err);
        res.status(500).json({ error: 'Failed to add product', details: err.message }); // Added details for better debugging
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        console.error('❌ Error fetching products:', err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (err) {
        console.error('❌ Error fetching product by ID:', err);
        res.status(500).json({ error: 'Error fetching product' });
    }
});

// ✅ Order APIs (Updated for file upload)
app.post('/api/orders', uploadPaymentProof.single('paymentProof'), async (req, res) => {
    try {
        const {
            customerName,
            customerEmail,
            customerAddress,
            customerPhone,
            items
        } = req.body;

        // Parse the items string back to a JSON object
        let parsedItems;
        try {
            parsedItems = JSON.parse(items);
        } catch (parseError) {
            console.error("❌ Error parsing items:", parseError);
            return res.status(400).json({ error: "Invalid items format" });
        }

        if (!Array.isArray(parsedItems)) {
            return res.status(400).json({ error: "Items must be an array" });
        }

        let paymentProofPath = null;
        if (req.file) {
            paymentProofPath = '/uploads/payment_proofs/' + req.file.filename;
        } else {
            return res.status(400).json({ error: 'Payment proof is required' });
        }

        const order = new Order({
            fullName: customerName,
            email: customerEmail,
            address: customerAddress,
            phone: customerPhone,
            paymentProof: paymentProofPath,
            items: parsedItems
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
        console.error('❌ Error fetching admin orders:', err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// ✅ Catch-all route to serve frontend (for React or HTML) (unchanged)
app.get('*', (req, res) => {
    // For API requests, if they fall through to here, it means no specific API route handled them
    // This often indicates a missing route or an incorrect method.
    // If you are expecting JSON and get HTML, this is usually the culprit.
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Start server (unchanged)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
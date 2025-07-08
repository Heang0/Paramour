require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const MongoStore = require('connect-mongo'); // For persistent session store

const app = express();

// Set the view engine to ejs if you have it (only uncomment if you actually use EJS)
// app.set('view engine', 'ejs');

// ✅ CORS: Allow any origin (for development, consider specific origins in production)
app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // Use '*' for development if FRONTEND_URL isn't set, otherwise specify your frontend URL
    credentials: true
}));

// ✅ Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- IMPORTANT: Static File Serving ---
// Serve static files from the 'public' directory.
// This MUST come BEFORE your API routes and the catch-all route.
// When a request comes in for '/', Express will look for public/index.html by default.
// When a request comes in for '/style.css', it looks for public/style.css, etc.
app.use(express.static(path.join(__dirname, 'public'))); // Serve all static files from 'public' directory

// Optional: If you explicitly need '/uploads' path for existing local files.
// For Cloudinary, file links are external URLs.
// app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));


// ✅ Session setup (Updated for production-ready MongoStore)
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret_please_change', // Use a strong, unique secret
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 14 * 24 * 60 * 60 // Session TTL (Time To Live) in seconds, 14 days
    }),
    cookie: {
        httpOnly: true, // Prevents client-side JS from accessing the cookie
        sameSite: 'lax', // 'strict', 'lax', or 'none'. 'none' requires 'secure: true'
        secure: process.env.NODE_ENV === 'production' // Set to true in production (requires HTTPS)
    }
}));


// ✅ Connect to MongoDB (Removed deprecated options)
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB error:", err));

// --- Cloudinary API Setup ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Nodemailer Transporter Setup (REMOVED - no email notification) ---
// If you decide to add email notifications later, uncomment and configure this section
// along with installing nodemailer and setting up .env variables for email.
/*
const nodemailer = require('nodemailer');
let transporter;
if (process.env.SENDGRID_API_KEY) {
    transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false, // Use TLS
        auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
        }
    });
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com', // Default to Gmail if not specified
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports like 587
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
} else {
    console.warn("Nodemailer transporter not configured. Email notifications will not be sent.");
}
*/


// --- Multer Storage (using memory storage for temporary buffer for Cloudinary) ---
const uploadToMemory = multer.memoryStorage();

const uploadProductMiddleware = multer({ storage: uploadToMemory }).fields([
    { name: 'main_image', maxCount: 1 },
    { name: 'carousel_images', maxCount: 10 }
]);

const uploadPaymentProofMiddleware = multer({ storage: uploadToMemory }).single('paymentProof');

// ✅ Schemas
const Product = mongoose.model('Product', new mongoose.Schema({
    name: String,
    price: Number,
    description: String,
    imageUrls: [String],
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
    totalAmount: Number,
    createdAt: { type: Date, default: Date.now }
}));

const Admin = mongoose.model('Admin', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}));

// Function to upload a file to Cloudinary
async function uploadFileToCloudinary(fileBuffer, folderName = 'clothez_store') {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: folderName },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return reject(new Error('Failed to upload to Cloudinary: ' + error.message));
                }
                console.log("DEBUG: Cloudinary secure_url received:", result.secure_url);
                resolve(result.secure_url);
            }
        );
        uploadStream.end(fileBuffer);
    });
}

// ✅ Admin Login
// In server.js, inside the app.post('/api/admin/login', ...) route:
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    // --- ADD THESE DEBUG CONSOLE LOGS ---
    console.log("--- ADMIN LOGIN DEBUGGING ---");
    console.log(`Submitted Username (from form): "${username}" (length: ${username?.length || 0})`);
    console.log(`Submitted Password (from form): "${password}" (length: ${password?.length || 0})`);
    console.log(`ENV ADMIN_USERNAME: "${process.env.ADMIN_USERNAME}" (length: ${process.env.ADMIN_USERNAME?.length || 0})`);
    console.log(`ENV ADMIN_PASSWORD: "${process.env.ADMIN_PASSWORD}" (length: ${process.env.ADMIN_PASSWORD?.length || 0})`);
    console.log(`Comparison result username: ${username?.trim() === process.env.ADMIN_USERNAME?.trim()}`);
    console.log(`Comparison result password: ${password?.trim() === process.env.ADMIN_PASSWORD?.trim()}`);
    console.log("-----------------------------");
    // --- END DEBUG CONSOLE LOGS ---

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

// ✅ Product APIs: Add Product
app.post('/api/products', uploadProductMiddleware, async (req, res) => {
    try {
        const { name, price, description, sizes } = req.body;
        const uploadedFiles = req.files;

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
        if (uploadedFiles && uploadedFiles.main_image && uploadedFiles.main_image.length > 0) {
            const mainImageFile = uploadedFiles.main_image[0];
            const cloudinaryLink = await uploadFileToCloudinary(
                mainImageFile.buffer,
                'clothez_store_products'
            );
            imageUrls.push(cloudinaryLink);
        } else {
            return res.status(400).json({ error: 'A main product image is required.' });
        }

        if (uploadedFiles && uploadedFiles.carousel_images && uploadedFiles.carousel_images.length > 0) {
            for (const file of uploadedFiles.carousel_images) {
                const cloudinaryLink = await uploadFileToCloudinary(
                    file.buffer,
                    'clothez_store_products'
                );
                imageUrls.push(cloudinaryLink);
            }
        }

        const newProduct = new Product({
            name,
            price: parseFloat(price),
            description,
            imageUrls: imageUrls,
            sizes: parsedSizes
        });

        await newProduct.save();
        res.json({ message: 'Product added successfully!' });
    } catch (err) {
        console.error('❌ Error saving product:', err);
        res.status(500).json({ error: 'Failed to add product', details: err.message });
    }
});

// ✅ Product APIs: Get All Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        console.error('❌ Error fetching products:', err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// ✅ Product APIs: Get Product by ID
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

// ✅ Product APIs: Edit Product (Using findByIdAndUpdate to resolve VersionError)
app.put('/api/products/:id', uploadProductMiddleware, async (req, res) => {
    try {
        const { name, price, description, sizes } = req.body;
        const uploadedFiles = req.files;
        const productId = req.params.id;

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

        const existingProduct = await Product.findById(productId);
        if (!existingProduct) return res.status(404).json({ error: 'Product not found.' });

        let imageUrls = existingProduct.imageUrls || [];

        if (uploadedFiles && uploadedFiles.main_image && uploadedFiles.main_image.length > 0) {
            const mainImageFile = uploadedFiles.main_image[0];
            const cloudinaryLink = await uploadFileToCloudinary(
                mainImageFile.buffer,
                'clothez_store_products'
            );
            if (imageUrls.length > 0) {
                imageUrls[0] = cloudinaryLink;
            } else {
                imageUrls.push(cloudinaryLink);
            }
        }

        if (uploadedFiles && uploadedFiles.carousel_images && uploadedFiles.carousel_images.length > 0) {
            for (const file of uploadedFiles.carousel_images) {
                const cloudinaryLink = await uploadFileToCloudinary(
                    file.buffer,
                    'clothez_store_products'
                );
                imageUrls.push(cloudinaryLink);
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(productId, {
            name: name,
            price: parseFloat(price),
            description: description,
            sizes: parsedSizes,
            imageUrls: imageUrls
        }, { new: true, runValidators: true });

        if (!updatedProduct) return res.status(404).json({ error: 'Product not found after update attempt.' });

        res.json({ message: 'Product updated successfully!', product: updatedProduct });
    } catch (err) {
        console.error('❌ Error updating product:', err);
        res.status(500).json({ error: 'Failed to update product', details: err.message });
    }
});

// ✅ Product APIs: Delete Product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const productToDelete = await Product.findById(productId);

        if (!productToDelete) return res.status(404).json({ error: 'Product not found' });

        await Product.deleteOne({ _id: productId });
        res.json({ message: 'Product deleted successfully!' });
    } catch (err) {
        console.error('❌ Error deleting product:', err);
        res.status(500).json({ error: 'Failed to delete product', details: err.message });
    }
});

// ✅ Order APIs: Place New Order (NO EMAIL NOTIFICATION)
app.post('/api/orders', uploadPaymentProofMiddleware, async (req, res) => {
    try {
        const {
            customerName,
            customerEmail,
            customerAddress,
            customerPhone,
            items,
            totalAmount
        } = req.body;

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

        let paymentProofLink = null;
        if (req.file) {
            const file = req.file;
            paymentProofLink = await uploadFileToCloudinary(
                file.buffer,
                'clothez_store_payment_proofs'
            );
        } else {
            return res.status(400).json({ error: 'Payment proof is required' });
        }

        const order = new Order({
            fullName: customerName,
            email: customerEmail,
            address: customerAddress,
            phone: customerPhone,
            paymentProof: paymentProofLink,
            items: parsedItems,
            totalAmount: parseFloat(totalAmount)
        });

        await order.save();

        // Email Notification Code (REMOVED)
        // If you decide to add email notifications later, re-add nodemailer setup
        // and the mailOptions/transporter.sendMail(...) block here.

        res.json({ message: 'Order saved successfully', orderId: order._id });
    } catch (err) {
        console.error('❌ Error saving order:', err);
        res.status(500).json({ error: 'Failed to save order' });
    }
});

// ✅ Order APIs: Get All Orders (for Admin Panel)
app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        console.error('❌ Error fetching admin orders:', err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// ✅ Catch-all route to serve frontend (for HTML SPA)
// This MUST be the LAST route defined. It acts as a fallback for any route not matched by
// previous static file serving or API routes.
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});


// ✅ Start server
const PORT = process.env.PORT || 3000; // Render sets process.env.PORT to 10000
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
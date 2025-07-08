require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

const cloudinary = require('cloudinary').v2; // ADDED: Cloudinary setup

const app = express();

// ✅ CORS: Allow any origin temporarily (safe fix for Render crash)
app.use(cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true
}));

// ✅ Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Static folders (still useful for local development for non-uploaded assets)
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
    useNewUrlParser: true, // This option is deprecated but harmless for now
    useUnifiedTopology: true // This option is deprecated but harmless for now
}).then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB error:", err));

// --- Cloudinary API Setup ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

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
    imageUrls: [String], // Will store Cloudinary secure_url
    sizes: [String],
    createdAt: { type: Date, default: Date.now }
}));

const Order = mongoose.model('Order', new mongoose.Schema({
    fullName: String,
    email: String,
    address: String,
    phone: String,
    paymentProof: String, // Store Cloudinary secure_url
    items: [{
        productId: String,
        name: String,
        quantity: Number,
        price: Number,
        size: String,
        image: String // Cloudinary secure_url for item image
    }],
    createdAt: { type: Date, default: Date.now }
}));

const Admin = mongoose.model('Admin', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}));

// Function to upload a file to Cloudinary (FIXED PROMISE HANDLING)
async function uploadFileToCloudinary(fileBuffer, folderName = 'clothez_store') {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: folderName },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    // Ensure Promise is rejected with a clear error
                    return reject(new Error('Failed to upload to Cloudinary: ' + error.message));
                }
                console.log("DEBUG: Cloudinary secure_url received:", result.secure_url);
                // Resolve the Promise with the secure URL
                resolve(result.secure_url);
            }
        );
        // End the stream with the file buffer
        uploadStream.end(fileBuffer);
    });
}


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

        // Handle main_image
        if (uploadedFiles && uploadedFiles.main_image && uploadedFiles.main_image.length > 0) {
            const mainImageFile = uploadedFiles.main_image[0];
            const cloudinaryLink = await uploadFileToCloudinary(
                mainImageFile.buffer,
                'clothez_store_products'
            );
            imageUrls.push(cloudinaryLink);
        } else {
            // A main image is required for a new product
            return res.status(400).json({ error: 'A main product image is required.' });
        }

        // Handle carousel_images
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
            imageUrls: imageUrls, // Store the array of URLs
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

        // Fetch the existing product to retain current image URLs if no new ones are uploaded
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) return res.status(404).json({ error: 'Product not found.' });

        let imageUrls = existingProduct.imageUrls || []; // Start with existing image URLs

        // Handle main_image: If a new main image is uploaded, it replaces the first image in the array
        if (uploadedFiles && uploadedFiles.main_image && uploadedFiles.main_image.length > 0) {
            const mainImageFile = uploadedFiles.main_image[0];
            const cloudinaryLink = await uploadFileToCloudinary(
                mainImageFile.buffer,
                'clothez_store_products'
            );
            if (imageUrls.length > 0) {
                imageUrls[0] = cloudinaryLink; // Replace the first image
            } else {
                imageUrls.push(cloudinaryLink); // Add as the first image if array was empty
            }
        }

        // Handle carousel_images: New carousel images are added to the existing array
        if (uploadedFiles && uploadedFiles.carousel_images && uploadedFiles.carousel_images.length > 0) {
            for (const file of uploadedFiles.carousel_images) {
                const cloudinaryLink = await uploadFileToCloudinary(
                    file.buffer,
                    'clothez_store_products'
                );
                imageUrls.push(cloudinaryLink); // Add new carousel images
            }
        }

        // Use findByIdAndUpdate for atomic update and to bypass VersionError
        const updatedProduct = await Product.findByIdAndUpdate(productId, {
            name: name,
            price: parseFloat(price),
            description: description,
            sizes: parsedSizes,
            imageUrls: imageUrls // Update with new/retained image URLs
        }, { new: true, runValidators: true }); // `new: true` returns the updated doc

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

        // Optional: Implement Cloudinary delete if you want to remove images from Cloudinary
        // when a product is deleted. This requires storing public_id from Cloudinary response.
        /*
        for (const url of productToDelete.imageUrls) {
            // You'd need to extract public_id from the Cloudinary URL or store it separately
            // Example: const publicId = getPublicIdFromCloudinaryUrl(url);
            // if (publicId) {
            //     await cloudinary.uploader.destroy(publicId);
            //     console.log(`Cloudinary image ${publicId} deleted.`);
            // }
        }
        */

        await Product.deleteOne({ _id: productId });
        res.json({ message: 'Product deleted successfully!' });
    } catch (err) {
        console.error('❌ Error deleting product:', err);
        res.status(500).json({ error: 'Failed to delete product', details: err.message });
    }
});

// ✅ Order APIs: Place New Order
app.post('/api/orders', uploadPaymentProofMiddleware, async (req, res) => {
    try {
        const {
            customerName,
            customerEmail,
            customerAddress,
            customerPhone,
            items
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
                'clothez_store_payment_proofs' // Specific folder for payment proofs
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
            items: parsedItems
        });

        await order.save();
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

// ✅ Catch-all route to serve frontend (for React or HTML)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
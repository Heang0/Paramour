// public/cart.js

const checkoutButton = document.getElementById('checkout-btn');
const checkoutForm = document.getElementById('checkout-form');
const orderForm = document.getElementById('order-form');

// --- Show Checkout Form ---
if (checkoutButton) { // Check if button exists to avoid errors on other pages
    checkoutButton.addEventListener('click', () => {
        checkoutForm.style.display = 'block';
        checkoutButton.style.display = 'none'; // Hide the button after clicking
    });
}

// --- Submit Order ---
if (orderForm) { // Check if form exists
    orderForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Prevent the default form submission
        placeOrder(); // Call the placeOrder function to handle the order submission
    });
}

async function placeOrder() {
    const customerName = document.getElementById('customerName').value;
    const customerEmail = document.getElementById('customerEmail').value;
    const customerAddress = document.getElementById('customerAddress').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const paymentScreenshotInput = document.getElementById('paymentScreenshot'); // Get the file input element

    // Basic validation
    if (!customerName || !customerEmail || !customerAddress || !customerPhone || !paymentScreenshotInput.files.length) {
        alert('Please fill in all fields and upload payment proof.');
        return;
    }

    // Prepare cart items for the server (assuming 'cart' is globally accessible)
    const cartItemsToSend = cart.map(item => ({
        productId: item.id,
        name: item.name, // Include name
        quantity: item.quantity,
        price: item.price, // Include price
        size: item.size,
        image: item.image // This will be the Google Drive link
    }));

    const cartTotal = document.getElementById('cart-total').textContent;

    const formData = new FormData();
    formData.append('customerName', customerName);
    formData.append('customerEmail', customerEmail);
    formData.append('customerAddress', customerAddress);
    formData.append('customerPhone', customerPhone);
    formData.append('paymentProof', paymentScreenshotInput.files[0]); // Append the actual file
    formData.append('items', JSON.stringify(cartItemsToSend)); // Stringify the array
    formData.append('totalAmount', parseFloat(cartTotal));

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            body: formData, // FormData handles Content-Type automatically
        });

        const data = await response.json();

        if (response.ok) { // Check response.ok for 2xx status codes
            document.getElementById('order-id').textContent = data.orderId;
            document.getElementById('checkout-form').style.display = 'none';
            document.getElementById('order-confirmation').style.display = 'block';
            cart = []; // Clear the cart after successful order
            updateCartDisplay();
            alert(data.message); // Show success message
        } else {
            document.getElementById('order-error').style.display = 'block';
            alert('❌ Failed to place order: ' + (data.error || 'Unknown error')); // Show error from server
        }
    } catch (error) {
        console.error('❌ Error placing order:', error);
        document.getElementById('order-error').style.display = 'block';
        alert('❌ Failed to place order due to a network error.');
    }
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('product-list')) {
        // This might be redundant if products.html already calls fetchProducts.
        // It depends on whether cart.js is loaded on products.html.
        // If script.js is loaded, and it calls fetchProducts, then this might be unnecessary.
        // For safety, leave it if cart.js is separately loaded on products.html
        // or if products.html doesn't call fetchProducts itself.
        // fetchProducts();
    }
    updateCartDisplay(); // Update cart count on all pages
});
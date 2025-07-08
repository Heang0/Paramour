// public/checkout.js - CHECKOUT PAGE SPECIFIC LOGIC

let cart = []; // Local cart variable for this script

document.addEventListener('DOMContentLoaded', () => {
  cart = JSON.parse(localStorage.getItem('cart')) || []; // Load cart from localStorage
  updateCheckoutCartSummary(); // Update the cart summary displayed on checkout.html

  const orderForm = document.getElementById('order-form'); // The form on checkout.html
  if (orderForm) {
    orderForm.addEventListener('submit', handleOrderSubmit);
  }

  // Ensure navbar cart item count is updated as well (using global script.js function)
  if (typeof updateCartDisplay === 'function') {
      updateCartDisplay();
  }
});

// Updates the cart summary specifically on the checkout.html page
function updateCheckoutCartSummary() {
  const cartItemsList = document.getElementById('cart-items-list');
  const cartSubtotalElement = document.getElementById('cart-subtotal');
  const cartTotalElement = document.getElementById('cart-total');

  cartItemsList.innerHTML = '';
  let subtotal = 0;

  if (cart.length === 0) {
    cartItemsList.innerHTML = '<li class="text-muted list-group-item">Your cart is empty. Please add items to checkout.</li>';
    const placeOrderButton = document.getElementById('order-form')?.querySelector('button[type="submit"]');
    if (placeOrderButton) {
        placeOrderButton.disabled = true; // Disable submit button
    }
  } else {
    const placeOrderButton = document.getElementById('order-form')?.querySelector('button[type="submit"]');
    if (placeOrderButton) {
        placeOrderButton.disabled = false; // Enable submit button
    }

    cart.forEach(item => {
      const listItem = document.createElement('li');
      listItem.className = 'cart-item d-flex justify-content-between align-items-center list-group-item';
      listItem.innerHTML = `
        <img src="${item.image || 'https://placehold.co/80x80?text=No+Img'}" alt="${item.name}" class="item-image">
        <div class="item-details">
          <h6>${item.name}${item.size ? ` (Size: ${item.size})` : ''}</h6>
          <p class="text-muted">Quantity: ${item.quantity} x $${item.price.toFixed(2)}</p>
        </div>
        <span class="item-price">$${(item.quantity * item.price).toFixed(2)}</span>
        <button class="remove-item-btn btn btn-sm btn-danger" data-product-id="${item.id}" data-product-size="${item.size || ''}">
          <i class="bi bi-trash"></i>
        </button>
      `;
      cartItemsList.appendChild(listItem);
      subtotal += item.quantity * item.price;
    });
  }

  cartSubtotalElement.textContent = `$${subtotal.toFixed(2)}`;
  cartTotalElement.textContent = `$${subtotal.toFixed(2)}`;

  setupRemoveButtonListeners(); // Setup listeners for remove buttons on this page
}

// Setup listeners for remove buttons on the checkout summary
function setupRemoveButtonListeners() {
    // Remove previous listeners to prevent duplicates
    const existingButtons = document.querySelectorAll('.remove-item-btn');
    existingButtons.forEach(button => {
        const oldListener = button.__removeItemClickListener;
        if (oldListener) {
            button.removeEventListener('click', oldListener);
        }
    });

    // Add new listeners
    document.querySelectorAll('.remove-item-btn').forEach(button => {
        const newListener = (event) => {
            const productId = event.currentTarget.dataset.productId;
            const productSize = event.currentTarget.dataset.productSize;
            
            // Remove item from local cart (in checkout.js scope)
            cart = cart.filter(item => {
                return !(item.id == productId && (item.size || '') == productSize);
            });
            localStorage.setItem('cart', JSON.stringify(cart)); // Update localStorage

            updateCheckoutCartSummary(); // Re-render this page's cart summary
            
            // Also update global cart display (navbar count, drawer content) if script.js is loaded
            if (typeof updateCartDisplay === 'function') {
                updateCartDisplay();
            }
            if (typeof renderDrawerCart === 'function') {
                 renderDrawerCart();
            }
        };
        button.addEventListener('click', newListener);
        button.__removeItemClickListener = newListener; // Store reference to listener
    });
}


async function handleOrderSubmit(e) {
  e.preventDefault();
  const form = e.target;

  // Basic form validation (Tailwind's `was-validated` class is not directly used here, manual validation)
  let isValid = true;
  const requiredFields = ['customerName', 'customerEmail', 'customerAddress', 'customerPhone'];
  requiredFields.forEach(fieldId => {
    const input = form[fieldId];
    if (!input.value.trim()) {
      input.classList.add('border-red-500'); // Add error border
      isValid = false;
    } else {
      input.classList.remove('border-red-500');
    }
  });

  const paymentScreenshotInput = form.paymentScreenshot;
  if (!paymentScreenshotInput.files.length) {
    paymentScreenshotInput.classList.add('border-red-500');
    isValid = false;
  } else {
    paymentScreenshotInput.classList.remove('border-red-500');
  }

  if (!isValid) {
    alert('Please fill in all required fields.'); // Using native alert here
    return;
  }

  if (cart.length === 0) {
    alert('Your cart is empty. Please add items before placing an order.'); // Using native alert here
    return;
  }

  const customerName = document.getElementById('customerName').value;
  const customerEmail = document.getElementById('customerEmail').value;
  const customerAddress = document.getElementById('customerAddress').value;
  const customerPhone = document.getElementById('customerPhone').value;
  const paymentScreenshot = document.getElementById('paymentScreenshot').files[0];

  // --- FIX: Get total amount directly from cart items, not from DOM textContent ---
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Ensure total is a number and not NaN. If cart is empty, total will be 0.
  // If item.price is not a number, this will result in NaN.
  // We assume item.price is always a valid number from product data.


  const orderData = {
    customerName,
    customerEmail,
    customerAddress,
    customerPhone,
    items: cart.map(item => ({
      productId: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      size: item.size,
      image: item.image || ''
    })),
    total // Use the calculated total directly
  };

  const formData = new FormData();
  formData.append('customerName', orderData.customerName);
  formData.append('customerEmail', orderData.customerEmail);
  formData.append('customerAddress', orderData.customerAddress);
  formData.append('customerPhone', orderData.customerPhone);
  formData.append('items', JSON.stringify(orderData.items)); // items array needs to be stringified
  formData.append('totalAmount', orderData.total); // Send total as a number


  formData.append('paymentProof', paymentScreenshot); // Append the file LAST

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      body: formData,
    });

    const result = await res.json();
    if (!res.ok) {
        throw new Error(result.error || 'Order submission failed.');
    }

    showConfirmation(result.orderId, orderData);

  } catch (err) {
    document.getElementById('order-error').classList.remove('d-none');
    document.getElementById('error-message').textContent = err.message;
    console.error("Order submission error:", err);
  }
}

// Shows order confirmation and clears cart
function showConfirmation(orderId, orderData) {
  document.getElementById('order-id-display').textContent = orderId || 'N/A';
  const orderItemsSummary = document.getElementById('order-items-summary');
  const orderTotalSummary = document.getElementById('order-total-summary');
  const confirmationContainer = document.getElementById('order-confirmation-container');
  const checkoutFormContainer = document.getElementById('checkout-form-container');

  orderItemsSummary.innerHTML = '';
  orderData.items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'order-item';
    li.innerHTML = `
      <img src="${item.image || 'https://placehold.co/60x60?text=No+Img'}" class="item-image-summary" />
      <div class="item-details-summary">
        <span>${item.name} ${item.size ? `(Size: ${item.size})` : ''}</span>
        <p>Quantity: ${item.quantity}</p>
      </div>
      <span class="item-price">$${(item.price * item.quantity).toFixed(2)}</span>
    `;
    orderItemsSummary.appendChild(li);
  });

  orderTotalSummary.textContent = orderData.total.toFixed(2);

  localStorage.removeItem('cart'); // Clear local storage cart
  cart = []; // Clear current cart variable
  if (typeof updateCartDisplay === 'function') { // Update global cart display (navbar count)
      updateCartDisplay();
  }

  checkoutFormContainer.classList.add('d-none'); // Hide the form
  confirmationContainer.classList.remove('d-none'); // Show confirmation
}
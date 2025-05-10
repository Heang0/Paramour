let cart = [];

document.addEventListener('DOMContentLoaded', () => {
  cart = JSON.parse(localStorage.getItem('cart')) || [];
  updateCartDisplay();
  updateCartItemCount();

  const form = document.getElementById('checkout-form');
  if (form) {
    form.addEventListener('submit', handleOrderSubmit);
  }
});

function updateCartItemCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cart-item-count').textContent = count;
}

function updateCartDisplay() {
  const cartItemsList = document.getElementById('cart-items-list');
  const cartSubtotalElement = document.getElementById('cart-subtotal');
  const cartTotalElement = document.getElementById('cart-total');

  cartItemsList.innerHTML = '';
  let subtotal = 0;

  cart.forEach(item => {
    const listItem = document.createElement('li');
    listItem.className = 'cart-item d-flex justify-content-between align-items-center';
    listItem.innerHTML = `
      <img src="${item.image || 'placeholder.jpg'}" alt="${item.name}" class="item-image">
      <div class="item-details">
        <h6>${item.name}${item.size ? ` (Size: ${item.size})` : ''}</h6>
        <p class="text-muted">Quantity: ${item.quantity} x $${item.price.toFixed(2)}</p>
      </div>
      <span class="item-price">$${(item.quantity * item.price).toFixed(2)}</span>
      <button class="remove-item-btn" data-product-id="${item.id}${item.size ? `-${item.size}` : ''}">
        <i class="bi bi-trash"></i>
      </button>
    `;
    cartItemsList.appendChild(listItem);
    subtotal += item.quantity * item.price;
  });

  if (cart.length === 0) {
    cartItemsList.innerHTML = '<li class="text-muted">Your cart is empty.</li>';
  }

  cartSubtotalElement.textContent = `$${subtotal.toFixed(2)}`;
  cartTotalElement.textContent = `$${subtotal.toFixed(2)}`;

  document.querySelectorAll('.remove-item-btn').forEach(button => {
    button.addEventListener('click', event => {
      const productId = event.currentTarget.dataset.productId;
      cart = cart.filter(item => {
        const key = `${item.id}${item.size ? `-${item.size}` : ''}`;
        return key !== productId;
      });
      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartDisplay();
      updateCartItemCount();
    });
  });
}

async function handleOrderSubmit(e) {
  e.preventDefault();
  const form = e.target;

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  if (cart.length === 0) {
    alert('Cart is empty.');
    return;
  }

  const customerName = document.getElementById('customerName').value;
  const customerEmail = document.getElementById('customerEmail').value;
  const customerAddress = document.getElementById('customerAddress').value;
  const customerPhone = document.getElementById('customerPhone').value;
  const paymentScreenshot = document.getElementById('paymentScreenshot').files[0];

  if (!paymentScreenshot) {
    alert('Please upload payment screenshot');
    return;
  }

  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64Image = reader.result;
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const orderData = {
      customerName,
      customerEmail,
      customerAddress,
      customerPhone,
      paymentProof: base64Image,
      items: cart.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        image: item.image || ''
      })),
      total
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Order submission failed.');

      showConfirmation(result.orderId, orderData);
    } catch (err) {
      document.getElementById('order-error').classList.remove('d-none');
      document.getElementById('error-message').textContent = err.message;
    }
  };

  reader.readAsDataURL(paymentScreenshot);
}

function showConfirmation(orderId, orderData) {
  document.getElementById('order-id-display').textContent = orderId || 'N/A';
  const orderItemsSummary = document.getElementById('order-items-summary');
  const orderTotalSummary = document.getElementById('order-total-summary');
  const confirmation = document.getElementById('order-confirmation-container');
  const checkoutForm = document.getElementById('checkout-form-container');

  orderItemsSummary.innerHTML = '';
  orderData.items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'order-item';
    li.innerHTML = `
      <img src="${item.image || 'placeholder.jpg'}" class="item-image-summary" />
      <div class="item-details-summary">
        <span>${item.name} ${item.size ? `(Size: ${item.size})` : ''}</span>
        <p>Quantity: ${item.quantity}</p>
      </div>
      <span class="item-price">$${(item.price * item.quantity).toFixed(2)}</span>
    `;
    orderItemsSummary.appendChild(li);
  });

  orderTotalSummary.textContent = orderData.total.toFixed(2);

  localStorage.removeItem('cart');
  cart = [];
  updateCartItemCount();

  checkoutForm.classList.add('d-none');
  confirmation.classList.remove('d-none');
}

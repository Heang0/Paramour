let cart = JSON.parse(localStorage.getItem('cart')) || [];

// --- Core Cart Logic Functions (should be defined first) ---

function removeItemFromCart(productId, size = '') {
    cart = cart.filter(item => {
        return !(item.id == productId && (item.size || '') == (size || ''));
    });

    updateCartDisplay();
    renderDrawerCart();
}

function updateItemQuantity(productId, size = '', action) {
    const item = cart.find(p => p.id == productId && (p.size || '') == (size || ''));
    if (!item) return;

    if (action === 'increase') {
        item.quantity++;
    } else if (action === 'decrease') {
        item.quantity--;
        if (item.quantity <= 0) return removeItemFromCart(productId, size);
    }

    updateCartDisplay();
    renderDrawerCart();
}

// THIS FUNCTION MUST BE DEFINED BEFORE renderDrawerCart CALLS IT
function setupCartDrawerEventListeners() {
    const drawer = document.getElementById('drawer-cart-items');
    if (!drawer) return;

    // Use event delegation for dynamically added elements (remove and quantity buttons)
    drawer.addEventListener('click', (event) => {
        const target = event.target;
        // Check if the clicked element or its parent is a remove button
        if (target.closest('.remove-btn')) {
            const button = target.closest('.remove-btn');
            const id = button.getAttribute('data-id');
            const size = button.getAttribute('data-size');
            removeItemFromCart(id, size);
        }
        // Check if the clicked element or its parent is a quantity button
        else if (target.closest('.qty-btn')) {
            const button = target.closest('.qty-btn');
            const action = button.getAttribute('data-action');
            const id = button.getAttribute('data-id');
            const size = button.getAttribute('data-size');
            updateItemQuantity(id, size, action);
        }
    });
}


function renderDrawerCart() {
    const drawer = document.getElementById('drawer-cart-items');
    const drawerCount = document.getElementById('drawer-cart-count');
    const drawerTotal = document.getElementById('drawer-cart-total');

    if (!drawer || !drawerCount || !drawerTotal) return;

    drawer.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        drawer.innerHTML = '<p class="text-center text-muted">Your cart is empty.</p>';
    } else {
        cart.forEach(item => {
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <a href="product-detail.html?id=${item.id}">
                    <img src="${item.image || 'https://via.placeholder.com/60x60?text=No+Image'}" alt="${item.name}">
                </a>
                <div class="cart-item-details w-100">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <strong>${item.name}</strong><br/>
                            <small>Size: ${item.size || 'N/A'}</small>
                        </div>
                        <button class="remove-btn btn p-0 text-danger" title="Remove item"
                            data-id="${item.id}" data-size="${item.size || ''}">
                            <i class="bi bi-trash" style="font-size: 1.3rem; color: black;"></i>
                        </button>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <div>
                            <button class="qty-btn qty-decrease" data-id="${item.id}" data-size="${item.size || ''}" data-action="decrease">−</button>
                            <span class="mx-2">${item.quantity}</span>
                            <button class="qty-btn qty-increase" data-id="${item.id}" data-size="${item.size || ''}" data-action="increase">+</button>
                        </div>
                        <strong>$${(item.price * item.quantity).toFixed(2)}</strong>
                    </div>
                </div>
            `;
            drawer.appendChild(div);
            total += item.price * item.quantity;
        });
    }

    drawerCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    drawerTotal.textContent = total.toFixed(2);

    // Call setupCartDrawerEventListeners AFTER the drawer content is rendered
    setupCartDrawerEventListeners();
}

function updateCartDisplay() {
    const cartItemCountSpan = document.querySelectorAll('#cart-item-count');
    cartItemCountSpan.forEach(span => {
        span.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    });

    const cartItemsList = document.getElementById('cart-items');
    const cartTotalSpan = document.getElementById('cart-total');

    if (cartItemsList && cartTotalSpan) {
        cartItemsList.innerHTML = '';
        let total = 0;

        if (cart.length === 0) {
            cartItemsList.innerHTML = '<li class="list-group-item">Your cart is empty.</li>';
            cartTotalSpan.textContent = '0.00';
        } else {
            cart.forEach(item => {
                const listItem = document.createElement('li');
                listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                listItem.innerHTML = `
                    <img src="${item.image || 'https://via.placeholder.com/50x50?text=No+Image'}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; margin-right: 10px; border-radius: 4px;">
                    ${item.name} (Qty: ${item.quantity}${item.size ? ', Size: ' + item.size : ''}) - $${(item.price * item.quantity).toFixed(2)}
                    <button class="remove-cart-item btn btn-sm btn-danger"
                            data-id="${item.id}"
                            data-size="${item.size || ''}">
                        <i class="bi bi-trash"></i>
                    </button>
                `;
                total += item.price * item.quantity;
                cartItemsList.appendChild(listItem);
            });
            cartTotalSpan.textContent = total.toFixed(2);
        }
    }

    localStorage.setItem('cart', JSON.stringify(cart));
}


function addItemToCart(productId, name, price, size = '', image = '') {
    size = size || ''; // Ensure size is never undefined

    const existingItem = cart.find(item => item.id == productId && (item.size || '') == size);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ id: productId, name, price, quantity: 1, size, image });
    }

    updateCartDisplay();
    renderDrawerCart();

    const drawer = document.getElementById('cart-drawer');
    if (drawer) drawer.classList.add('open');
}

// NOTE: This fetchProducts is likely for your 'products.html' if it also calls fetchProducts.
// The `products.html` now has its own `fetchProducts` logic that directly updates the DOM.
// So, this function might not be strictly necessary here if only 'products.html' calls it.
// However, if other pages try to fetch products, keep it. Just be aware of potential duplicates.
function fetchProducts() {
    fetch('/api/products')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(products => {
            const productListDiv = document.getElementById('product-list');
            if (!productListDiv) return;

            productListDiv.innerHTML = '';

            products.forEach(product => {
                const {
                    _id,
                    name = 'Unnamed Product',
                    price = 0,
                    imageUrls // Use imageUrls array
                } = product;

                // Take the first image URL for display in the list
                const displayImageUrl = imageUrls && imageUrls.length > 0 ? imageUrls[0] : 'https://via.placeholder.com/200x200?text=No+Image';

                const productCard = document.createElement('div');
                // Ensure productCard has the correct classes for products.html styles
                productCard.classList.add('col-md-4', 'col-sm-6', 'mb-4', 'product-card'); // Added product-card class

                productCard.innerHTML = `
                    <div class="card border-0 shadow-sm h-100">
                        <a href="product-detail.html?id=${_id}" class="product-image-link">
                            <img src="${displayImageUrl}" alt="${name}" class="product-image card-img-top"
                                 onerror="this.src='https://via.placeholder.com/200x200?text=No+Image';">
                        </a>
                        <div class="card-body text-center">
                            <h5 class="card-title mb-1">${name}</h5>
                            <p class="font-weight-bold mb-2">$${parseFloat(price).toFixed(2)}</p>
                            <button class="btn btn-sm btn-outline-dark add-to-cart-btn"
                                onclick="addItemToCart('${_id}', '${name.replace(/'/g, "\\'")}', ${price}, '', '${displayImageUrl}')">
                                Add to Cart
                            </button>
                        </div>
                    </div>
                `;
                productListDiv.appendChild(productCard);
            });
        })
        .catch(error => {
            console.error('Error fetching products:', error);
            const productListDiv = document.getElementById('product-list');
            if (productListDiv) {
                productListDiv.innerHTML = `<div class="col-12 text-center text-danger">Failed to load products. Please try again later.</div>`;
            }
        });
}

function setupCartDrawerEvents() {
    const drawer = document.getElementById('cart-drawer');

    // Select all nav links that have "Cart" in their text
    document.querySelectorAll('a.nav-link').forEach(link => {
        if (link.textContent.includes('Cart')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (drawer) {
                    drawer.classList.add('open');
                    renderDrawerCart(); // This calls renderDrawerCart which now calls setupCartDrawerEventListeners
                }
            });
        }
    });

    const closeBtn = document.querySelector('.close-cart');
    if (closeBtn && drawer) {
        closeBtn.addEventListener('click', () => drawer.classList.remove('open'));
    }

    const continueBtn = document.querySelector('.continue-shopping');
    if (continueBtn && drawer) {
        continueBtn.addEventListener('click', () => drawer.classList.remove('open'));
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer?.classList.contains('open')) {
            drawer.classList.remove('open');
        }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateCartDisplay();
    renderDrawerCart(); // This call also needs setupCartDrawerEventListeners to be defined
    setupCartDrawerEvents(); // This sets up the event to open the drawer
    // No need to call setupCartDrawerEventListeners here directly, as renderDrawerCart handles it

    const heroBtn = document.getElementById('hero-shop-now-btn');
    if (heroBtn) {
        heroBtn.addEventListener('click', () => {
            window.location.href = 'products.html';
        });
    }

    // The fetchProducts call here for products.html is commented out
    // because products.html already has its own DOMContentLoaded listener
    // that calls fetchProducts. Keeping both might cause double fetches or
    // overwrite issues depending on load order.
    // if (document.getElementById('product-list')) {
    //     fetchProducts();
    // }
});

// Checkout button click (for cart drawer)
const checkoutBtn = document.querySelector('#cart-drawer .checkout-btn'); // Corrected selector
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        window.location.href = 'checkout.html';
    });
}

// Search form handler - Global search bar
document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('globalSearchForm');
    const searchInput = searchForm ? searchForm.querySelector('input[type="search"]') : null; // More robust selection

    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const query = searchInput.value.trim().toLowerCase();
            if (query) {
                // Redirect to products page with search query
                window.location.href = `products.html?search=${encodeURIComponent(query)}`;
            } else {
                // If search is cleared, just go to products page to show all
                window.location.href = `products.html`;
            }
        });
    }
});
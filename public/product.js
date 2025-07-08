window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    console.error("❌ No product ID provided in URL.");
    return;
  }

  fetch(`/api/products/${id}`)
    .then(response => {
      if (!response.ok) throw new Error("Product not found");
      return response.json();
    })
    .then(product => {
      if (!product) throw new Error("No product data returned.");

      document.getElementById('product-name').textContent = product.name;
      document.getElementById('product-price').textContent = product.price.toFixed(2);
      document.getElementById('product-description').textContent = product.description || '';

      // Ensure imageUrls is an array and pick the first one for the main display
      const imageUrl = (product.imageUrls && product.imageUrls.length > 0)
                       ? product.imageUrls[0]
                       : 'https://via.placeholder.com/200x200?text=No+Image';

      document.getElementById('product-image').src = imageUrl;
      document.getElementById('product-image').alt = product.name;

    })
    .catch(error => {
      console.error("❌ Error loading product:", error);
      document.getElementById('product-name').textContent = 'Product Not Found';
      document.getElementById('product-price').textContent = '--';
      document.getElementById('product-description').textContent = 'Sorry, this product could not be loaded.';
      document.getElementById('product-image').src = '';
    });
});
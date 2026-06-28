/* ============================================================
   PRODUCTS — Load from products.json and render to page
   Exposes: window.GoldsProducts
   Depends on: cart.js (for addItem), category.css (card styles)

   Auto-init: if .product-grid[data-category] exists on the page,
   products are fetched and rendered automatically on DOMContentLoaded.
============================================================ */
(function () {
  'use strict';

  /* Path is relative to the page URL — all order pages live in order/ */
  var DATA_URL = '../assets/data/products.json';

  var Products = {};

  /* ── Fetch the full product list ── */
  Products.fetchAll = function (callback) {
    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        callback(null, data.products || []);
      })
      .catch(function (err) {
        callback(err, []);
      });
  };

  /* ── Filter by category, excluding unavailable items ── */
  Products.filterByCategory = function (products, category) {
    return products.filter(function (p) {
      return p.category === category && p.available !== false;
    });
  };

  /* ── Build a single product card DOM element ── */
  Products.renderCard = function (product) {
    var card = document.createElement('article');
    card.className = 'product-card';
    card.dataset.id = product.id;

    /* image — placeholder gradient when no image path is provided */
    var imageHtml = product.image
      ? '<img src="../' + product.image + '" alt="' + product.name + '" loading="lazy" />'
      : '<div class="product-image-placeholder" aria-hidden="true"></div>';

    /* price */
    var priceFormatted = product.price.toLocaleString('he-IL') + ' ₪';

    card.innerHTML = [
      '<div class="product-image">' + imageHtml + '</div>',
      '<div class="product-body">',
        '<h3 class="product-name">' + product.name + '</h3>',
        '<p class="product-desc">' + product.description + '</p>',
        '<p class="product-price">',
          priceFormatted,
          '<span class="price-unit">/ ' + product.unit + '</span>',
        '</p>',
        '<div class="qty-control" role="group" aria-label="בחירת כמות">',
          '<button class="qty-btn qty-minus" aria-label="הפחת כמות" type="button">−</button>',
          '<input class="qty-value" type="number"',
            ' value="'   + product.minQty + '"',
            ' min="'     + product.minQty + '"',
            ' aria-label="כמות" />',
          '<button class="qty-btn qty-plus" aria-label="הגדל כמות" type="button">+</button>',
        '</div>',
        '<button class="btn-add-cart" type="button">הוסיפו להזמנה</button>',
      '</div>'
    ].join('');

    /* ── Quantity controls ── */
    var input    = card.querySelector('.qty-value');
    var minusBtn = card.querySelector('.qty-minus');
    var plusBtn  = card.querySelector('.qty-plus');
    var min      = product.minQty || 1;

    minusBtn.addEventListener('click', function () {
      var v = parseInt(input.value, 10);
      if (v > min) input.value = v - 1;
    });

    plusBtn.addEventListener('click', function () {
      input.value = parseInt(input.value, 10) + 1;
    });

    input.addEventListener('change', function () {
      var v = parseInt(input.value, 10);
      if (isNaN(v) || v < min) input.value = min;
    });

    /* ── Add to cart ── */
    card.querySelector('.btn-add-cart').addEventListener('click', function () {
      var qty = parseInt(input.value, 10) || min;

      if (window.GoldsCart) {
        window.GoldsCart.addItem(product, qty);
      }

      var btn = this;
      btn.textContent = 'נוסף להזמנה';
      btn.classList.add('added');

      setTimeout(function () {
        btn.textContent = 'הוסיפו להזמנה';
        btn.classList.remove('added');
      }, 1800);
    });

    return card;
  };

  /* ── Render an array of products into a container element ── */
  Products.renderAll = function (products, container) {
    container.innerHTML = '';

    if (!products.length) {
      var empty = document.createElement('p');
      empty.className = 'products-empty';
      empty.textContent = 'אין מוצרים זמינים כרגע.';
      container.appendChild(empty);
      return;
    }

    products.forEach(function (product) {
      container.appendChild(Products.renderCard(product));
    });
  };

  /*
   * Auto-init: looks for .product-grid[data-category] on the current page.
   * Category pages only need to declare:
   *   <div class="product-grid" data-category="cholent"></div>
   * and products.js handles the rest.
   */
  Products.init = function () {
    var grid = document.querySelector('.product-grid[data-category]');
    if (!grid) return;

    var category = grid.dataset.category;

    /* show loading state */
    grid.innerHTML = '<p class="products-loading">טוען מוצרים...</p>';

    Products.fetchAll(function (err, all) {
      if (err) {
        grid.innerHTML = '<p class="products-empty">שגיאה בטעינת המוצרים. אנא נסו שוב.</p>';
        return;
      }
      var filtered = Products.filterByCategory(all, category);
      Products.renderAll(filtered, grid);
    });
  };

  document.addEventListener('DOMContentLoaded', Products.init);

  window.GoldsProducts = Products;

}());
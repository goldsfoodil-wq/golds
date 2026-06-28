/* ============================================================
   CART — localStorage cart logic for Gold's ordering system
   Exposes: window.GoldsCart
   Used by: all order pages, cart.html, checkout.html
============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'golds_cart';

  /* ── Private helpers ── */

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { items: [] };
    } catch (_) {
      return { items: [] };
    }
  }

  function save(cart) {
    cart.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (_) {
      /* storage quota exceeded — fail silently */
    }
  }

  function indexOf(cart, id) {
    for (var i = 0; i < cart.items.length; i++) {
      if (cart.items[i].id === id) return i;
    }
    return -1;
  }

  /* ── Badge sync — updates every .cart-badge on the page ── */
  function syncBadges(count) {
    var badges = document.querySelectorAll('.cart-badge');
    for (var i = 0; i < badges.length; i++) {
      badges[i].textContent = count;
      badges[i].classList.toggle('visible', count > 0);
    }
  }

  /* ── Public API ── */
  var Cart = {};

  /* Full cart object { items: [...], updatedAt } */
  Cart.getCart = function () {
    return load();
  };

  /* Total number of line-item units across all products */
  Cart.getCount = function () {
    return load().items.reduce(function (sum, item) {
      return sum + (item.qty || 0);
    }, 0);
  };

  /* Total price in NIS */
  Cart.getTotal = function () {
    return load().items.reduce(function (sum, item) {
      return sum + (item.price * (item.qty || 0));
    }, 0);
  };

  /*
   * Add a product or increment its quantity.
   * product must include: { id, name, price, unit, category }
   * qty defaults to 1
   */
  Cart.addItem = function (product, qty) {
    qty = qty && qty > 0 ? qty : 1;
    var cart = load();
    var idx  = indexOf(cart, product.id);

    if (idx > -1) {
      cart.items[idx].qty += qty;
    } else {
      cart.items.push({
        id:       product.id,
        name:     product.name,
        price:    product.price,
        unit:     product.unit,
        category: product.category,
        qty:      qty
      });
    }

    save(cart);
    Cart._notify();
  };

  /*
   * Set an exact quantity for an existing item.
   * Passing qty <= 0 removes the item entirely.
   */
  Cart.updateQty = function (id, qty) {
    var cart = load();
    var idx  = indexOf(cart, id);
    if (idx === -1) return;

    if (qty <= 0) {
      cart.items.splice(idx, 1);
    } else {
      cart.items[idx].qty = qty;
    }

    save(cart);
    Cart._notify();
  };

  /* Remove a product regardless of its current quantity */
  Cart.removeItem = function (id) {
    var cart = load();
    var idx  = indexOf(cart, id);
    if (idx > -1) cart.items.splice(idx, 1);
    save(cart);
    Cart._notify();
  };

  /* Wipe the cart — called after a successful order submission */
  Cart.clearCart = function () {
    save({ items: [] });
    Cart._notify();
  };

  /* Check whether a product is already in the cart */
  Cart.hasItem = function (id) {
    return indexOf(load(), id) > -1;
  };

  /* Get quantity for a specific product (0 if not in cart) */
  Cart.getItemQty = function (id) {
    var cart = load();
    var idx  = indexOf(cart, id);
    return idx > -1 ? cart.items[idx].qty : 0;
  };

  /*
   * Internal notification — fires after every mutation.
   * Override Cart.onUpdate for custom hooks.
   * Signature: function(count) {}
   */
  Cart._notify = function () {
    var count = Cart.getCount();
    syncBadges(count);
    if (typeof Cart.onUpdate === 'function') Cart.onUpdate(count);
  };

  Cart.onUpdate = null;

  /* Sync badges as soon as the DOM is ready */
  document.addEventListener('DOMContentLoaded', function () {
    Cart._notify();
  });

  window.GoldsCart = Cart;

}());
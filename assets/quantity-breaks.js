/*!
 * Quantity breaks — volume pricing tiers for Shopify themes.
 * https://github.com/Ecom-Swift-LLC/shopify-quantity-breaks-snippet
 * MIT © Ecom Swift LLC
 *
 * The tiers are display + a shortcut for the quantity field. The discount
 * itself comes from an automatic discount configured in the Shopify admin,
 * so cart and checkout stay authoritative.
 */
(function () {
  'use strict';

  var ROOT_SELECTOR = '[data-quantity-breaks]';
  var FORM_SELECTOR = 'form[action*="/cart/add"]';

  function toArray(nodeList) {
    return Array.prototype.slice.call(nodeList || []);
  }

  function findForm(root) {
    var custom = root.getAttribute('data-form-selector');

    if (custom) {
      var chosen = document.querySelector(custom);
      if (chosen) return chosen;
    }

    var nearest = root.closest(FORM_SELECTOR);
    if (nearest) return nearest;

    var forms = toArray(document.querySelectorAll(FORM_SELECTOR));
    for (var i = 0; i < forms.length; i++) {
      if (forms[i].querySelector('[name="id"]')) return forms[i];
    }

    return null;
  }

  function findQuantityInput(root, form) {
    var selector = root.getAttribute('data-quantity-selector') || '[name="quantity"]';
    var scope = form || document;
    return scope.querySelector(selector) || document.querySelector(selector);
  }

  function readPrices(root) {
    var node = root.querySelector('[data-quantity-breaks-prices]');
    if (!node) return null;

    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      return null;
    }
  }

  function minQuantityOf(tier) {
    var value = parseInt(tier.getAttribute('data-min-quantity'), 10);
    return isNaN(value) ? 1 : value;
  }

  function QuantityBreaks(root) {
    this.root = root;
    this.tiers = toArray(root.querySelectorAll('[data-quantity-break]'));
    this.prices = readPrices(root);
    this.form = findForm(root);
    this.quantityInput = findQuantityInput(root, this.form);
    this.variantInput = this.form ? this.form.querySelector('[name="id"]') : null;

    if (!this.tiers.length) return;

    if (!this.quantityInput) {
      // Nothing to drive — the tiers stay informational rather than pretending
      // to be clickable.
      this.root.classList.add('quantity-breaks--static');
      this.tiers.forEach(function (tier) {
        tier.setAttribute('aria-disabled', 'true');
      });
    }

    this.bind();
    this.sync();
  }

  QuantityBreaks.prototype.bind = function () {
    var self = this;

    this.tiers.forEach(function (tier) {
      tier.addEventListener('click', function () {
        if (!self.quantityInput) return;
        self.setQuantity(minQuantityOf(tier));
      });
    });

    if (this.quantityInput) {
      this.quantityInput.addEventListener('change', function () {
        self.highlight();
      });
      this.quantityInput.addEventListener('input', function () {
        self.highlight();
      });
    }

    if (this.form) {
      // Variant pickers update the hidden id input during their own change
      // handler, so read it back on the next frame.
      this.form.addEventListener('change', function () {
        window.requestAnimationFrame(function () {
          self.sync();
        });
      });
    }

    // Themes that announce variant changes explicitly.
    document.addEventListener('variant:change', function () {
      self.sync();
    });
  };

  QuantityBreaks.prototype.setQuantity = function (value) {
    this.quantityInput.value = String(value);
    this.quantityInput.dispatchEvent(new Event('input', { bubbles: true }));
    this.quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
    this.highlight();
  };

  QuantityBreaks.prototype.currentQuantity = function () {
    if (!this.quantityInput) return 1;
    var value = parseInt(this.quantityInput.value, 10);
    return isNaN(value) || value < 1 ? 1 : value;
  };

  QuantityBreaks.prototype.highlight = function () {
    var quantity = this.currentQuantity();
    var active = null;

    this.tiers.forEach(function (tier) {
      var min = minQuantityOf(tier);
      if (quantity >= min && (active === null || min > minQuantityOf(active))) {
        active = tier;
      }
    });

    this.tiers.forEach(function (tier) {
      var isActive = tier === active;
      tier.classList.toggle('quantity-breaks__tier--active', isActive);
      tier.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  QuantityBreaks.prototype.applyPrices = function () {
    if (!this.prices || !this.variantInput) return;

    var rows = this.prices[String(this.variantInput.value)];
    if (!rows) return;

    this.tiers.forEach(function (tier, index) {
      var row = rows[index];
      if (!row) return;

      var unit = tier.querySelector('[data-quantity-break-unit]');
      var total = tier.querySelector('[data-quantity-break-total]');
      var was = tier.querySelector('[data-quantity-break-was]');

      if (unit) unit.textContent = row.u;
      if (total) total.textContent = row.t;
      if (was) was.textContent = row.w;
    });
  };

  QuantityBreaks.prototype.sync = function () {
    this.applyPrices();
    this.highlight();
  };

  function init(scope) {
    toArray((scope || document).querySelectorAll(ROOT_SELECTOR)).forEach(function (root) {
      if (root.quantityBreaks) return;
      root.quantityBreaks = new QuantityBreaks(root);
    });
  }

  // Public hook for themes that rebuild the product form without replacing the
  // tiers: re-reads the current variant and quantity, then repaints.
  function refresh(scope) {
    toArray((scope || document).querySelectorAll(ROOT_SELECTOR)).forEach(function (root) {
      if (root.quantityBreaks) {
        root.quantityBreaks.sync();
      } else {
        root.quantityBreaks = new QuantityBreaks(root);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }

  // Theme editor: re-init when a section is added or redrawn.
  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
  });

  window.QuantityBreaks = { init: init, refresh: refresh };
})();

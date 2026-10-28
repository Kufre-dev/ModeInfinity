/* ============================================================
   MODEINFINITY — CART DRAWER (checkout via WhatsApp)
   No imports. No dependencies.

   Cart checkout is sent via WhatsApp click-to-chat:
   customer clicks "Checkout via WhatsApp" → WhatsApp
   opens with the message pre-filled → customer hits send
   → message arrives on the business WhatsApp number.

   To change the receiving number, edit WHATSAPP_NUMBER below.
   Format: international, no +, no spaces.

   PATCH ROUND — STABILITY / HARDENING
   ------------------------------------
   1. aria-expanded is reflected on every [data-mi-cart-open]
      control when the drawer opens or closes. (Applied in a
      previous pass; retained here.)

   2. INIT RETRY CAP. The original init() looped forever via
      setTimeout(init, 100) if #mi-cart never appeared. If the
      cart-drawer.html component fails to fetch, or the page
      simply doesn't include one, this would spin indefinitely
      until the page closed. Now bounded to 100 attempts
      (~10 seconds) after which it gives up quietly.

   3. NUMERIC GUARD. add(), subtotal(), totalCount() and
      buildCheckoutMessage() previously used
      `Number(item.price || 0)`. When price was a non-numeric
      string like "abc", the `|| 0` guard fired BEFORE Number(),
      so Number("abc") returned NaN, and the value stored in
      localStorage became NaN. On the next render, the cart
      showed the literal string "NaN" instead of "₦0".
      Now every numeric field is coerced and validated before
      use: non-finite or negative values default to 0 (price)
      or 1 (quantity).

   4. BODY OVERFLOW SAVE/RESTORE. open() previously clobbered
      document.body.style.overflow to "hidden" and close() reset
      it to "". If another overlay (mobile nav, filter drawer,
      product modal) was already open, this would clobber its
      overflow lock. Now we snapshot the previous value on open
      and restore it on close, so cart and other overlays can
      coexist without fighting over body scroll.

   5. CART PRICE RECONCILIATION. Item prices, names, and image
      paths are now re-checked against data/shoes.json on init,
      on drawer open, and immediately before composing the
      WhatsApp checkout message. Any tampered or stale prices
      are corrected; items whose base product id is not in the
      current catalogue are removed; the customer is notified
      via toast if anything changed. This is defence-in-depth,
      not a security boundary — a user can still edit their own
      browser state and message before sending — but it ensures
      stale prices never reach the business and casual tampering
      is corrected silently before checkout.

   Not changed (verified correct):
   - Focus trap, focus restoration, Escape-to-close
   - WhatsApp message composition and handoff
   - localStorage schema (STORAGE_KEY = "mi_cart_v1")
   - aria-hidden / inert toggling on #mi-cart
   - Remove/inc/dec quantity operations
   - Escape + backdrop close handlers
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "mi_cart_v1";

  /*
   * Receiving WhatsApp number.
   * Example: +2348050424000 → "2348050424000"
   * Change this one line if the business WhatsApp changes.
   */
  var WHATSAPP_NUMBER = "2348050424000";

  /*
   * Catalogue source. Prices in this file are authoritative;
   * anything in localStorage is corrected against it.
   */
  var CATALOGUE_URL = "data/shoes.json";

  var INIT_MAX_ATTEMPTS = 100;      // 100 × 100ms = 10s
  var INIT_RETRY_DELAY = 100;

  var drawer = null;
  var items = [];
  var lastFocus = null;
  var isOpen = false;
  var previousBodyOverflow = null;

  /*
   * Catalogue cache, populated by loadProductPrices().
   * Structure:
   *   {
   *     "mi-shoe-003": { name: "The Maitama Oxford", price: 245000, image: "..." },
   *     ...
   *   }
   * null means "not yet loaded". A failed load leaves it null
   * so validateCartPrices() becomes a no-op for that session.
   */
  var productPriceMap = null;

  /* ----------------------------------------------------------
     Storage
     ---------------------------------------------------------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) items = [];
    } catch (e) {
      items = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {}
  }

  /*
   * Coerce to a safe non-negative number. Returns 0 for NaN,
   * Infinity, negatives, or non-numeric strings. Avoids the
   * `Number(x || 0)` pitfall where "abc" || 0 = "abc" and
   * Number("abc") = NaN.
   */
  function safePrice(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  /*
   * Coerce quantity to a safe positive integer. Returns 1 for
   * invalid input. Prevents NaN → NaN subtotal cascades.
   */
  function safeQuantity(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 1) return 1;
    return Math.max(1, Math.floor(n));
  }

  function subtotal() {
    return items.reduce(function (sum, item) {
      return sum + safePrice(item.price) * safeQuantity(item.quantity);
    }, 0);
  }

  function totalCount() {
    return items.reduce(function (sum, item) {
      return sum + safeQuantity(item.quantity);
    }, 0);
  }

  function formatNaira(value) {
    try {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0
      }).format(value);
    } catch (e) {
      return "₦" + String(value);
    }
  }

  /* ----------------------------------------------------------
     Catalogue loading + price reconciliation
     ---------------------------------------------------------- */

  /*
   * Load data/shoes.json once and populate productPriceMap.
   * Resolves after the map is set. Rejects on network or parse
   * failure — the caller should NOT treat rejection as fatal.
   */
  function loadProductPrices() {
    return fetch(CATALOGUE_URL, { headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var products = Array.isArray(data)
          ? data
          : (data.products || data.shoes || data.items || []);

        var map = {};
        products.forEach(function (p) {
          if (!p || !p.id) return;
          map[String(p.id)] = {
            name: String(p.name || "").trim(),
            price: safePrice(p.price),
            image: String(p.imageFallback || p.image || "").trim()
          };
        });
        productPriceMap = map;
      });
  }

  /*
   * Reconcile items[] against productPriceMap.
   *
   * - If the map is not loaded yet, does nothing and returns false.
   * - Strips the " (Size NN)" suffix from item ids to find the
   *   base product, then re-applies the suffix to the expected
   *   name so size-specific entries are preserved.
   * - Corrects price, name, and image path to match the catalogue.
   * - Removes items whose base id is not in the catalogue.
   * - Fires one toast summarising what changed, if anything.
   *
   * Returns true if any mutation was made (which implies a save
   * and re-render already happened).
   */
  function validateCartPrices() {
    if (!productPriceMap) return false;
    if (!items.length) return false;

    var corrected = false;
    var dropped = 0;
    var validItems = [];

    items.forEach(function (item) {
      if (!item || typeof item !== "object") {
        dropped++;
        return;
      }

      var rawId = String(item.id || "").trim();
      if (!rawId) {
        dropped++;
        return;
      }

      /*
       * Cart entries added from the product modal carry a size
       * suffix like "mi-shoe-003__size-42". Strip it to find the
       * base product, then rebuild the expected name with the
       * same suffix so size-specific rows are preserved.
       */
      var sizeMatch = rawId.match(/^(.*?)__size-(.+)$/);
      var baseId = sizeMatch ? sizeMatch[1] : rawId;
      var sizeSuffix = sizeMatch ? " (Size " + sizeMatch[2] + ")" : "";

      var product = productPriceMap[baseId];

      if (!product) {
        // Not in current catalogue — drop it.
        dropped++;
        return;
      }

      // Correct price
      var canonicalPrice = safePrice(product.price);
      if (safePrice(item.price) !== canonicalPrice) {
        item.price = canonicalPrice;
        corrected = true;
      }

      // Correct name (preserving any size suffix)
      if (product.name) {
        var expectedName = product.name + sizeSuffix;
        if (String(item.name || "") !== expectedName) {
          item.name = expectedName;
          corrected = true;
        }
      }

      // Correct image path
      if (product.image && String(item.image || "") !== product.image) {
        item.image = product.image;
        corrected = true;
      }

      validItems.push(item);
    });

    if (dropped > 0) {
      items = validItems;
      corrected = true;
    }

    if (corrected) {
      save();
      render();
    }

    if (dropped > 0) {
      document.dispatchEvent(new CustomEvent("modeinfinity:toast", {
        detail: {
          type: "warning",
          title: dropped === 1 ? "Item removed" : "Items removed",
          message: dropped + (dropped === 1
            ? " item is"
            : " items are") + " no longer available and have been removed from your cart."
        }
      }));
    } else if (corrected) {
      document.dispatchEvent(new CustomEvent("modeinfinity:toast", {
        detail: {
          type: "info",
          title: "Cart updated",
          message: "Item details were refreshed from the current catalogue."
        }
      }));
    }

    return corrected;
  }

  /* ----------------------------------------------------------
     Render
     ---------------------------------------------------------- */
  function render() {
    if (!drawer) return;

    var listEl = drawer.querySelector("[data-mi-cart-items]");
    var emptyEl = drawer.querySelector("[data-mi-cart-empty]");
    var subEl = drawer.querySelector("[data-mi-cart-subtotal]");

    if (!listEl || !emptyEl || !subEl) return;

    listEl.innerHTML = "";

    if (!items.length) {
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;

      items.forEach(function (item, index) {
        var li = document.createElement("li");
        li.className = "mi-cart__item";

        var imageHtml = item.image
          ? '<div class="mi-cart__item-image"><img src="' +
            escapeHtml(item.image) +
            '" alt="" loading="lazy" decoding="async"></div>'
          : "";

        li.innerHTML =
          imageHtml +
          '<div class="mi-cart__item-info">' +
          '<p class="mi-cart__item-name">' + escapeHtml(item.name || "Product") + "</p>" +
          '<p class="mi-cart__item-price">' + formatNaira(safePrice(item.price)) + "</p>" +
          '<div class="mi-cart__item-qty">' +
          '<button type="button" aria-label="Decrease quantity" data-mi-cart-dec="' + index + '">−</button>' +
          "<span>" + safeQuantity(item.quantity) + "</span>" +
          '<button type="button" aria-label="Increase quantity" data-mi-cart-inc="' + index + '">+</button>' +
          "</div>" +
          "</div>" +
          '<button type="button" class="mi-cart__item-remove" data-mi-cart-remove="' + index + '">Remove</button>';

        listEl.appendChild(li);
      });
    }

    subEl.textContent = formatNaira(subtotal());
    updateHeaderCount();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]);
    });
  }

  function updateHeaderCount() {
    var countEl = document.querySelector("[data-mi-cart-count]");
    if (!countEl) return;
    var n = totalCount();
    countEl.textContent = String(n);
    countEl.hidden = n === 0;
  }

  /* ----------------------------------------------------------
     Open / close
     ---------------------------------------------------------- */
  function open() {
    if (!drawer || isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;

    drawer.setAttribute("aria-hidden", "false");
    drawer.removeAttribute("inert");

    // Reflect open state on every button that controls the drawer
    document.querySelectorAll("[data-mi-cart-open]").forEach(function (btn) {
      btn.setAttribute("aria-expanded", "true");
    });

    /*
     * Reconcile prices with the catalogue. If the catalogue
     * never loaded (fetch failed at init), try again now.
     * Non-blocking — the drawer animates open regardless.
     */
    if (!productPriceMap) {
      loadProductPrices()
        .then(function () { validateCartPrices(); })
        .catch(function () {});
    } else {
      validateCartPrices();
    }

    // Save the previous overflow so we can restore it verbatim on
    // close — avoids clobbering other overlays that may have
    // already locked body scroll.
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    var closeBtn = drawer.querySelector(".mi-cart__close");
    if (closeBtn) {
      window.requestAnimationFrame(function () {
        closeBtn.focus();
      });
    }
  }

  function close() {
    if (!drawer || !isOpen) return;
    isOpen = false;

    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("inert", "");

    // Reflect closed state on every button that controls the drawer
    document.querySelectorAll("[data-mi-cart-open]").forEach(function (btn) {
      btn.setAttribute("aria-expanded", "false");
    });

    document.body.style.overflow =
      previousBodyOverflow !== null ? previousBodyOverflow : "";
    previousBodyOverflow = null;

    if (lastFocus && document.contains(lastFocus)) {
      window.requestAnimationFrame(function () {
        lastFocus.focus();
      });
    }
    lastFocus = null;
  }

  /* ----------------------------------------------------------
     Cart operations
     ---------------------------------------------------------- */
  function add(item) {
    if (!item || !item.id) return;
    var existing = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === item.id) { existing = items[i]; break; }
    }
    if (existing) {
      existing.quantity = safeQuantity(existing.quantity) + safeQuantity(item.quantity);
    } else {
      items.push({
        id: item.id,
        name: item.name || "Product",
        price: safePrice(item.price),
        image: item.image || "",
        quantity: safeQuantity(item.quantity)
      });
    }
    save();
    render();
  }

  function inc(index) {
    if (!items[index]) return;
    items[index].quantity = safeQuantity(items[index].quantity) + 1;
    save();
    render();
  }

  function dec(index) {
    if (!items[index]) return;
    items[index].quantity = safeQuantity(items[index].quantity) - 1;
    if (items[index].quantity <= 0) {
      items.splice(index, 1);
    }
    save();
    render();
  }

  function remove(index) {
    if (!items[index]) return;
    items.splice(index, 1);
    save();
    render();
  }

  /* ----------------------------------------------------------
     Checkout — WhatsApp message composition
     ---------------------------------------------------------- */
  function buildCheckoutMessage() {
    var lines = [];

    lines.push("Hi ModeInfinity,");
    lines.push("");
    lines.push("I'd like to order the following " +
      (items.length === 1 ? "pair" : "pairs") + ":");
    lines.push("");

    items.forEach(function (item, i) {
      var qty = safeQuantity(item.quantity);
      var price = formatNaira(safePrice(item.price));
      var suffix = qty > 1 ? " \u00d7 " + qty : "";
      lines.push((i + 1) + ". " + (item.name || "Product") + " \u2014 " + price + suffix);
    });

    lines.push("");
    lines.push("Subtotal: " + formatNaira(subtotal()));
    lines.push("");
    lines.push("Please let me know about availability, delivery, and next steps.");
    lines.push("");
    lines.push("Thank you!");

    return lines.join("\n");
  }

  function sendCheckout() {
    if (!items.length) {
      document.dispatchEvent(new CustomEvent("modeinfinity:toast", {
        detail: {
          type: "info",
          title: "Cart is empty",
          message: "Add at least one pair before checking out."
        }
      }));
      return;
    }

    /*
     * Final synchronous reconciliation before composing the
     * message. If the catalogue was loaded, any tampered or
     * stale prices are corrected here so the WhatsApp message
     * carries authoritative values.
     */
    validateCartPrices();

    if (!items.length) {
      document.dispatchEvent(new CustomEvent("modeinfinity:toast", {
        detail: {
          type: "warning",
          title: "Cart is empty",
          message: "Your cart items are no longer available."
        }
      }));
      return;
    }

    var message = buildCheckoutMessage();
    var url =
      "https://wa.me/" +
      WHATSAPP_NUMBER +
      "?text=" +
      encodeURIComponent(message);

    /*
     * Triggered via a temporary anchor element rather than
     * window.open() — more reliable across browsers and
     * popup blockers when in response to a user click.
     */
    var link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ----------------------------------------------------------
     Event binding
     ---------------------------------------------------------- */
  function bind() {
    // Open cart
    document.addEventListener("click", function (event) {
      var opener = event.target.closest("[data-mi-cart-open]");
      if (opener) {
        event.preventDefault();
        open();
        return;
      }

      // Add to cart (legacy hook — still works if any HTML uses it)
      var addBtn = event.target.closest("[data-mi-cart-add]");
      if (addBtn) {
        event.preventDefault();
        var addedName = addBtn.dataset.miCartName || addBtn.dataset.name || "Item";
        add({
          id: addBtn.dataset.miCartId || addBtn.dataset.id,
          name: addBtn.dataset.miCartName || addBtn.dataset.name,
          price: addBtn.dataset.miCartPrice || addBtn.dataset.price,
          image: addBtn.dataset.miCartImage || addBtn.dataset.image,
          quantity: 1
        });
        document.dispatchEvent(new CustomEvent("modeinfinity:toast", {
          detail: {
            type: "success",
            title: "Added to cart",
            message: addedName + " was added to your cart."
          }
        }));
      }
    });

    // Close cart
    document.addEventListener("click", function (event) {
      var closer = event.target.closest("[data-mi-cart-close]");
      if (closer) {
        event.preventDefault();
        close();
      }
    });

    // Checkout (WhatsApp)
    document.addEventListener("click", function (event) {
      var checkoutBtn = event.target.closest("[data-mi-cart-checkout]");
      if (checkoutBtn) {
        event.preventDefault();
        sendCheckout();
      }
    });

    // Inside the drawer: quantity + remove
    if (drawer) {
      drawer.addEventListener("click", function (event) {
        var incBtn = event.target.closest("[data-mi-cart-inc]");
        if (incBtn) { inc(Number(incBtn.dataset.miCartInc)); return; }

        var decBtn = event.target.closest("[data-mi-cart-dec]");
        if (decBtn) { dec(Number(decBtn.dataset.miCartDec)); return; }

        var rmBtn = event.target.closest("[data-mi-cart-remove]");
        if (rmBtn) { remove(Number(rmBtn.dataset.miCartRemove)); return; }
      });

      // Escape closes
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && isOpen) {
          close();
        }
      });

      // Focus trap
      drawer.addEventListener("keydown", function (event) {
        if (!isOpen || event.key !== "Tab") return;

        var focusable = drawer.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        focusable = Array.prototype.slice.call(focusable).filter(function (el) {
          return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
        });
        if (!focusable.length) return;

        var first = focusable[0];
        var last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      });
    }
  }

  /* ----------------------------------------------------------
     Init
     ----------------------------------------------------------
     The cart-drawer.html component is fetched by components.js
     after DOMContentLoaded. Depending on fetch timing, #mi-cart
     may not exist immediately. We retry briefly — but with a cap
     so a missing component doesn't cause an infinite loop.
     ---------------------------------------------------------- */
  function init() {
    drawer = document.getElementById("mi-cart");
    if (!drawer) {
      if (init.attempts < INIT_MAX_ATTEMPTS) {
        init.attempts++;
        setTimeout(init, INIT_RETRY_DELAY);
      }
      return;
    }

    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("inert", "");

    load();
    render();
    bind();

    /*
     * Fetch the catalogue and reconcile prices.
     * Non-blocking — cart renders immediately with whatever
     * localStorage had, then updates once prices are loaded.
     */
    loadProductPrices()
      .then(function () {
        validateCartPrices();
      })
      .catch(function (error) {
        console.warn("[ModeInfinity] Cart price validation skipped:", error);
      });

    window.MiCart = {
      open: open,
      close: close,
      add: add,
      items: function () { return items.slice(); }
    };
  }
  init.attempts = 0;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
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

  var INIT_MAX_ATTEMPTS = 100;      // 100 × 100ms = 10s
  var INIT_RETRY_DELAY = 100;

  var drawer = null;
  var items = [];
  var lastFocus = null;
  var isOpen = false;
  var previousBodyOverflow = null;

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
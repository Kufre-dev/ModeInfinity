/* ============================================================
   MODEINFINITY — CART DRAWER (checkout via WhatsApp)
   No imports. No dependencies.

   Cart checkout is sent via WhatsApp click-to-chat:
   customer clicks "Checkout via WhatsApp" → WhatsApp
   opens with the message pre-filled → customer hits send
   → message arrives on the business WhatsApp number.

   To change the receiving number, edit WHATSAPP_NUMBER below.
   Format: international, no +, no spaces.
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "mi_cart_v1";

  /*
   * Receiving WhatsApp number.
   * Example: +2348097212238 → "2348097212238"
   * Change this one line if the business WhatsApp changes.
   */
  var WHATSAPP_NUMBER = "2348097212238";

  var drawer = null;
  var items = [];
  var lastFocus = null;
  var isOpen = false;

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

  function subtotal() {
    return items.reduce(function (sum, item) {
      return sum + Number(item.price || 0) * Number(item.quantity || 0);
    }, 0);
  }

  function totalCount() {
    return items.reduce(function (sum, item) {
      return sum + Number(item.quantity || 0);
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
          '<p class="mi-cart__item-price">' + formatNaira(item.price || 0) + "</p>" +
          '<div class="mi-cart__item-qty">' +
          '<button type="button" aria-label="Decrease quantity" data-mi-cart-dec="' + index + '">−</button>' +
          "<span>" + (item.quantity || 1) + "</span>" +
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

    document.body.style.overflow = "";

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
      existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
    } else {
      items.push({
        id: item.id,
        name: item.name || "Product",
        price: Number(item.price || 0),
        image: item.image || "",
        quantity: Number(item.quantity || 1)
      });
    }
    save();
    render();
  }

  function inc(index) {
    if (!items[index]) return;
    items[index].quantity = (items[index].quantity || 1) + 1;
    save();
    render();
  }

  function dec(index) {
    if (!items[index]) return;
    items[index].quantity = (items[index].quantity || 1) - 1;
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
      var qty = Number(item.quantity) || 1;
      var price = formatNaira(item.price || 0);
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
     ---------------------------------------------------------- */
  function init() {
    drawer = document.getElementById("mi-cart");
    if (!drawer) {
      setTimeout(init, 100);
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
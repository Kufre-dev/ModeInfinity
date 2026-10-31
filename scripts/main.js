/* ============================================================
   MODEINFINITY — APPLICATION ENTRY POINT
   File: scripts/main.js

   PATCH ROUND — JS/CSS COORDINATION FIXES
   ----------------------------------------
   1. ACCORDION: open/close now uses the one-frame handoff
      required by animations.css. `panel.hidden = false` on open
      happens first, then on the next animation frame
      `.is-open` is added so grid-template-rows transitions
      from 0fr → 1fr. On close, `.is-open` is removed first,
      then `panel.hidden = true` runs on transitionend (with
      a 400ms fallback timeout). Without this, the panel
      snapped open/closed because CSS cannot animate
      display: none.

   2. SCROLL TO TOP: no longer toggles `hidden` or
      `aria-hidden`. The CSS `.scroll-to-top` uses opacity +
      visibility transitions, and `visibility: hidden`
      already removes the element from the a11y tree and
      tab order. Setting `hidden` on hide cut the fade-out
      transition; setting `aria-hidden="true"` on a
      focusable element is a WCAG violation.
      REQUIRES: removing `hidden` from scroll-to-top.html
      (one-line HTML change).
   ============================================================ */

import { initializeComponents } from "./components.js";
import { initializeNavbar } from "./navbar.js";
import { initScrollAnimations } from "./scrollanimations.js";
import {
  initCarousels,
  initCraftCarousels
} from "./swiper.js";
import { initFormHandler } from "./formhandler.js";
// import { initGallery } from "./gallery.js";
import { initGalleryViewer } from "./gallery-viewer.js";

let applicationInitialized = false;

/* ============================================================
   SECURITY: Safe URL Validator
   ============================================================ */
function safeUrl(url) {
  if (typeof url !== "string" || !url.trim()) return "";
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
  } catch (e) {
    // Invalid URL format
  }
  return "";
}


/* ============================================================
   PRODUCTS — BEGIN
   ============================================================ */

function initProducts() {
  var container = document.querySelector("[data-home-products]");
  if (!container) return;

  var limit = parseInt(container.dataset.homeProductsLimit, 10) || 4;
  var dataUrl = "data/shoes.json";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c];
    });
  }

  function formatNaira(value) {
    try {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0
      }).format(value);
    } catch (e) {
      return "\u20a6" + String(value);
    }
  }

  function normalizeProduct(product) {
    if (!product || typeof product !== "object") return null;
    var id = product.id ? String(product.id).trim() : "";
    if (!id) return null;
    var price = Number(product.price);
    if (!isFinite(price) || price < 0) price = 0;
    var PLACEHOLDER_SHORT = "Handcrafted leather footwear, made by hand in Abuja.";
    var rawShort = String(product.shortDescription || "").trim();
    if (rawShort === PLACEHOLDER_SHORT) rawShort = "";
    return {
      id: id,
      name: String(product.name || "ModeInfinity Product").trim(),
      price: price,
      category: String(product.category || "").trim(),
      shortDescription: rawShort || String(product.description || "").trim(),
      badge: String(product.badge || "").trim(),
      imageAvif: String(product.imageAvif || "").trim(),
      imageWebp: String(product.imageWebp || "").trim(),
      imageFallback: String(product.imageFallback || product.image || "").trim(),
      imageAlt: String(product.imageAlt || product.name || "").trim(),
      featured: !!product.featured,
      active: product.active !== false,
      sortOrder: Number(product.sortOrder) || 0
    };
  }

  function productCard(product) {
    var id = escapeHtml(product.id);
    var name = escapeHtml(product.name);
    var href = "shop?product=" + encodeURIComponent(product.id);
    var price = escapeHtml(formatNaira(product.price));
    var category = escapeHtml(product.category);
    var badge = escapeHtml(product.badge);
    var description = escapeHtml(product.shortDescription);
    var safeAvif = safeUrl(product.imageAvif);
    var safeWebp = safeUrl(product.imageWebp);
    var safeFallback = safeUrl(product.imageFallback);

    var sources = "";
    if (safeAvif) {
      sources += '<source srcset="' + escapeHtml(safeAvif) + '" type="image/avif">';
    }
    if (safeWebp) {
      sources += '<source srcset="' + escapeHtml(safeWebp) + '" type="image/webp">';
    }

    return '' +
      '<article class="product-card"' +
        ' data-product-id="' + id + '"' +
        ' data-product-name="' + name + '"' +
        ' data-product-price="' + escapeHtml(String(product.price)) + '"' +
        ' data-product-category="' + category + '"' +
        ' data-product-image="' + escapeHtml(safeFallback) + '">' +
        '<div class="product-card__media">' +
          (badge ? '<span class="product-card__badge" aria-label="' + badge + '">' + badge + '</span>' : '') +
          '<a class="product-card__media-link" href="' + href + '" aria-label="View ' + name + '">' +
            '<picture>' + sources +
              '<img src="' + escapeHtml(safeFallback) + '" alt="' + escapeHtml(product.imageAlt) + '"' +
              ' width="900" height="1125" loading="lazy" decoding="async">' +
            '</picture>' +
          '</a>' +
        '</div>' +
        '<div class="product-card__body">' +
          (category ? '<p class="product-card__category">' + category + '</p>' : '') +
          '<h3 class="product-card__title"><a href="' + href + '">' + name + '</a></h3>' +
          '<p class="product-card__price">' + price + '</p>' +
          (description ? '<p class="product-card__description">' + description + '</p>' : '') +
        '</div>' +
      '</article>';
  }

  function render() {
    fetch(dataUrl, { headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var raw = Array.isArray(data)
          ? data
          : (data.products || data.shoes || data.items || []);

        var products = raw
          .map(normalizeProduct)
          .filter(function (p) { return p && p.active; })
          .sort(function (a, b) { return a.sortOrder - b.sortOrder; });

        var featured = products.filter(function (p) { return p.featured; });
        var rest = products.filter(function (p) { return !p.featured; });
        var chosen = featured.concat(rest).slice(0, limit);

        container.setAttribute("aria-busy", "false");

        if (!chosen.length) {
          container.innerHTML = '<p class="home-collection__empty" role="status">The collection is temporarily unavailable.</p>';
          return;
        }

        container.innerHTML = chosen.map(productCard).join("");
      })
      .catch(function (error) {
        console.error("[ModeInfinity] Product loading failed:", error);
        container.setAttribute("aria-busy", "false");
        container.innerHTML = '<p class="home-collection__empty" role="status">The collection is temporarily unavailable.</p>';
      });
  }

  render();
}

/* ============================================================
   PRODUCTS — END
   ============================================================ */


/* ============================================================
   SCROLL TO TOP — BEGIN
   ============================================================ */

function initScrollToTop() {
  var REVEAL_AT = 400;
  var visible = false;
  var ticking = false;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getButtons() {
    return document.querySelectorAll("[data-scroll-top]");
  }

  /*
   * CSS handles visibility via `.scroll-to-top` (opacity: 0,
   * visibility: hidden) → `.scroll-to-top.is-visible` (opacity: 1,
   * visibility: visible). We only toggle the class. Do NOT touch
   * `hidden` (display: none kills the fade transition) or
   * `aria-hidden` (WCAG issue on focusable elements — visibility:
   * hidden already removes the button from the a11y tree and tab
   * order).
   */
  function applyVisibility(show) {
    var buttons = getButtons();
    if (!buttons.length) return;

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle("is-visible", show);
    }
    visible = show;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;

    window.requestAnimationFrame(function () {
      var shouldShow = window.scrollY > REVEAL_AT;
      if (shouldShow !== visible) {
        applyVisibility(shouldShow);
      }
      ticking = false;
    });
  }

  function onClick(event) {
    var target = event.target.closest("[data-scroll-top]");
    if (!target) return;

    event.preventDefault();

    var behavior = prefersReducedMotion() ? "auto" : "smooth";
    window.scrollTo({ top: 0, behavior: behavior });

    var main = document.getElementById("main-content") || document.body;
    if (main && typeof main.focus === "function") {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  }

  document.addEventListener("click", onClick);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  applyVisibility(false);
  onScroll();
}

/* ============================================================
   SCROLL TO TOP — END
   ============================================================ */


/* ============================================================
   ACCORDION — BEGIN
   ============================================================
   Requires the animations.css contract:
     .accordion-item__panel { display: grid; grid-template-rows: 0fr; ... }
     .accordion-item.is-open .accordion-item__panel { grid-template-rows: 1fr; }

   The panel starts `hidden` in the HTML, which sets display: none.
   CSS cannot transition display, so we need a one-frame handoff:
     open  → panel.hidden = false; requestAnimationFrame → item.classList.add("is-open")
     close → item.classList.remove("is-open"); transitionend → panel.hidden = true
   ============================================================ */

function initAccordion() {
  var CLOSE_FALLBACK_MS = 400;

  function getTrigger(event) {
    return event.target.closest(".accordion-item__trigger");
  }

  function getPanel(trigger) {
    var id = trigger.getAttribute("aria-controls");
    if (!id) return null;
    return document.getElementById(id);
  }

  function openItem(trigger, panel) {
    trigger.setAttribute("aria-expanded", "true");

    var item = trigger.closest(".accordion-item");
    if (!item) return;

    if (panel) {
      panel.hidden = false;
      // Force a reflow so the browser paints the collapsed 0fr
      // state at display: grid BEFORE .is-open changes the track
      // to 1fr. Without this, no transition fires.
      void panel.offsetHeight;
    }

    window.requestAnimationFrame(function () {
      item.classList.add("is-open");
      if (panel) panel.classList.add("is-open");
    });
  }

  function closeItem(trigger, panel) {
    trigger.setAttribute("aria-expanded", "false");

    var item = trigger.closest(".accordion-item");
    if (item) item.classList.remove("is-open");
    if (panel) panel.classList.remove("is-open");

    if (!panel) return;

    var done = false;

    function finish() {
      if (done) return;
      done = true;
      panel.hidden = true;
      panel.removeEventListener("transitionend", onTransitionEnd);
    }

    function onTransitionEnd(event) {
      if (event.target !== panel) return;
      finish();
    }

    panel.addEventListener("transitionend", onTransitionEnd);
    window.setTimeout(finish, CLOSE_FALLBACK_MS);
  }

  function closeSiblings(trigger) {
    var group = trigger.closest(".accordion");
    if (!group) return;

    var siblings = group.querySelectorAll(".accordion-item__trigger");
    for (var i = 0; i < siblings.length; i++) {
      var sib = siblings[i];
      if (sib === trigger) continue;
      if (sib.getAttribute("aria-expanded") !== "true") continue;
      closeItem(sib, getPanel(sib));
    }
  }

  document.addEventListener("click", function (event) {
    var trigger = getTrigger(event);
    if (!trigger) return;

    event.preventDefault();

    var panel = getPanel(trigger);
    var isOpen = trigger.getAttribute("aria-expanded") === "true";

    if (isOpen) {
      closeItem(trigger, panel);
    } else {
      closeSiblings(trigger);
      openItem(trigger, panel);
    }
  });
}

/* ============================================================
   ACCORDION — END
   ============================================================ */


/* ============================================================
   TOAST — BEGIN
   ============================================================ */

function initToast() {
  var AUTO_DISMISS_MS = 4500;
  var timer = null;

  var ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6L9 17l-5-5"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
  };

  function getToast() { return document.getElementById("toast"); }

  function clearTimer() {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function hide() {
    var toast = getToast();
    if (!toast) return;
    clearTimer();
    toast.classList.remove("is-visible");
    toast.hidden = true;
  }

  function show(detail) {
    var toast = getToast();
    if (!toast) return;

    var type = (detail && detail.type) || "info";
    var title = (detail && detail.title) || "Notification";
    var message = (detail && detail.message) || "";

    var titleEl = document.getElementById("toast-title");
    var messageEl = document.getElementById("toast-message");
    var iconEl = document.getElementById("toast-icon");

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (iconEl) iconEl.innerHTML = ICONS[type] || ICONS.info;

    toast.classList.remove("toast--success", "toast--error", "toast--warning", "toast--info");
    toast.classList.add("toast--" + type);

    clearTimer();
    toast.hidden = false;
    toast.offsetHeight;
    toast.classList.add("is-visible");
    timer = window.setTimeout(hide, AUTO_DISMISS_MS);
  }

  document.addEventListener("click", function (event) {
    if (event.target.closest("#toast-close")) {
      event.preventDefault();
      hide();
    }
  });

  document.addEventListener("modeinfinity:toast", function (event) {
    show(event.detail || {});
  });

  window.MiToast = { show: show, hide: hide };
}

/* ============================================================
   TOAST — END
   ============================================================ */


/* ============================================================
   PRODUCT MODAL — BEGIN
   ============================================================ */

var productModalEl = null;
var productModalLastFocus = null;
var productModalOpen = false;

function initProductModal() {
  productModalEl = document.getElementById("product-modal");
  if (!productModalEl) return;

  productModalEl.setAttribute("aria-hidden", "true");
  productModalEl.setAttribute("inert", "");

  var closeEls = productModalEl.querySelectorAll("[data-product-modal-close]");
  closeEls.forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      closeProductModal();
    });
  });

  var addBtn = document.getElementById("product-modal-add");
  if (addBtn) addBtn.addEventListener("click", handleModalAddToCart);

  var sizeGrid = productModalEl.querySelector(".product-modal__size-grid");
  if (sizeGrid) {
    sizeGrid.addEventListener("click", function (e) {
      var btn = e.target.closest(".product-modal__size");
      if (!btn) return;
      sizeGrid.querySelectorAll(".product-modal__size").forEach(function (el) {
        el.classList.remove("is-active");
        el.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      if (addBtn) addBtn.disabled = false;
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!productModalOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeProductModal();
    } else if (e.key === "Tab") {
      handleModalFocusTrap(e);
    }
  });
}

function getProductFromCard(card) {
  if (!card) return null;

  var picture = card.querySelector(".product-card__media picture");
  var avif = "";
  var webp = "";
  if (picture) {
    var sources = picture.querySelectorAll("source");
    sources.forEach(function (s) {
      var type = s.getAttribute("type") || "";
      var srcset = s.getAttribute("srcset") || "";
      if (type.indexOf("avif") !== -1) avif = srcset;
      else if (type.indexOf("webp") !== -1) webp = srcset;
    });
  }

  var img = card.querySelector(".product-card__media img");
  var descriptionEl = card.querySelector(".product-card__description");

  return {
    id: card.dataset.productId || "",
    name: card.dataset.productName || "ModeInfinity Product",
    price: card.dataset.productPrice || "0",
    category: card.dataset.productCategory || "",
    imageAvif: avif,
    imageWebp: webp,
    imageFallback: img ? (img.getAttribute("src") || "") : (card.dataset.productImage || ""),
    imageAlt: img ? (img.getAttribute("alt") || "") : (card.dataset.productName || ""),
    description: descriptionEl ? descriptionEl.textContent.trim() : ""
  };
}

function openProductModal(card) {
  if (!productModalEl) {
    productModalEl = document.getElementById("product-modal");
  }
  if (!productModalEl) return;
  if (!card) return;

  var product = getProductFromCard(card);
  if (!product || !product.id) return;

  var sourceAvif = document.getElementById("product-modal-source-avif");
  var sourceWebp = document.getElementById("product-modal-source-webp");
  var imageEl = document.getElementById("product-modal-image");
  var crumbEl = document.getElementById("product-modal-crumb");
  var categoryEl = document.getElementById("product-modal-category");
  var titleEl = document.getElementById("product-modal-title");
  var priceEl = document.getElementById("product-modal-price");
  var descriptionEl = document.getElementById("product-modal-description");
  var addBtn = document.getElementById("product-modal-add");
  var customBtn = document.getElementById("product-modal-custom");

  if (sourceAvif) {
    if (product.imageAvif) sourceAvif.setAttribute("srcset", product.imageAvif);
    else sourceAvif.removeAttribute("srcset");
  }
  if (sourceWebp) {
    if (product.imageWebp) sourceWebp.setAttribute("srcset", product.imageWebp);
    else sourceWebp.removeAttribute("srcset");
  }
  if (imageEl) {
    imageEl.setAttribute("src", product.imageFallback);
    imageEl.setAttribute("alt", product.imageAlt);
  }
  if (crumbEl) crumbEl.textContent = product.category || "Collection";
  if (categoryEl) {
    categoryEl.textContent = product.category;
    categoryEl.hidden = !product.category;
  }
  if (titleEl) titleEl.textContent = product.name;
  if (priceEl) {
    try {
      priceEl.textContent = new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0
      }).format(Number(product.price) || 0);
    } catch (e) {
      priceEl.textContent = "\u20a6" + String(product.price);
    }
  }
  if (descriptionEl) descriptionEl.textContent = product.description || "";
  if (addBtn) {
    addBtn.dataset.modalProductId = product.id;
    addBtn.dataset.modalProductName = product.name;
    addBtn.dataset.modalProductPrice = product.price;
    addBtn.dataset.modalProductImage = product.imageFallback;
  }
if (customBtn) {
  var customUrl = "contact?custom=" +
    encodeURIComponent(product.name) +
    "&shoe=" +
    encodeURIComponent(product.id) +
    "#contact-form";
  customBtn.setAttribute("href", customUrl);
}

  var sizeGrid = productModalEl.querySelector(".product-modal__size-grid");
  if (sizeGrid) {
    sizeGrid.querySelectorAll(".product-modal__size").forEach(function (btn) {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-selected", "false");
    });
  }

  if (addBtn) addBtn.disabled = true;

  productModalLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  productModalEl.setAttribute("aria-hidden", "false");
  productModalEl.removeAttribute("inert");
  document.body.style.overflow = "hidden";
  productModalOpen = true;

  var closeBtn = productModalEl.querySelector(".product-modal__close");
  window.requestAnimationFrame(function () {
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  });
}

function closeProductModal() {
  if (!productModalEl || !productModalOpen) return;

  productModalOpen = false;
  productModalEl.setAttribute("aria-hidden", "true");
  productModalEl.setAttribute("inert", "");
  document.body.style.overflow = "";

  if (productModalLastFocus && document.contains(productModalLastFocus)) {
    window.requestAnimationFrame(function () {
      productModalLastFocus.focus({ preventScroll: true });
    });
  }
  productModalLastFocus = null;
}

function handleModalFocusTrap(event) {
  if (!productModalEl) return;
  var panel = productModalEl.querySelector(".product-modal__panel");
  if (!panel) return;

  var focusable = panel.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  var list = Array.prototype.slice.call(focusable).filter(function (el) {
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
  });
  if (!list.length) {
    event.preventDefault();
    panel.focus({ preventScroll: true });
    return;
  }
  var first = list[0];
  var last = list[list.length - 1];
  var active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

function handleModalAddToCart(event) {
  event.preventDefault();
  var btn = event.currentTarget;

  var activeSizeGuard = productModalEl
    ? productModalEl.querySelector(".product-modal__size.is-active")
    : null;
  if (!activeSizeGuard) {
    document.dispatchEvent(new CustomEvent("modeinfinity:toast", {
      detail: {
        type: "warning",
        title: "Select a size",
        message: "Please choose a size before adding to your cart."
      }
    }));
    return;
  }

  if (!window.MiCart || typeof window.MiCart.add !== "function") {
    document.dispatchEvent(new CustomEvent("modeinfinity:toast", {
      detail: {
        type: "error",
        title: "Cart not ready",
        message: "The cart has not loaded yet. Please refresh the page and try again."
      }
    }));
    return;
  }

  var id = btn.dataset.modalProductId || "";
  var name = btn.dataset.modalProductName || "Item";
  var price = btn.dataset.modalProductPrice || "0";
  var image = btn.dataset.modalProductImage || "";
  var size = activeSizeGuard.dataset.size || "";

  var cartName = size ? name + " (Size " + size + ")" : name;
  var cartId = size ? id + "__size-" + size : id;

  window.MiCart.add({
    id: cartId,
    name: cartName,
    price: price,
    image: image,
    quantity: 1
  });

  var originalText = btn.textContent;
  btn.textContent = "\u2713 Added to Cart";
  btn.classList.add("is-added");

  window.setTimeout(function () {
    btn.textContent = originalText;
    btn.classList.remove("is-added");
  }, 1800);

  document.dispatchEvent(new CustomEvent("modeinfinity:toast", {
    detail: {
      type: "success",
      title: "Added to cart",
      message: cartName + " was added to your cart."
    }
  }));
}

/* ============================================================
   PRODUCT MODAL — END
   ============================================================ */


/* ============================================================
   SHOP PAGE — BEGIN
   ============================================================ */

function initShopPage() {
  var grid = document.querySelector("[data-shop-products]");
  if (!grid) return;

  var statusEl = document.querySelector("[data-shop-status]");
  var searchEl = document.querySelector("[data-shop-search]");
  var sortEl = document.querySelector("[data-shop-sort]");
  var categoryEls = document.querySelectorAll("[data-shop-filter]");
  var filterToggle = document.querySelector("[data-shop-filter-open]");
  var filterDrawer = document.querySelector("[data-shop-filter-drawer]");
  var filterCloseEls = document.querySelectorAll("[data-shop-filter-close]");
  var filterClear = document.querySelector("[data-shop-filter-clear]");
  var filterCount = document.querySelector("[data-shop-filter-count]");
  var sortMobileEls = document.querySelectorAll("[data-shop-sort-value]");
  var paginationEl = document.querySelector("[data-shop-pagination]");
  var pagesEl = document.querySelector("[data-shop-pages]");
  var prevBtn = document.querySelector("[data-shop-prev]");
  var nextBtn = document.querySelector("[data-shop-next]");

  var PAGE_SIZE = 8;

  var allProducts = [];
  var filteredProducts = [];
  var activeCategory = "all";
  var activeSort = "default";
  var searchQuery = "";
  var currentPage = 1;

  var DATA_URL = "data/shoes.json";

  function escapeHtml(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c];
    });
  }

  function formatNaira(v) {
    try {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0
      }).format(v);
    } catch (e) {
      return "\u20a6" + String(v);
    }
  }

  function normalizeProduct(p) {
    if (!p || typeof p !== "object") return null;
    var id = p.id ? String(p.id).trim() : "";
    if (!id) return null;
    var price = Number(p.price);
    if (!isFinite(price) || price < 0) price = 0;
    var PLACEHOLDER_SHORT = "Handcrafted leather footwear, made by hand in Abuja.";
    var rawShort = String(p.shortDescription || "").trim();
    if (rawShort === PLACEHOLDER_SHORT) rawShort = "";
    return {
      id: id,
      name: String(p.name || "ModeInfinity Product").trim(),
      price: price,
      category: String(p.category || "").trim(),
      shortDescription: rawShort || String(p.description || "").trim(),
      badge: String(p.badge || "").trim(),
      imageAvif: String(p.imageAvif || "").trim(),
      imageWebp: String(p.imageWebp || "").trim(),
      imageFallback: String(p.imageFallback || p.image || "").trim(),
      imageAlt: String(p.imageAlt || p.name || "").trim(),
      featured: !!p.featured,
      active: p.active !== false,
      dateAdded: String(p.dateAdded || "").trim(),
      sortOrder: Number(p.sortOrder) || 0
    };
  }

  function productCard(p) {
    var id = escapeHtml(p.id);
    var name = escapeHtml(p.name);
    var price = formatNaira(p.price);
    var category = escapeHtml(p.category);
    var badge = escapeHtml(p.badge);
    var description = escapeHtml(p.shortDescription);

    var safeAvif = safeUrl(p.imageAvif);
    var safeWebp = safeUrl(p.imageWebp);
    var safeFallback = safeUrl(p.imageFallback);

    var sources = "";
    if (safeAvif) sources += '<source srcset="' + escapeHtml(safeAvif) + '" type="image/avif">';
    if (safeWebp) sources += '<source srcset="' + escapeHtml(safeWebp) + '" type="image/webp">';

    return '' +
      '<article class="product-card"' +
        ' data-product-id="' + id + '"' +
        ' data-product-name="' + name + '"' +
        ' data-product-price="' + escapeHtml(String(p.price)) + '"' +
        ' data-product-category="' + category + '"' +
        ' data-product-image="' + escapeHtml(safeFallback) + '">' +
        '<div class="product-card__media">' +
          (badge ? '<span class="product-card__badge">' + badge + '</span>' : '') +
          '<button type="button" class="product-card__media-link" data-product-open aria-label="View details for ' + name + '">' +
            '<picture>' + sources +
              '<img src="' + escapeHtml(safeFallback) + '" alt="' + escapeHtml(p.imageAlt) + '"' +
              ' width="900" height="1125" loading="lazy" decoding="async">' +
            '</picture>' +
          '</button>' +
        '</div>' +
        '<div class="product-card__body">' +
          (category ? '<p class="product-card__category">' + category + '</p>' : '') +
          '<h3 class="product-card__title"><button type="button" class="product-card__title-button" data-product-open>' + name + '</button></h3>' +
          '<p class="product-card__price">' + price + '</p>' +
          (description ? '<p class="product-card__description">' + description + '</p>' : '') +
          '<div class="product-card__actions">' +
            '<button type="button" class="shop-add-btn" data-product-open aria-label="Select a size and add to cart: ' + name + '">Enquire</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function applyFiltersAndSort() {
    var q = searchQuery.trim().toLowerCase();

    filteredProducts = allProducts.filter(function (p) {
      if (activeCategory !== "all" && p.category !== activeCategory) return false;
      if (!q) return true;
      var haystack = (p.name + " " + p.category + " " + p.shortDescription).toLowerCase();
      return haystack.indexOf(q) !== -1;
    });

    var sort = activeSort;

    filteredProducts.sort(function (a, b) {
      if (sort === "new-old") {
        var aNew = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        var bNew = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        return bNew - aNew;
      }
      if (sort === "old-new") {
        var aOld = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        var bOld = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        return aOld - bOld;
      }
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "name-asc") return a.name.localeCompare(b.name);

      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return a.sortOrder - b.sortOrder;
    });
  }

  function updateStatus() {
    if (!statusEl) return;
    var n = filteredProducts.length;
    var total = allProducts.length;
    if (!total) { statusEl.textContent = ""; return; }
    if (n === total) statusEl.textContent = "Showing all " + total + " products";
    else if (n === 0) statusEl.textContent = "No products match your filters";
    else statusEl.textContent = "Showing " + n + " of " + total + " products";
  }

  function renderPagination() {
    if (!paginationEl || !pagesEl) return;

    var totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);

    if (totalPages <= 1) {
      paginationEl.hidden = true;
      return;
    }

    paginationEl.hidden = false;

    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    var html = "";
    for (var i = 1; i <= totalPages; i++) {
      var isActive = i === currentPage;
      html += '<button type="button" class="shop-pagination__page' +
        (isActive ? ' is-active' : '') + '"' +
        ' data-shop-page="' + i + '"' +
        ' aria-label="Page ' + i + '"' +
        (isActive ? ' aria-current="page"' : '') +
        '>' + i + '</button>';
    }
    pagesEl.innerHTML = html;
  }

  function render() {
    applyFiltersAndSort();
    grid.setAttribute("aria-busy", "false");

    if (!filteredProducts.length) {
      grid.innerHTML = '<p class="shop-empty" role="status">No products match your filters. <a href="#" data-shop-filter-clear-inline>Clear filters</a></p>';
      var inlineClear = grid.querySelector("[data-shop-filter-clear-inline]");
      if (inlineClear) {
        inlineClear.addEventListener("click", function (e) {
          e.preventDefault();
          clearAll();
        });
      }
      updateStatus();
      updateFilterCount();
      if (paginationEl) paginationEl.hidden = true;
      return;
    }

    var totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    var start = (currentPage - 1) * PAGE_SIZE;
    var end = start + PAGE_SIZE;
    var pageItems = filteredProducts.slice(start, end);

    grid.innerHTML = pageItems.map(productCard).join("");

    updateStatus();
    updateFilterCount();
    renderPagination();
  }

  function updateFilterCount() {
    if (!filterCount) return;
    var count = 0;
    if (activeCategory !== "all") count++;
    if (searchQuery.trim()) count++;
    if (activeSort !== "default") count++;
    if (count > 0) {
      filterCount.textContent = String(count);
      filterCount.hidden = false;
    } else {
      filterCount.hidden = true;
    }
  }

  function setCategory(cat) {
    activeCategory = cat;
    currentPage = 1;
    categoryEls.forEach(function (btn) {
      var isActive = btn.dataset.shopFilter === cat;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    render();
  }

  function setSort(val) {
    activeSort = val;
    currentPage = 1;
    if (sortEl) sortEl.value = val;
    sortMobileEls.forEach(function (btn) {
      var isActive = btn.dataset.shopSortValue === val;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    render();
  }

  function goToPage(page) {
    currentPage = page;
    render();

    var shopSection = document.querySelector(".shop");
    var header = document.querySelector(".site-header");
    if (shopSection) {
      var headerH = header ? header.offsetHeight : 68;
      var y = shopSection.getBoundingClientRect().top + window.scrollY - headerH - 8;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  function clearAll() {
    searchQuery = "";
    activeCategory = "all";
    activeSort = "default";
    currentPage = 1;
    if (searchEl) searchEl.value = "";
    if (sortEl) sortEl.value = "default";
    categoryEls.forEach(function (btn) {
      var isActive = btn.dataset.shopFilter === "all";
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    sortMobileEls.forEach(function (btn) {
      var isActive = btn.dataset.shopSortValue === "default";
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    render();
  }

  function clearProductQuery() {
    try {
      history.replaceState(null, "", window.location.pathname);
    } catch (e) {}
  }

  function openRequestedProduct() {
    var productId = "";
    try {
      var params = new URLSearchParams(window.location.search);
      productId = String(params.get("product") || "").trim();
    } catch (e) {
      return;
    }
    if (!productId) return;

    var cards = grid.querySelectorAll(".product-card");
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].dataset.productId === productId) {
        openProductModal(cards[i]);
        clearProductQuery();
        return;
      }
    }

    var product = null;
    for (var j = 0; j < allProducts.length; j++) {
      if (allProducts[j].id === productId) { product = allProducts[j]; break; }
    }
    if (!product) {
      console.warn("[ModeInfinity] Requested product not found:", productId);
      return;
    }

    var temp = document.createElement("div");
    temp.innerHTML = productCard(product);
    var tempCard = temp.firstElementChild;
    if (tempCard) {
      openProductModal(tempCard);
      clearProductQuery();
    }
  }

  var lastFocus = null;
  var isDrawerOpen = false;

  function openDrawer() {
    if (!filterDrawer || isDrawerOpen) return;
    isDrawerOpen = true;
    lastFocus = document.activeElement;
    filterDrawer.setAttribute("aria-hidden", "false");
    filterDrawer.removeAttribute("inert");
    document.body.style.overflow = "hidden";
    if (filterToggle) filterToggle.setAttribute("aria-expanded", "true");
    var closeBtn = filterDrawer.querySelector(".shop-filter-drawer__close");
    window.requestAnimationFrame(function () {
      if (closeBtn) closeBtn.focus();
    });
  }

  function closeDrawer() {
    if (!filterDrawer || !isDrawerOpen) return;
    isDrawerOpen = false;
    filterDrawer.setAttribute("aria-hidden", "true");
    filterDrawer.setAttribute("inert", "");
    document.body.style.overflow = "";
    if (filterToggle) filterToggle.setAttribute("aria-expanded", "false");
    if (lastFocus && document.contains(lastFocus)) {
      window.requestAnimationFrame(function () { lastFocus.focus(); });
    }
  }

  categoryEls.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setCategory(btn.dataset.shopFilter || "all");
    });
  });

  sortMobileEls.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setSort(btn.dataset.shopSortValue || "default");
    });
  });

  if (sortEl) {
    sortEl.addEventListener("change", function () {
      setSort(sortEl.value);
    });
  }

  if (searchEl) {
    var searchTimer = null;
    searchEl.addEventListener("input", function () {
      if (searchTimer) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        searchQuery = searchEl.value || "";
        currentPage = 1;
        render();
      }, 180);
    });
  }

  if (filterToggle) filterToggle.addEventListener("click", openDrawer);
  filterCloseEls.forEach(function (el) { el.addEventListener("click", closeDrawer); });
  if (filterClear) {
    filterClear.addEventListener("click", function () {
      clearAll();
      closeDrawer();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      if (currentPage > 1) goToPage(currentPage - 1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      var totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
      if (currentPage < totalPages) goToPage(currentPage + 1);
    });
  }
  if (pagesEl) {
    pagesEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-shop-page]");
      if (!btn) return;
      var page = Number(btn.dataset.shopPage);
      if (page && page !== currentPage) goToPage(page);
    });
  }

  grid.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-product-open]");
    if (!trigger) return;
    e.preventDefault();
    var card = trigger.closest("[data-product-id]");
    if (card) openProductModal(card);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isDrawerOpen) closeDrawer();
  });

  fetch(DATA_URL, { headers: { Accept: "application/json" } })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      var raw = Array.isArray(data) ? data : (data.products || data.shoes || data.items || []);
      allProducts = raw.map(normalizeProduct).filter(function (p) { return p && p.active; });
      render();
      openRequestedProduct();
    })
    .catch(function (err) {
      console.error("[ModeInfinity] Shop products failed to load:", err);
      grid.setAttribute("aria-busy", "false");
      grid.innerHTML = '<p class="shop-empty" role="status">The collection is temporarily unavailable. Please try again shortly.</p>';
    });
}

/* ============================================================
   SHOP PAGE — END
   ============================================================ */


/* ============================================================
   APPLICATION BOOTSTRAP
   ============================================================ */

async function initializeApplication() {
  if (applicationInitialized) return;

  let navbar = null;
  try {
    navbar = initializeNavbar();
    if (navbar && typeof navbar.handleScroll === "function") navbar.handleScroll();
  } catch (error) {
    console.error("[ModeInfinity] Navbar initialization failed:", error);
  }

  let componentLoader = null;
  try {
    componentLoader = await initializeComponents();
  } catch (error) {
    console.error("[ModeInfinity] Optional component initialization failed:", error);
  }

  let shop = null;

  try { initFormHandler(); }
  catch (error) { console.error("[ModeInfinity] Form initialization failed:", error); }

  try { initScrollAnimations(); }
  catch (error) { console.error("[ModeInfinity] Scroll animation initialization failed:", error); }

  try { initCarousels(); }
  catch (error) { console.error("[ModeInfinity] Carousel initialization failed:", error); }

  try { initCraftCarousels(); }
  catch (error) { console.error("[ModeInfinity] Craft carousel initialization failed:", error); }

  try { initProducts(); }
  catch (error) { console.error("[ModeInfinity] Product initialization failed:", error); }

  try { initShopPage(); }
  catch (error) { console.error("[ModeInfinity] Shop page initialization failed:", error); }

  try { initProductModal(); }
  catch (error) { console.error("[ModeInfinity] Product modal initialization failed:", error); }

  try { initScrollToTop(); }
  catch (error) { console.error("[ModeInfinity] Scroll-to-top initialization failed:", error); }

  try { initAccordion(); }
  catch (error) { console.error("[ModeInfinity] Accordion initialization failed:", error); }

  try { initToast(); }
  catch (error) { console.error("[ModeInfinity] Toast initialization failed:", error); }

  try { initGallery(); }
  catch (error) { console.error("[ModeInfinity] Gallery initialization failed:", error); }

  try { initGalleryViewer(); }
  catch (error) { console.error("[ModeInfinity] Gallery viewer initialization failed:", error); }

  applicationInitialized = true;

  document.dispatchEvent(
    new CustomEvent("modeinfinity:app-ready", {
      detail: { componentLoader, navbar, shop }
    })
  );

  console.info("[ModeInfinity] Application initialized successfully.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApplication, { once: true });
} else {
  initializeApplication();
}

export default initializeApplication;
export { initializeApplication };
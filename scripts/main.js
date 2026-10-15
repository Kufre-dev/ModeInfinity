/* ============================================================
   MODEINFINITY — APPLICATION ENTRY POINT
   File: scripts/main.js
   ============================================================ */

import { initializeComponents } from "./components.js";
import { initializeNavbar } from "./navbar.js";
import { initScrollAnimations } from "./scrollanimations.js";
import {
  initCarousels,
  initCraftCarousels
} from "./swiper.js";
import { initShop } from "./shop.js";
import { initFormHandler } from "./formhandler.js";
import { initGallery } from "./gallery.js";

let applicationInitialized = false;


/* ============================================================
   PRODUCTS — BEGIN
   ============================================================
   Minimal product renderer for the homepage collection grid.
   Loads data/shoes.json and injects product cards into
   [data-home-products]. Does NOT touch the cart.
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
    return {
      id: id,
      name: String(product.name || "ModeInfinity Product").trim(),
      price: price,
      category: String(product.category || "").trim(),
      shortDescription: String(product.shortDescription || product.description || "").trim(),
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
    var href = "shop.html?product=" + encodeURIComponent(product.id);
    var price = escapeHtml(formatNaira(product.price));
    var category = escapeHtml(product.category);
    var badge = escapeHtml(product.badge);
    var description = escapeHtml(product.shortDescription);

    var sources = "";
    if (product.imageAvif) {
      sources += '<source srcset="' + escapeHtml(product.imageAvif) + '" type="image/avif">';
    }
    if (product.imageWebp) {
      sources += '<source srcset="' + escapeHtml(product.imageWebp) + '" type="image/webp">';
    }

    return '' +
      '<article class="product-card"' +
        ' data-product-id="' + id + '"' +
        ' data-product-name="' + name + '"' +
        ' data-product-price="' + escapeHtml(String(product.price)) + '"' +
        ' data-product-category="' + category + '"' +
        ' data-product-image="' + escapeHtml(product.imageFallback) + '">' +
        '<div class="product-card__media">' +
          (badge ? '<span class="product-card__badge" aria-label="' + badge + '">' + badge + '</span>' : '') +
          '<a class="product-card__media-link" href="' + href + '" aria-label="View ' + name + '">' +
            '<picture>' + sources +
              '<img src="' + escapeHtml(product.imageFallback) + '" alt="' + escapeHtml(product.imageAlt) + '"' +
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

  function applyVisibility(show) {
    var buttons = getButtons();
    if (!buttons.length) return;

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (show) {
        btn.classList.add("is-visible");
        btn.hidden = false;
        btn.removeAttribute("aria-hidden");
      } else {
        btn.classList.remove("is-visible");
        btn.hidden = true;
      }
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
   ============================================================ */

function initAccordion() {
  function getTrigger(event) {
    return event.target.closest(".accordion-item__trigger");
  }

  function getPanel(trigger) {
    var id = trigger.getAttribute("aria-controls");
    if (!id) return null;
    return document.getElementById(id);
  }

  function setOpen(trigger, panel, open) {
    trigger.setAttribute("aria-expanded", open ? "true" : "false");

    var item = trigger.closest(".accordion-item");
    if (item) item.classList.toggle("is-open", open);

    if (panel) {
      panel.hidden = !open;
      panel.classList.toggle("is-open", open);
    }
  }

  function closeSiblings(trigger) {
    var group = trigger.closest(".accordion");
    if (!group) return;

    var siblings = group.querySelectorAll(".accordion-item__trigger");
    for (var i = 0; i < siblings.length; i++) {
      var sib = siblings[i];
      if (sib === trigger) continue;
      var sibPanel = getPanel(sib);
      setOpen(sib, sibPanel, false);
    }
  }

  document.addEventListener("click", function (event) {
    var trigger = getTrigger(event);
    if (!trigger) return;

    event.preventDefault();

    var panel = getPanel(trigger);
    var isOpen = trigger.getAttribute("aria-expanded") === "true";

    if (isOpen) {
      setOpen(trigger, panel, false);
    } else {
      closeSiblings(trigger);
      setOpen(trigger, panel, true);
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

  function getToast() {
    return document.getElementById("toast");
  }

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

    toast.classList.remove(
      "toast--success",
      "toast--error",
      "toast--warning",
      "toast--info"
    );
    toast.classList.add("toast--" + type);

    clearTimer();

    toast.hidden = false;
    // Force reflow so the transition fires on rapid repeats.
    // eslint-disable-next-line no-unused-expressions
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
   APPLICATION BOOTSTRAP
   ============================================================ */

async function initializeApplication() {
  if (applicationInitialized) return;

  /* 1. NAVBAR */
  let navbar = null;

  try {
    navbar = initializeNavbar();

    if (navbar && typeof navbar.handleScroll === "function") {
      navbar.handleScroll();
    }
  } catch (error) {
    console.error("[ModeInfinity] Navbar initialization failed:", error);
  }

  /* 2. OPTIONAL COMPONENTS */
  let componentLoader = null;

  try {
    componentLoader = await initializeComponents();
  } catch (error) {
    console.error("[ModeInfinity] Optional component initialization failed:", error);
  }

  /* 3. SHOP — DISABLED */
  let shop = null;

  /*
  try {
    shop = await initShop();
  } catch (error) {
    console.error("[ModeInfinity] Shop initialization failed:", error);
  }
  */

  /* 4. FORMS */
  try {
    initFormHandler();
  } catch (error) {
    console.error("[ModeInfinity] Form initialization failed:", error);
  }

  /* 5. SCROLL ANIMATIONS */
  try {
    initScrollAnimations();
  } catch (error) {
    console.error("[ModeInfinity] Scroll animation initialization failed:", error);
  }

  /* 6. CAROUSELS */
  try {
    initCarousels();
  } catch (error) {
    console.error("[ModeInfinity] Carousel initialization failed:", error);
  }

  /* 7. CRAFT CAROUSELS */
  try {
    initCraftCarousels();
  } catch (error) {
    console.error("[ModeInfinity] Craft carousel initialization failed:", error);
  }

  /* 8. PRODUCTS */
  try {
    initProducts();
  } catch (error) {
    console.error("[ModeInfinity] Product initialization failed:", error);
  }

  /* 9. SCROLL TO TOP */
  try {
    initScrollToTop();
  } catch (error) {
    console.error("[ModeInfinity] Scroll-to-top initialization failed:", error);
  }

  /* 10. ACCORDION */
  try {
    initAccordion();
  } catch (error) {
    console.error("[ModeInfinity] Accordion initialization failed:", error);
  }

  /* 11. TOAST */
  try {
    initToast();
  } catch (error) {
    console.error("[ModeInfinity] Toast initialization failed:", error);
  }

  /* 12. GALLERY / LIGHTBOX */
  try {
    initGallery();
  } catch (error) {
    console.error("[ModeInfinity] Gallery initialization failed:", error);
  }

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
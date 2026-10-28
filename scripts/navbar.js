/* ============================================================
   MODEINFINITY — NAVBAR / HEADER CONTROLLER
   File: scripts/navbar.js

   Controls:
   - Desktop primary navigation (static markup, untouched)
   - Mobile navigation drawer (open / close)
   - Body scroll lock while the drawer is open
   - Focus trap inside the drawer
   - Escape-to-close
   - Backdrop close
   - Active page indicator (aria-current="page")
   - Header scrolled state (.is-scrolled)

   HTML:
   - components/header.html
   - or the inlined <header> markup in each page

   CSS:
   - styles/components.css

   Dependencies:
   - None (self-contained)

   Notes:
   - Mobile drawer links MUST navigate. This controller only
     closes the drawer in response to a link click; it never
     calls preventDefault() on navigation anchors.
   - The toggle, close button, and backdrop are <button>
     elements — they call preventDefault() on click because
     their purpose is not navigation.
   ============================================================ */

class Navbar {
  constructor(options = {}) {
    this.options = {
breakpoint: 1088,
      selectors: {
        header: ".site-header",
        toggle: "[data-mobile-nav-toggle]",
        navigation: "#mobile-navigation",
        drawer: "#mobile-navigation .mobile-navigation__drawer",
        backdrop: "#mobile-navigation [data-mobile-nav-backdrop]",
        close: "#mobile-navigation [data-mobile-nav-close]",
        links: "#mobile-navigation a",
      },
      ...options,
    };

    this.elements = {
      header: null,
      toggle: null,
      navigation: null,
      drawer: null,
      backdrop: null,
      close: null,
      links: [],
    };

    this.isOpen = false;
    this.isInitialized = false;
    this.lastFocusedElement = null;
    this.previousBodyOverflow = "";
    this.previousHtmlOverflow = "";

    this.boundHandlers = {
      toggle: this.handleToggle.bind(this),
      close: this.handleCloseClick.bind(this),
      backdrop: this.handleBackdropClick.bind(this),
      link: this.handleLinkClick.bind(this),
      keydown: this.handleKeydown.bind(this),
      resize: this.handleViewportChange.bind(this),
      orientationchange: this.handleViewportChange.bind(this),
      visibilitychange: this.handleVisibilityChange.bind(this),
      scroll: this.handleScroll.bind(this),
    };
  }

  init() {
    if (this.isInitialized) {
      return this;
    }

    this.cacheElements();

    if (!this.elements.header) {
      console.warn("[ModeInfinity Navbar] Header was not found.");
      return this;
    }

    if (!this.elements.toggle) {
      console.warn("[ModeInfinity Navbar] Mobile navigation toggle was not found.");
      return this;
    }

    if (!this.elements.navigation) {
      console.warn("[ModeInfinity Navbar] Mobile navigation element was not found.");
      return this;
    }

    this.bindEvents();
    this.setInitialState();
    this.updateActivePage();

    this.isInitialized = true;

    this.dispatchEvent("modeinfinity:navbar-ready", { navbar: this });

    return this;
  }

  cacheElements() {
    const { selectors } = this.options;

    this.elements.header = document.querySelector(selectors.header);
    this.elements.toggle = document.querySelector(selectors.toggle);
    this.elements.navigation = document.querySelector(selectors.navigation);
    this.elements.drawer = document.querySelector(selectors.drawer);
    this.elements.backdrop = document.querySelector(selectors.backdrop);
    this.elements.close = document.querySelector(selectors.close);

    this.elements.links = this.elements.navigation
      ? Array.from(this.elements.navigation.querySelectorAll(selectors.links))
      : [];
  }

  bindEvents() {
    const { toggle, close, backdrop } = this.elements;

    if (toggle) {
      toggle.addEventListener("click", this.boundHandlers.toggle);
    }

    if (close) {
      close.addEventListener("click", this.boundHandlers.close);
    }

    if (backdrop) {
      backdrop.addEventListener("click", this.boundHandlers.backdrop);
    }

    /*
     * Navigation links inside the mobile drawer close the
     * drawer so the page transition feels clean — but they
     * MUST NOT preventDefault(), otherwise the browser never
     * follows the href on viewports where the drawer is shown.
     */
    this.elements.links.forEach((link) => {
      link.addEventListener("click", this.boundHandlers.link);
    });

    document.addEventListener("keydown", this.boundHandlers.keydown);
    window.addEventListener("resize", this.boundHandlers.resize, { passive: true });
    window.addEventListener("orientationchange", this.boundHandlers.orientationchange, { passive: true });
    window.addEventListener("scroll", this.boundHandlers.scroll, { passive: true });
    document.addEventListener("visibilitychange", this.boundHandlers.visibilitychange);
  }

  setInitialState() {
    const { navigation, toggle, drawer } = this.elements;

    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation menu");
    }

    if (navigation) {
      navigation.classList.remove("is-open");
      navigation.setAttribute("aria-hidden", "true");
      navigation.setAttribute("inert", "");
    }

    if (drawer) {
      drawer.setAttribute("tabindex", "-1");
    }

    this.isOpen = false;

    this.handleScroll();
  }

  handleScroll() {
    const { header } = this.elements;

    if (!header) {
      return;
    }

    header.classList.toggle("is-scrolled", window.scrollY > 0);
  }

  handleToggle(event) {
    event.preventDefault();

    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.isOpen || !this.isMobileViewport()) {
      return;
    }

    const { navigation, toggle, drawer } = this.elements;

    if (!navigation || !toggle || !drawer) {
      return;
    }

    this.lastFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    this.previousHtmlOverflow = document.documentElement.style.overflow;
    this.previousBodyOverflow = document.body.style.overflow;

    this.lockBodyScroll();

    navigation.classList.add("is-open");
    navigation.removeAttribute("inert");
    navigation.setAttribute("aria-hidden", "false");

    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close navigation menu");

    this.isOpen = true;

    window.requestAnimationFrame(() => {
      if (this.isOpen) {
        this.focusFirstAvailableElement();
      }
    });

    this.dispatchEvent("modeinfinity:mobile-nav-open", { navbar: this });
  }

  close(options = {}) {
    if (!this.isOpen) {
      return;
    }

    const { restoreFocus = true } = options;
    const { navigation, toggle } = this.elements;

    if (!navigation || !toggle) {
      return;
    }

    navigation.classList.remove("is-open");
    navigation.setAttribute("aria-hidden", "true");
    navigation.setAttribute("inert", "");

    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation menu");

    this.isOpen = false;

    this.unlockBodyScroll();

    if (
      restoreFocus &&
      this.lastFocusedElement &&
      typeof this.lastFocusedElement.focus === "function" &&
      document.contains(this.lastFocusedElement)
    ) {
      window.requestAnimationFrame(() => {
        this.lastFocusedElement.focus({ preventScroll: true });
      });
    }

    this.dispatchEvent("modeinfinity:mobile-nav-close", { navbar: this });
  }

  handleCloseClick(event) {
    event.preventDefault();
    this.close();
  }

  handleBackdropClick(event) {
    if (event.target !== this.elements.backdrop) {
      return;
    }

    event.preventDefault();
    this.close();
  }

  /*
   * Nav link click handler.
   *
   * Closes the drawer without preventing navigation. The link's
   * native behaviour (following href) is left untouched.
   *
   * restoreFocus is disabled so focus does not jump back to the
   * hamburger toggle while the browser is loading the next page.
   */
  handleLinkClick() {
    this.close({ restoreFocus: false });
  }

  handleKeydown(event) {
    if (!this.isOpen) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === "Tab") {
      this.handleFocusTrap(event);
    }
  }

  handleFocusTrap(event) {
    const { drawer } = this.elements;

    if (!drawer) {
      return;
    }

    const focusable = this.getFocusableElements(drawer);

    if (!focusable.length) {
      event.preventDefault();
      drawer.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  focusFirstAvailableElement() {
    const { drawer } = this.elements;

    if (!drawer) {
      return;
    }

    const first = this.getFocusableElements(drawer)[0];

    if (first) {
      first.focus({ preventScroll: true });
      return;
    }

    drawer.focus({ preventScroll: true });
  }

  getFocusableElements(container) {
    if (!container) {
      return [];
    }

    const selector = [
      "a[href]",
      "area[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "iframe",
      "object",
      "embed",
      "[contenteditable]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    return Array.from(container.querySelectorAll(selector)).filter((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      if (element.hasAttribute("disabled")) {
        return false;
      }

      if (element.getAttribute("aria-hidden") === "true") {
        return false;
      }

      return (
        element.offsetWidth > 0 ||
        element.offsetHeight > 0 ||
        element === document.activeElement
      );
    });
  }

  lockBodyScroll() {
    document.documentElement.classList.add("nav-open");
    document.body.classList.add("nav-open");

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  unlockBodyScroll() {
    document.documentElement.classList.remove("nav-open");
    document.body.classList.remove("nav-open");

    document.documentElement.style.overflow = this.previousHtmlOverflow;
    document.body.style.overflow = this.previousBodyOverflow;
  }

  isMobileViewport() {
    return window.innerWidth < this.options.breakpoint;
  }

  handleViewportChange() {
    if (this.isOpen && !this.isMobileViewport()) {
      this.close({ restoreFocus: false });
    }
  }

  handleVisibilityChange() {
    if (document.hidden && this.isOpen) {
      this.close({ restoreFocus: false });
    }
  }

  updateActivePage() {
    const currentPath = this.normalizePath(window.location.pathname);

    document.querySelectorAll("[data-nav-page]").forEach((link) => {
      const href = link.getAttribute("href");

      if (!href) {
        return;
      }

      const linkPath = this.normalizePath(this.resolvePath(href));

      if (this.pathsMatch(currentPath, linkPath)) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      } else {
        link.classList.remove("active");

        if (link.getAttribute("aria-current") === "page") {
          link.removeAttribute("aria-current");
        }
      }
    });
  }

  resolvePath(href) {
    try {
      return new URL(href, window.location.href).pathname;
    } catch {
      return href;
    }
  }

  normalizePath(path) {
    if (!path) {
      return "/";
    }

    let normalized = path.trim();
    normalized = normalized.split("?")[0].split("#")[0].replace(/\/+/g, "/");

    if (normalized === "/index.html") {
      return "/";
    }

    if (normalized.length > 1 && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }

    return normalized.toLowerCase();
  }

  pathsMatch(a, b) {
    return a === b;
  }

  dispatchEvent(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  getState() {
    return {
      initialized: this.isInitialized,
      open: this.isOpen,
      mobileViewport: this.isMobileViewport(),
    };
  }

  destroy() {
    const { toggle, close, backdrop } = this.elements;

    if (toggle) {
      toggle.removeEventListener("click", this.boundHandlers.toggle);
    }

    if (close) {
      close.removeEventListener("click", this.boundHandlers.close);
    }

    if (backdrop) {
      backdrop.removeEventListener("click", this.boundHandlers.backdrop);
    }

    this.elements.links.forEach((link) => {
      link.removeEventListener("click", this.boundHandlers.link);
    });

    document.removeEventListener("keydown", this.boundHandlers.keydown);
    window.removeEventListener("resize", this.boundHandlers.resize);
    window.removeEventListener("orientationchange", this.boundHandlers.orientationchange);
    window.removeEventListener("scroll", this.boundHandlers.scroll);
    document.removeEventListener("visibilitychange", this.boundHandlers.visibilitychange);

    if (this.isOpen) {
      this.close({ restoreFocus: false });
    }

    this.isInitialized = false;
  }
}

let navbarInstance = null;

function initializeNavbar() {
  if (!document.querySelector(".site-header")) {
    console.warn("[ModeInfinity Navbar] Cannot initialize: header.html has not been loaded.");
    return null;
  }

  if (!navbarInstance) {
    navbarInstance = new Navbar();
  }

  if (navbarInstance.isInitialized) {
    navbarInstance.cacheElements();
    navbarInstance.updateActivePage();
    navbarInstance.handleScroll();
  } else {
    navbarInstance.init();
  }

  return navbarInstance;
}

export default Navbar;
export { Navbar, initializeNavbar };
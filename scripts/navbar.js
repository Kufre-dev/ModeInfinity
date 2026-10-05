class Navbar {
	constructor(e = {}) {
		this.options = {
			breakpoint: 1024,
			selectors: {
				header: ".site-header",
				toggle: "[data-mobile-nav-toggle]",
				navigation: "#mobile-navigation",
				drawer: "#mobile-navigation .mobile-navigation__drawer",
				backdrop: "#mobile-navigation [data-mobile-nav-backdrop]",
				close: "#mobile-navigation [data-mobile-nav-close]",
				links: "#mobile-navigation a"
			},
			...e
		}, this.elements = {
			header: null,
			toggle: null,
			navigation: null,
			drawer: null,
			backdrop: null,
			close: null,
			links: []
		}, this.isOpen = !1, this.isInitialized = !1, this.lastFocusedElement = null, this.previousBodyOverflow = "", this.previousHtmlOverflow = "", this.boundHandlers = {
			toggle: this.handleToggle.bind(this),
			close: this.handleCloseClick.bind(this),
			backdrop: this.handleBackdropClick.bind(this),
			keydown: this.handleKeydown.bind(this),
			resize: this.handleViewportChange.bind(this),
			orientationchange: this.handleViewportChange.bind(this),
			visibilitychange: this.handleVisibilityChange.bind(this),
			scroll: this.handleScroll.bind(this)
		}
	}
	init() {
		return this.isInitialized ? this : (this.cacheElements(), this.elements.header ? this.elements.toggle ? this.elements.navigation ? (this.bindEvents(), this.setInitialState(), this.updateActivePage(), this.isInitialized = !0, this.dispatchEvent("modeinfinity:navbar-ready", {
			navbar: this
		}), this) : (console.warn("[ModeInfinity Navbar] Mobile navigation element was not found."), this) : (console.warn("[ModeInfinity Navbar] Mobile navigation toggle was not found."), this) : (console.warn("[ModeInfinity Navbar] Header was not found."), this))
	}
	cacheElements() {
		let {
			selectors: e
		} = this.options;
		this.elements.header = document.querySelector(e.header), this.elements.toggle = document.querySelector(e.toggle), this.elements.navigation = document.querySelector(e.navigation), this.elements.drawer = document.querySelector(e.drawer), this.elements.backdrop = document.querySelector(e.backdrop), this.elements.close = document.querySelector(e.close), this.elements.links = this.elements.navigation ? Array.from(this.elements.navigation.querySelectorAll(e.links)) : []
	}
	bindEvents() {
		let {
			toggle: e,
			close: t,
			backdrop: i
		} = this.elements;
		e && e.addEventListener("click", this.boundHandlers.toggle), t && t.addEventListener("click", this.boundHandlers.close), i && i.addEventListener("click", this.boundHandlers.backdrop), this.elements.links.forEach(e => {
			e.addEventListener("click", this.boundHandlers.close)
		}), document.addEventListener("keydown", this.boundHandlers.keydown), window.addEventListener("resize", this.boundHandlers.resize, {
			passive: !0
		}), window.addEventListener("orientationchange", this.boundHandlers.orientationchange, {
			passive: !0
		}), window.addEventListener("scroll", this.boundHandlers.scroll, {
			passive: !0
		}), document.addEventListener("visibilitychange", this.boundHandlers.visibilitychange)
	}
	setInitialState() {
		let {
			navigation: e,
			toggle: t,
			drawer: i
		} = this.elements;
		t && (t.setAttribute("aria-expanded", "false"), t.setAttribute("aria-label", "Open navigation menu")), e && (e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true"), e.setAttribute("inert", "")), i && i.setAttribute("tabindex", "-1"), this.isOpen = !1, this.handleScroll()
	}
	handleScroll() {
		let {
			header: e
		} = this.elements;
		e && e.classList.toggle("is-scrolled", window.scrollY > 0)
	}
	handleToggle(e) {
		e.preventDefault(), this.isOpen ? this.close() : this.open()
	}
	open() {
		if (this.isOpen || !this.isMobileViewport()) return;
		let {
			navigation: e,
			toggle: t,
			drawer: i
		} = this.elements;
		e && t && i && (this.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null, this.previousHtmlOverflow = document.documentElement.style.overflow, this.previousBodyOverflow = document.body.style.overflow, this.lockBodyScroll(), e.classList.add("is-open"), e.removeAttribute("inert"), e.setAttribute("aria-hidden", "false"), t.setAttribute("aria-expanded", "true"), t.setAttribute("aria-label", "Close navigation menu"), this.isOpen = !0, window.requestAnimationFrame(() => {
			this.isOpen && this.focusFirstAvailableElement()
		}), this.dispatchEvent("modeinfinity:mobile-nav-open", {
			navbar: this
		}))
	}
	close(e = {}) {
		if (!this.isOpen) return;
		let {
			restoreFocus: t = !0
		} = e, {
			navigation: i,
			toggle: n
		} = this.elements;
		i && n && (i.classList.remove("is-open"), i.setAttribute("aria-hidden", "true"), i.setAttribute("inert", ""), n.setAttribute("aria-expanded", "false"), n.setAttribute("aria-label", "Open navigation menu"), this.isOpen = !1, this.unlockBodyScroll(), t && this.lastFocusedElement && "function" == typeof this.lastFocusedElement.focus && document.contains(this.lastFocusedElement) && window.requestAnimationFrame(() => {
			this.lastFocusedElement.focus({
				preventScroll: !0
			})
		}), this.dispatchEvent("modeinfinity:mobile-nav-close", {
			navbar: this
		}))
	}
	handleCloseClick(e) {
		e.preventDefault(), this.close()
	}
	handleBackdropClick(e) {
		e.target === this.elements.backdrop && (e.preventDefault(), this.close())
	}
	handleKeydown(e) {
		if (this.isOpen) {
			if ("Escape" === e.key) {
				e.preventDefault(), this.close();
				return
			}
			"Tab" === e.key && this.handleFocusTrap(e)
		}
	}
	handleFocusTrap(e) {
		let {
			drawer: t
		} = this.elements;
		if (!t) return;
		let i = this.getFocusableElements(t);
		if (!i.length) {
			e.preventDefault(), t.focus({
				preventScroll: !0
			});
			return
		}
		let n = i[0],
			s = i[i.length - 1],
			a = document.activeElement;
		if (e.shiftKey && a === n) {
			e.preventDefault(), s.focus({
				preventScroll: !0
			});
			return
		}
		e.shiftKey || a !== s || (e.preventDefault(), n.focus({
			preventScroll: !0
		}))
	}
	focusFirstAvailableElement() {
		let {
			drawer: e
		} = this.elements;
		if (!e) return;
		let t = this.getFocusableElements(e)[0];
		if (t) {
			t.focus({
				preventScroll: !0
			});
			return
		}
		e.focus({
			preventScroll: !0
		})
	}
	getFocusableElements(e) {
		return e ? Array.from(e.querySelectorAll("a[href],area[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,object,embed,[contenteditable],[tabindex]:not([tabindex='-1'])")).filter(e => !(!(e instanceof HTMLElement) || e.hasAttribute("disabled")) && "true" !== e.getAttribute("aria-hidden") && (e.offsetWidth > 0 || e.offsetHeight > 0 || e === document.activeElement)) : []
	}
	lockBodyScroll() {
		document.documentElement.classList.add("nav-open"), document.body.classList.add("nav-open"), document.documentElement.style.overflow = "hidden", document.body.style.overflow = "hidden"
	}
	unlockBodyScroll() {
		document.documentElement.classList.remove("nav-open"), document.body.classList.remove("nav-open"), document.documentElement.style.overflow = this.previousHtmlOverflow, document.body.style.overflow = this.previousBodyOverflow
	}
	isMobileViewport() {
		return window.innerWidth < this.options.breakpoint
	}
	handleViewportChange() {
		this.isOpen && !this.isMobileViewport() && this.close({
			restoreFocus: !1
		})
	}
	handleVisibilityChange() {
		document.hidden && this.isOpen && this.close({
			restoreFocus: !1
		})
	}
	updateActivePage() {
		let e = this.normalizePath(window.location.pathname);
		document.querySelectorAll("[data-nav-page]").forEach(t => {
			let i = t.getAttribute("href");
			if (!i) return;
			let n = this.normalizePath(this.resolvePath(i));
			this.pathsMatch(e, n) ? (t.classList.add("active"), t.setAttribute("aria-current", "page")) : (t.classList.remove("active"), "page" === t.getAttribute("aria-current") && t.removeAttribute("aria-current"))
		})
	}
	resolvePath(e) {
		try {
			return new URL(e, window.location.href).pathname
		} catch {
			return e
		}
	}
	normalizePath(e) {
		if (!e) return "/";
		let t = e.trim();
		return "/index.html" === (t = t.split("?")[0].split("#")[0].replace(/\/+/g, "/")) ? "/" : (t.length > 1 && t.endsWith("/") && (t = t.slice(0, -1)), t.toLowerCase())
	}
	pathsMatch(e, t) {
		return e === t
	}
	dispatchEvent(e, t = {}) {
		document.dispatchEvent(new CustomEvent(e, {
			detail: t
		}))
	}
	getState() {
		return {
			initialized: this.isInitialized,
			open: this.isOpen,
			mobileViewport: this.isMobileViewport()
		}
	}
	destroy() {
		let {
			toggle: e,
			close: t,
			backdrop: i
		} = this.elements;
		e && e.removeEventListener("click", this.boundHandlers.toggle), t && t.removeEventListener("click", this.boundHandlers.close), i && i.removeEventListener("click", this.boundHandlers.backdrop), this.elements.links.forEach(e => {
			e.removeEventListener("click", this.boundHandlers.close)
		}), document.removeEventListener("keydown", this.boundHandlers.keydown), window.removeEventListener("resize", this.boundHandlers.resize), window.removeEventListener("orientationchange", this.boundHandlers.orientationchange), window.removeEventListener("scroll", this.boundHandlers.scroll), document.removeEventListener("visibilitychange", this.boundHandlers.visibilitychange), this.isOpen && this.close({
			restoreFocus: !1
		}), this.isInitialized = !1
	}
}
let navbarInstance = null;

function initializeNavbar() {
	return document.querySelector(".site-header") ? (navbarInstance || (navbarInstance = new Navbar), navbarInstance.isInitialized ? (navbarInstance.cacheElements(), navbarInstance.updateActivePage(), navbarInstance.handleScroll()) : navbarInstance.init(), navbarInstance) : (console.warn("[ModeInfinity Navbar] Cannot initialize: header.html has not been loaded."), null)
}
export default Navbar;
export {
	Navbar,
	initializeNavbar
};
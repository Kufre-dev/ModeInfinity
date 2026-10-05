/* ============================================================
   MODEINFINITY — SHARED JAVASCRIPT HELPERS
   ============================================================

   Reusable utility functions for the ModeInfinity website.

   Used by:
   - scripts/main.js
   - scripts/navbar.js
   - scripts/scrollanimations.js
   - scripts/gallery.js
   - scripts/shop.js
   - scripts/formhandler.js
   - scripts/swiper.js
   - scripts/validators.js

   Responsibilities:
   - DOM selection
   - DOM collection
   - class manipulation
   - visibility helpers
   - event listener helpers
   - storage helpers
   - number / currency formatting
   - URL and page detection
   - debounce / throttle
   - HTML escaping
   - image source helpers
   - focus helpers
   - reduced-motion detection
   - viewport helpers

   Principles:
   - ES6+
   - Small, reusable functions
   - No external dependencies
   - Defensive DOM handling
   - No emoji-dependent UI
   - No page-specific business logic
   ============================================================ */


/* ============================================================
   1. DOM HELPERS
   ============================================================ */

/**
 * Select a single DOM element.
 *
 * @param {string} selector
 * @param {ParentNode} [parent=document]
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
	if (
		typeof selector !== "string" ||
		!selector.trim() ||
		!parent ||
		typeof parent.querySelector !== "function"
	) {
		return null;
	}

	return parent.querySelector(selector);
}


/**
 * Select multiple DOM elements.
 *
 * @param {string} selector
 * @param {ParentNode} [parent=document]
 * @returns {Element[]}
 */
export function $$(selector, parent = document) {
	if (
		typeof selector !== "string" ||
		!selector.trim() ||
		!parent ||
		typeof parent.querySelectorAll !== "function"
	) {
		return [];
	}

	return Array.from(parent.querySelectorAll(selector));
}


/**
 * Check whether a value is a DOM element.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isElement(value) {
	return value instanceof Element;
}


/* ============================================================
   2. CLASS HELPERS
   ============================================================ */

/**
 * Add one or more classes to an element.
 *
 * @param {Element|null} element
 * @param {...string} classNames
 */
export function addClass(element, ...classNames) {
	if (!isElement(element)) {
		return;
	}

	const validClasses = classNames.filter(
		(className) =>
		typeof className === "string" &&
		className.trim()
	);

	if (validClasses.length) {
		element.classList.add(...validClasses);
	}
}


/**
 * Remove one or more classes from an element.
 *
 * @param {Element|null} element
 * @param {...string} classNames
 */
export function removeClass(element, ...classNames) {
	if (!isElement(element)) {
		return;
	}

	const validClasses = classNames.filter(
		(className) =>
		typeof className === "string" &&
		className.trim()
	);

	if (validClasses.length) {
		element.classList.remove(...validClasses);
	}
}


/**
 * Toggle a class on an element.
 *
 * @param {Element|null} element
 * @param {string} className
 * @param {boolean} [force]
 * @returns {boolean}
 */
export function toggleClass(element, className, force) {
	if (
		!isElement(element) ||
		typeof className !== "string" ||
		!className.trim()
	) {
		return false;
	}

	return element.classList.toggle(className, force);
}


/**
 * Check whether an element contains a class.
 *
 * @param {Element|null} element
 * @param {string} className
 * @returns {boolean}
 */
export function hasClass(element, className) {
	if (
		!isElement(element) ||
		typeof className !== "string"
	) {
		return false;
	}

	return element.classList.contains(className);
}


/* ============================================================
   3. VISIBILITY HELPERS
   ============================================================ */

/**
 * Show an element by removing the hidden attribute.
 *
 * @param {HTMLElement|null} element
 */
export function showElement(element) {
	if (!(element instanceof HTMLElement)) {
		return;
	}

	element.hidden = false;
}


/**
 * Hide an element using the hidden attribute.
 *
 * @param {HTMLElement|null} element
 */
export function hideElement(element) {
	if (!(element instanceof HTMLElement)) {
		return;
	}

	element.hidden = true;
}


/**
 * Set an element's accessible visibility state.
 *
 * @param {HTMLElement|null} element
 * @param {boolean} visible
 */
export function setElementVisibility(element, visible) {
	if (!(element instanceof HTMLElement)) {
		return;
	}

	element.hidden = !visible;
}


/**
 * Set aria-expanded.
 *
 * @param {Element|null} element
 * @param {boolean} expanded
 */
export function setExpanded(element, expanded) {
	if (!isElement(element)) {
		return;
	}

	element.setAttribute(
		"aria-expanded",
		String(Boolean(expanded))
	);
}


/**
 * Set aria-hidden.
 *
 * @param {Element|null} element
 * @param {boolean} hidden
 */
export function setAriaHidden(element, hidden) {
	if (!isElement(element)) {
		return;
	}

	element.setAttribute(
		"aria-hidden",
		String(Boolean(hidden))
	);
}


/* ============================================================
   4. EVENT HELPERS
   ============================================================ */

/**
 * Safely attach an event listener.
 *
 * @param {EventTarget|null} target
 * @param {string} type
 * @param {EventListenerOrEventListenerObject} handler
 * @param {boolean|AddEventListenerOptions} [options]
 */
export function on(
	target,
	type,
	handler,
	options
) {
	if (
		!target ||
		typeof target.addEventListener !== "function" ||
		typeof type !== "string" ||
		typeof handler !== "function"
	) {
		return;
	}

	target.addEventListener(
		type,
		handler,
		options
	);
}


/**
 * Safely remove an event listener.
 *
 * @param {EventTarget|null} target
 * @param {string} type
 * @param {EventListenerOrEventListenerObject} handler
 * @param {boolean|EventListenerOptions} [options]
 */
export function off(
	target,
	type,
	handler,
	options
) {
	if (
		!target ||
		typeof target.removeEventListener !== "function" ||
		typeof type !== "string" ||
		typeof handler !== "function"
	) {
		return;
	}

	target.removeEventListener(
		type,
		handler,
		options
	);
}


/**
 * Create a delegated event listener.
 *
 * @param {Element|Document} parent
 * @param {string} eventType
 * @param {string} selector
 * @param {Function} handler
 */
export function delegate(
	parent,
	eventType,
	selector,
	handler
) {
	if (
		!parent ||
		typeof parent.addEventListener !== "function" ||
		typeof eventType !== "string" ||
		typeof selector !== "string" ||
		typeof handler !== "function"
	) {
		return;
	}

	parent.addEventListener(
		eventType,
		(event) => {
			const target = event.target;

			if (!(target instanceof Element)) {
				return;
			}

			const matchedElement =
				target.closest(selector);

			if (
				!matchedElement ||
				!parent.contains(matchedElement)
			) {
				return;
			}

			handler(
				event,
				matchedElement
			);
		}
	);
}


/* ============================================================
   5. DEBOUNCE / THROTTLE
   ============================================================ */

/**
 * Delay execution until calls stop for the specified period.
 *
 * @param {Function} callback
 * @param {number} [delay=200]
 * @returns {Function}
 */
export function debounce(
	callback,
	delay = 200
) {
	if (typeof callback !== "function") {
		return () => {};
	}

	let timeoutId = null;

	return function debouncedFunction(...args) {
		const context = this;

		window.clearTimeout(timeoutId);

		timeoutId = window.setTimeout(
			() => {
				callback.apply(
					context,
					args
				);
			},
			Math.max(0, delay)
		);
	};
}


/**
 * Limit execution frequency.
 *
 * @param {Function} callback
 * @param {number} [interval=100]
 * @returns {Function}
 */
export function throttle(
	callback,
	interval = 100
) {
	if (typeof callback !== "function") {
		return () => {};
	}

	let lastExecution = 0;
	let timeoutId = null;

	return function throttledFunction(...args) {
		const context = this;
		const now = Date.now();
		const remaining =
			interval - (now - lastExecution);

		if (remaining <= 0) {
			window.clearTimeout(timeoutId);

			timeoutId = null;
			lastExecution = now;

			callback.apply(
				context,
				args
			);

			return;
		}

		if (!timeoutId) {
			timeoutId = window.setTimeout(
				() => {
					lastExecution = Date.now();
					timeoutId = null;

					callback.apply(
						context,
						args
					);
				},
				remaining
			);
		}
	};
}


/* ============================================================
   6. STORAGE HELPERS
   ============================================================ */

/**
 * Read JSON data from localStorage.
 *
 * @param {string} key
 * @param {*} [fallback=null]
 * @returns {*}
 */
export function getStorage(
	key,
	fallback = null
) {
	if (
		typeof key !== "string" ||
		!key.trim()
	) {
		return fallback;
	}

	try {
		const storedValue =
			window.localStorage.getItem(key);

		if (storedValue === null) {
			return fallback;
		}

		return JSON.parse(storedValue);
	} catch (error) {
		console.warn(
			"ModeInfinity storage read failed:",
			error
		);

		return fallback;
	}
}


/**
 * Write JSON data to localStorage.
 *
 * @param {string} key
 * @param {*} value
 * @returns {boolean}
 */
export function setStorage(
	key,
	value
) {
	if (
		typeof key !== "string" ||
		!key.trim()
	) {
		return false;
	}

	try {
		window.localStorage.setItem(
			key,
			JSON.stringify(value)
		);

		return true;
	} catch (error) {
		console.warn(
			"ModeInfinity storage write failed:",
			error
		);

		return false;
	}
}


/**
 * Remove a localStorage entry.
 *
 * @param {string} key
 * @returns {boolean}
 */
export function removeStorage(key) {
	if (
		typeof key !== "string" ||
		!key.trim()
	) {
		return false;
	}

	try {
		window.localStorage.removeItem(key);

		return true;
	} catch (error) {
		console.warn(
			"ModeInfinity storage removal failed:",
			error
		);

		return false;
	}
}


/* ============================================================
   7. STRING HELPERS
   ============================================================ */

/**
 * Convert a value to a clean string.
 *
 * @param {*} value
 * @returns {string}
 */
export function toSafeString(value) {
	if (
		value === null ||
		value === undefined
	) {
		return "";
	}

	return String(value).trim();
}


/**
 * Escape text before inserting it into HTML.
 *
 * @param {*} value
 * @returns {string}
 */
export function escapeHTML(value) {
	const source = toSafeString(value);

	return source.replace(
		/[&<>"']/g,
		(character) => {
			const entities = {
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#039;"
			};

			return entities[character];
		}
	);
}


/**
 * Convert a string into a simple slug.
 *
 * @param {*} value
 * @returns {string}
 */
export function slugify(value) {
	return toSafeString(value)
		.toLowerCase()
		.normalize("NFD")
		.replace(
			/[\u0300-\u036f]/g,
			""
		)
		.replace(
			/[^a-z0-9]+/g,
			"-"
		)
		.replace(
			/^-+|-+$/g,
			""
		);
}


/* ============================================================
   8. NUMBER / CURRENCY HELPERS
   ============================================================ */

/**
 * Convert an arbitrary value to a valid number.
 *
 * @param {*} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function toNumber(
	value,
	fallback = 0
) {
	const number =
		typeof value === "number" ?
		value :
		Number(
			String(value)
			.replace(/,/g, "")
			.trim()
		);

	return Number.isFinite(number) ?
		number :
		fallback;
}


/**
 * Format a number using the Nigerian locale.
 *
 * @param {*} value
 * @param {Object} [options]
 * @returns {string}
 */
export function formatNumber(
	value,
	options = {}
) {
	const number = toNumber(value);

	const formatter =
		new Intl.NumberFormat(
			"en-NG", {
				maximumFractionDigits: 2,
				...options
			}
		);

	return formatter.format(number);
}


/**
 * Format an amount as Nigerian Naira.
 *
 * @param {*} value
 * @param {Object} [options]
 * @returns {string}
 */
export function formatNaira(
	value,
	options = {}
) {
	const number = toNumber(value);

	const formatter =
		new Intl.NumberFormat(
			"en-NG", {
				style: "currency",
				currency: "NGN",
				maximumFractionDigits: 0,
				...options
			}
		);

	return formatter.format(number);
}


/* ============================================================
   9. DATE HELPERS
   ============================================================ */

/**
 * Safely create a Date object.
 *
 * @param {*} value
 * @returns {Date|null}
 */
export function toDate(value) {
	if (
		value instanceof Date &&
		!Number.isNaN(value.getTime())
	) {
		return new Date(value.getTime());
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return date;
}


/**
 * Format a date for display.
 *
 * @param {*} value
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export function formatDate(
	value,
	options = {}
) {
	const date = toDate(value);

	if (!date) {
		return "";
	}

	return new Intl.DateTimeFormat(
		"en-NG", {
			day: "numeric",
			month: "short",
			year: "numeric",
			...options
		}
	).format(date);
}


/* ============================================================
   10. URL / PAGE HELPERS
   ============================================================ */

/**
 * Return the current page filename.
 *
 * @returns {string}
 */
export function getCurrentPage() {
	const pathname =
		window.location.pathname;

	const filename =
		pathname
		.split("/")
		.filter(Boolean)
		.pop() || "index.html";

	return filename.toLowerCase();
}


/**
 * Compare the current page with a target page.
 *
 * @param {string} targetPage
 * @returns {boolean}
 */
export function isCurrentPage(targetPage) {
	if (
		typeof targetPage !== "string" ||
		!targetPage.trim()
	) {
		return false;
	}

	const normalizedTarget =
		targetPage
		.split("/")
		.filter(Boolean)
		.pop()
		?.toLowerCase();

	const currentPage =
		getCurrentPage();

	return (
		normalizedTarget === currentPage
	);
}


/**
 * Safely navigate to a URL.
 *
 * @param {string} url
 */
export function navigateTo(url) {
	if (
		typeof url !== "string" ||
		!url.trim()
	) {
		return;
	}

	window.location.href = url;
}


/**
 * Check whether a URL is an internal destination.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isInternalURL(url) {
	if (
		typeof url !== "string" ||
		!url.trim()
	) {
		return false;
	}

	try {
		const parsedURL =
			new URL(
				url,
				window.location.href
			);

		return (
			parsedURL.origin ===
			window.location.origin
		);
	} catch {
		return false;
	}
}


/* ============================================================
   11. FOCUS HELPERS
   ============================================================ */

/**
 * Move focus to an element when possible.
 *
 * @param {HTMLElement|null} element
 * @param {FocusOptions} [options]
 */
export function focusElement(
	element,
	options = {}
) {
	if (
		!(element instanceof HTMLElement) ||
		typeof element.focus !== "function"
	) {
		return;
	}

	element.focus(options);
}


/**
 * Return whether the document currently contains
 * an actively focused element.
 *
 * @returns {boolean}
 */
export function hasActiveFocus() {
	return (
		document.activeElement &&
		document.activeElement !== document.body
	);
}


/**
 * Get naturally focusable elements inside a container.
 *
 * @param {Element|null} container
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(
	container
) {
	if (!isElement(container)) {
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
		"[contenteditable='true']",
		"[tabindex]:not([tabindex='-1'])"
	].join(",");

	return Array.from(
		container.querySelectorAll(
			selector
		)
	).filter(
		(element) =>
		element instanceof HTMLElement &&
		!element.hidden &&
		element.getAttribute(
			"aria-hidden"
		) !== "true"
	);
}


/* ============================================================
   12. MOTION / VIEWPORT HELPERS
   ============================================================ */

/**
 * Detect whether the user prefers reduced motion.
 *
 * @returns {boolean}
 */
export function prefersReducedMotion() {
	return window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;
}


/**
 * Detect whether the device likely uses coarse pointer input.
 *
 * @returns {boolean}
 */
export function hasCoarsePointer() {
	return window.matchMedia(
		"(pointer: coarse)"
	).matches;
}


/**
 * Return the current viewport dimensions.
 *
 * @returns {{width: number, height: number}}
 */
export function getViewportSize() {
	return {
		width: window.innerWidth,
		height: window.innerHeight
	};
}


/**
 * Check whether the viewport is currently small-screen.
 *
 * @param {number} [breakpoint=767]
 * @returns {boolean}
 */
export function isSmallScreen(
	breakpoint = 767
) {
	return (
		window.innerWidth <= breakpoint
	);
}


/* ============================================================
   13. IMAGE HELPERS
   ============================================================ */

/**
 * Return an image source set object for an asset.
 *
 * The fallback must point to the actual PNG, JPG or JPEG file
 * supplied for that image.
 *
 * @param {Object} sources
 * @param {string} [sources.avif]
 * @param {string} [sources.webp]
 * @param {string} sources.fallback
 * @param {string} [sources.fallbackType]
 * @returns {Object}
 */
export function createImageSources({
	avif = "",
	webp = "",
	fallback = "",
	fallbackType = ""
}) {
	return {
		avif: toSafeString(avif),
		webp: toSafeString(webp),
		fallback: toSafeString(fallback),
		fallbackType: toSafeString(
			fallbackType
		)
	};
}


/**
 * Apply responsive image sources to a picture element.
 *
 * @param {HTMLPictureElement|null} picture
 * @param {Object} sources
 * @returns {HTMLImageElement|null}
 */
export function setPictureSources(
	picture,
	sources
) {
	if (
		!(picture instanceof HTMLPictureElement) ||
		!sources
	) {
		return null;
	}

	const avifSource =
		picture.querySelector(
			"source[type='image/avif']"
		);

	const webpSource =
		picture.querySelector(
			"source[type='image/webp']"
		);

	const image =
		picture.querySelector("img");

	if (!image) {
		return null;
	}

	if (avifSource) {
		if (sources.avif) {
			avifSource.srcset =
				sources.avif;
		} else {
			avifSource.removeAttribute(
				"srcset"
			);
		}
	}

	if (webpSource) {
		if (sources.webp) {
			webpSource.srcset =
				sources.webp;
		} else {
			webpSource.removeAttribute(
				"srcset"
			);
		}
	}

	if (sources.fallback) {
		image.src =
			sources.fallback;
	}

	if (sources.fallbackType) {
		image.dataset.fallbackType =
			sources.fallbackType;
	}

	return image;
}


/* ============================================================
   14. CSS CUSTOM PROPERTY HELPERS
   ============================================================ */

/**
 * Read a CSS custom property from the document root.
 *
 * @param {string} propertyName
 * @returns {string}
 */
export function getCSSVariable(
	propertyName
) {
	if (
		typeof propertyName !== "string" ||
		!propertyName.trim()
	) {
		return "";
	}

	return getComputedStyle(
			document.documentElement
		)
		.getPropertyValue(
			propertyName
		)
		.trim();
}


/**
 * Set a CSS custom property on the document root.
 *
 * @param {string} propertyName
 * @param {string} value
 */
export function setCSSVariable(
	propertyName,
	value
) {
	if (
		typeof propertyName !== "string" ||
		!propertyName.trim()
	) {
		return;
	}

	document.documentElement.style.setProperty(
		propertyName,
		String(value)
	);
}


/* ============================================================
   15. ID GENERATION
   ============================================================ */

/**
 * Generate a simple unique client-side ID.
 *
 * @param {string} [prefix="modeinfinity"]
 * @returns {string}
 */
export function createUniqueId(
	prefix = "modeinfinity"
) {
	const safePrefix =
		slugify(prefix) || "modeinfinity";

	return `${safePrefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}`;
}


/* ============================================================
   16. SAFE JSON PARSING
   ============================================================ */

/**
 * Parse JSON safely.
 *
 * @param {string} value
 * @param {*} [fallback=null]
 * @returns {*}
 */
export function parseJSON(
	value,
	fallback = null
) {
	if (
		typeof value !== "string" ||
		!value.trim()
	) {
		return fallback;
	}

	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}


/* ============================================================
   17. DOM CONTENT READY
   ============================================================ */

/**
 * Run a callback when the DOM is ready.
 *
 * @param {Function} callback
 */
export function onDOMReady(callback) {
	if (typeof callback !== "function") {
		return;
	}

	if (
		document.readyState ===
		"loading"
	) {
		document.addEventListener(
			"DOMContentLoaded",
			callback, {
				once: true
			}
		);

		return;
	}

	callback();
}


/* ============================================================
   18. EXPORT DEFAULT
   ============================================================ */

export default {
	$,
	$$,
	isElement,

	addClass,
	removeClass,
	toggleClass,
	hasClass,

	showElement,
	hideElement,
	setElementVisibility,
	setExpanded,
	setAriaHidden,

	on,
	off,
	delegate,

	debounce,
	throttle,

	getStorage,
	setStorage,
	removeStorage,

	toSafeString,
	escapeHTML,
	slugify,

	toNumber,
	formatNumber,
	formatNaira,

	toDate,
	formatDate,

	getCurrentPage,
	isCurrentPage,
	navigateTo,
	isInternalURL,

	focusElement,
	hasActiveFocus,
	getFocusableElements,

	prefersReducedMotion,
	hasCoarsePointer,
	getViewportSize,
	isSmallScreen,

	createImageSources,
	setPictureSources,

	getCSSVariable,
	setCSSVariable,

	createUniqueId,
	parseJSON,

	onDOMReady
};
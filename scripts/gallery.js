/* ============================================================
   MODEINFINITY — GALLERY & LIGHTBOX CONTROLLER
   ============================================================

   Controls:
   - Gallery item discovery
   - Lightbox open / close
   - Previous / next image navigation
   - Keyboard navigation
   - Escape-to-close
   - Backdrop closing
   - Focus management
   - Focus restoration
   - Dynamic AVIF / WebP / PNG / JPEG sources
   - Dynamic image titles and descriptions
   - Gallery counters
   - Screen-reader status announcements
   - Reduced-motion support
   - Graceful fallback

   HTML:
   - components/lightbox.html

   CSS:
   - styles/components.css
   - styles/animations.css
   - styles/responsive.css

   Dependencies:
   - scripts/helpers.js

   Gallery item contract:
   Each gallery trigger can provide:

   data-gallery
       Gallery name / group.

   data-gallery-title
       Image title.

   data-gallery-description
       Image description.

   data-image-avif
       AVIF source.

   data-image-webp
       WebP source.

   data-image-fallback
       PNG / JPG / JPEG fallback.

   data-image-width
       Intrinsic image width.

   data-image-height
       Intrinsic image height.

   data-image-alt
       Lightbox image alternative text.

   Example trigger:

   <button
       class="gallery-item"
       type="button"
       data-gallery="showcase"
       data-gallery-title="Handcrafted Oxford"
       data-gallery-description="..."
       data-image-avif="assets/images/shoes/shoe-gallery1.avif"
       data-image-webp="assets/images/shoes/shoe-gallery1.webp"
       data-image-fallback="assets/images/shoes/shoe-gallery1.jpg"
       data-image-width="1600"
       data-image-height="1200"
       data-image-alt="Handcrafted Oxford shoe"
   >
       ...
   </button>

   Principles:
   - No external dependency
   - No emoji-dependent UI
   - No inline event-handler attributes
   - Keyboard accessible
   - Progressive enhancement
   ============================================================ */


/* ============================================================
   1. IMPORTS
   ============================================================ */

import {
	$,
	$$,
	addClass,
	removeClass,
	setAriaHidden,
	focusElement,
	getFocusableElements,
	on,
	prefersReducedMotion,
	createImageSources,
	setPictureSources,
	onDOMReady
} from "./helpers.js";


/* ============================================================
   2. SELECTORS
   ============================================================ */

const SELECTORS = Object.freeze({
	galleryItems: "[data-gallery]",

	lightbox: "#lightbox",

	lightboxDialog: ".lightbox__dialog",

	backdrop: "#lightbox-backdrop",

	close: "#lightbox-close",

	previous: "#lightbox-previous",

	next: "#lightbox-next",

	picture: "#lightbox-picture",

	sourceAVIF: "#lightbox-source-avif",

	sourceWebP: "#lightbox-source-webp",

	image: "#lightbox-image",

	counter: "#lightbox-counter",

	title: "#lightbox-title",

	imageTitle: "#lightbox-image-title",

	description: "#lightbox-description",

	status: "#lightbox-status"
});


/* ============================================================
   3. STATE
   ============================================================ */

const state = {
	initialized: false,

	isOpen: false,

	activeGallery: null,

	activeIndex: -1,

	galleryItems: [],

	previouslyFocusedElement: null,

	previousBodyOverflow: "",

	keydownBound: false
};


/* ============================================================
   4. DOM REFERENCES
   ============================================================ */

let elements = {
	lightbox: null,
	lightboxDialog: null,
	backdrop: null,
	close: null,
	previous: null,
	next: null,
	picture: null,
	sourceAVIF: null,
	sourceWebP: null,
	image: null,
	counter: null,
	title: null,
	imageTitle: null,
	description: null,
	status: null
};


/* ============================================================
   5. DOM INITIALIZATION
   ============================================================ */

/**
 * Cache lightbox DOM elements.
 */
function cacheElements() {
	elements.lightbox =
		$(SELECTORS.lightbox);

	elements.lightboxDialog =
		$(SELECTORS.lightboxDialog);

	elements.backdrop =
		$(SELECTORS.backdrop);

	elements.close =
		$(SELECTORS.close);

	elements.previous =
		$(SELECTORS.previous);

	elements.next =
		$(SELECTORS.next);

	elements.picture =
		$(SELECTORS.picture);

	elements.sourceAVIF =
		$(SELECTORS.sourceAVIF);

	elements.sourceWebP =
		$(SELECTORS.sourceWebP);

	elements.image =
		$(SELECTORS.image);

	elements.counter =
		$(SELECTORS.counter);

	elements.title =
		$(SELECTORS.title);

	elements.imageTitle =
		$(SELECTORS.imageTitle);

	elements.description =
		$(SELECTORS.description);

	elements.status =
		$(SELECTORS.status);
}


/* ============================================================
   6. GALLERY DISCOVERY
   ============================================================ */

/**
 * Collect all gallery items currently present in the document.
 *
 * @returns {HTMLElement[]}
 */
function collectGalleryItems() {
	return $$(SELECTORS.galleryItems)
		.filter(
			(element) =>
			element instanceof HTMLElement
		);
}


/**
 * Get a gallery name from an item.
 *
 * @param {HTMLElement} item
 * @returns {string}
 */
function getGalleryName(item) {
	if (!(item instanceof HTMLElement)) {
		return "default";
	}

	return (
		item.dataset.gallery ||
		"default"
	);
}


/**
 * Return all items belonging to a gallery.
 *
 * @param {string} galleryName
 * @returns {HTMLElement[]}
 */
function getGalleryItems(galleryName) {
	if (
		typeof galleryName !== "string" ||
		!galleryName
	) {
		return [];
	}

	return state.galleryItems.filter(
		(item) =>
		getGalleryName(item) ===
		galleryName
	);
}


/* ============================================================
   7. DATA EXTRACTION
   ============================================================ */

/**
 * Return image metadata from a gallery trigger.
 *
 * @param {HTMLElement} item
 * @returns {Object}
 */
function getImageData(item) {
	if (!(item instanceof HTMLElement)) {
		return {
			title: "",
			description: "",
			alt: "",
			width: "",
			height: "",
			sources: createImageSources({
				fallback: ""
			})
		};
	}

	const title =
		item.dataset.galleryTitle ||
		item.getAttribute(
			"aria-label"
		) ||
		"";

	const description =
		item.dataset.galleryDescription ||
		"";

	const alt =
		item.dataset.imageAlt ||
		item.querySelector("img")?.alt ||
		title ||
		"Gallery image";

	const width =
		Number(
			item.dataset.imageWidth
		);

	const height =
		Number(
			item.dataset.imageHeight
		);

	const sourceData =
		createImageSources({
			avif: item.dataset.imageAvif ||
				"",
			webp: item.dataset.imageWebp ||
				"",
			fallback: item.dataset.imageFallback ||
				getImageFallbackFromTrigger(
					item
				)
		});

	return {
		title,
		description,
		alt,
		width: Number.isFinite(width) &&
			width > 0 ?
			width :
			"",
		height: Number.isFinite(height) &&
			height > 0 ?
			height :
			"",
		sources: sourceData
	};
}


/**
 * Attempt to identify an image fallback from the trigger's
 * existing <img> element.
 *
 * This does not modify the original gallery image.
 *
 * @param {HTMLElement} item
 * @returns {string}
 */
function getImageFallbackFromTrigger(item) {
	const image =
		item.querySelector("img");

	if (!image) {
		return "";
	}

	return (
		image.currentSrc ||
		image.src ||
		""
	);
}


/* ============================================================
   8. PICTURE SOURCE MANAGEMENT
   ============================================================ */

/**
 * Apply image sources to the lightbox picture.
 *
 * @param {Object} imageData
 */
function applyImageSources(imageData) {
	if (
		!elements.picture ||
		!elements.image
	) {
		return;
	}

	setPictureSources(
		elements.picture,
		imageData.sources
	);

	if (imageData.alt) {
		elements.image.alt =
			imageData.alt;
	} else {
		elements.image.alt =
			"Gallery image";
	}

	if (imageData.width) {
		elements.image.width =
			imageData.width;
	}

	if (imageData.height) {
		elements.image.height =
			imageData.height;
	}
}


/* ============================================================
   9. IMAGE PRELOADING
   ============================================================ */

/**
 * Preload the next image when possible.
 *
 * This uses a lightweight Image object and does not alter
 * the currently displayed image.
 *
 * @param {HTMLElement|null} item
 */
function preloadGalleryImage(item) {
	if (!(item instanceof HTMLElement)) {
		return;
	}

	const imageData =
		getImageData(item);

	const preloadURL =
		imageData.sources.fallback ||
		imageData.sources.webp ||
		imageData.sources.avif;

	if (!preloadURL) {
		return;
	}

	const preloadImage =
		new Image();

	preloadImage.decoding =
		"async";

	preloadImage.src =
		preloadURL;
}


/* ============================================================
   10. LIGHTBOX CONTENT
   ============================================================ */

/**
 * Update the visible lightbox content.
 *
 * @param {HTMLElement} item
 * @param {number} index
 * @param {number} total
 */
function updateLightboxContent(
	item,
	index,
	total
) {
	if (
		!(item instanceof HTMLElement)
	) {
		return;
	}

	const imageData =
		getImageData(item);

	applyImageSources(
		imageData
	);

	if (elements.imageTitle) {
		elements.imageTitle.textContent =
			imageData.title;
	}

	if (elements.description) {
		elements.description.textContent =
			imageData.description;

		/*
		 * Hide an empty description from visual layout while
		 * preserving the surrounding component structure.
		 */
		elements.description.hidden = !imageData.description;
	}

	if (elements.counter) {
		elements.counter.textContent =
			`Image ${index + 1} of ${total}`;
	}

	if (elements.title) {
		elements.title.textContent =
			imageData.title ||
			"Image Viewer";
	}

	if (elements.status) {
		const statusText =
			imageData.title ?
			`Viewing ${imageData.title}, image ${index + 1} of ${total}.` :
			`Viewing image ${index + 1} of ${total}.`;

		elements.status.textContent =
			statusText;
	}

	updateNavigationControls(
		index,
		total
	);
}


/* ============================================================
   11. NAVIGATION CONTROLS
   ============================================================ */

/**
 * Update previous / next button availability.
 *
 * @param {number} index
 * @param {number} total
 */
function updateNavigationControls(
	index,
	total
) {
	const hasMultipleImages =
		total > 1;

	if (elements.previous) {
		elements.previous.disabled = !hasMultipleImages;
	}

	if (elements.next) {
		elements.next.disabled = !hasMultipleImages;
	}

	if (
		hasMultipleImages &&
		total > 0
	) {
		const previousIndex =
			index <= 0 ?
			total - 1 :
			index - 1;

		const nextIndex =
			index >= total - 1 ?
			0 :
			index + 1;

		preloadGalleryImage(
			state.galleryItems[
				previousIndex
			]
		);

		preloadGalleryImage(
			state.galleryItems[
				nextIndex
			]
		);
	}
}


/* ============================================================
   12. BODY SCROLL LOCK
   ============================================================ */

/**
 * Lock document scrolling while the lightbox is open.
 */
function lockBodyScroll() {
	state.previousBodyOverflow =
		document.body.style.overflow;

	document.body.style.overflow =
		"hidden";
}


/**
 * Restore document scrolling.
 */
function unlockBodyScroll() {
	document.body.style.overflow =
		state.previousBodyOverflow;

	state.previousBodyOverflow =
		"";
}


/* ============================================================
   13. ARIA STATE
   ============================================================ */

/**
 * Update lightbox accessibility state.
 *
 * @param {boolean} open
 */
function updateAriaState(open) {
	if (!elements.lightbox) {
		return;
	}

	setAriaHidden(
		elements.lightbox,
		!open
	);
}


/* ============================================================
   14. FOCUS MANAGEMENT
   ============================================================ */

/**
 * Focus the first sensible control inside the lightbox.
 */
function focusLightbox() {
	if (
		elements.close &&
		!elements.close.disabled
	) {
		focusElement(
			elements.close
		);

		return;
	}

	if (elements.lightboxDialog) {
		const focusable =
			getFocusableElements(
				elements.lightboxDialog
			);

		if (focusable.length) {
			focusElement(
				focusable[0]
			);

			return;
		}

		focusElement(
			elements.lightboxDialog
		);
	}
}


/**
 * Restore focus to the element that opened the lightbox.
 */
function restoreFocus() {
	if (
		state.previouslyFocusedElement &&
		document.contains(
			state.previouslyFocusedElement
		)
	) {
		focusElement(
			state.previouslyFocusedElement
		);
	}

	state.previouslyFocusedElement =
		null;
}


/* ============================================================
   15. LIGHTBOX FOCUS TRAP
   ============================================================ */

/**
 * Keep keyboard focus inside the lightbox.
 *
 * @param {KeyboardEvent} event
 */
function handleFocusTrap(event) {
	if (
		!state.isOpen ||
		event.key !== "Tab" ||
		!elements.lightboxDialog
	) {
		return;
	}

	const focusable =
		getFocusableElements(
			elements.lightboxDialog
		);

	if (!focusable.length) {
		event.preventDefault();

		focusElement(
			elements.lightboxDialog
		);

		return;
	}

	const first =
		focusable[0];

	const last =
		focusable[
			focusable.length - 1
		];

	if (event.shiftKey) {
		if (
			document.activeElement ===
			first
		) {
			event.preventDefault();

			focusElement(
				last
			);
		}

		return;
	}

	if (
		document.activeElement ===
		last
	) {
		event.preventDefault();

		focusElement(
			first
		);
	}
}


/* ============================================================
   16. OPEN LIGHTBOX
   ============================================================ */

/**
 * Open a specific gallery item.
 *
 * @param {HTMLElement} item
 */
export function openLightbox(item) {
	if (
		!(item instanceof HTMLElement) ||
		!elements.lightbox ||
		!elements.lightboxDialog
	) {
		return;
	}

	const galleryName =
		getGalleryName(item);

	const gallery =
		getGalleryItems(
			galleryName
		);

	if (!gallery.length) {
		return;
	}

	const index =
		gallery.indexOf(item);

	if (index < 0) {
		return;
	}

	state.galleryItems =
		gallery;

	state.activeGallery =
		galleryName;

	state.activeIndex =
		index;

	state.previouslyFocusedElement =
		document.activeElement instanceof HTMLElement ?
		document.activeElement :
		item;

	state.isOpen = true;

	updateLightboxContent(
		gallery[index],
		index,
		gallery.length
	);

	addClass(
		elements.lightbox,
		"is-open"
	);

	updateAriaState(true);

	lockBodyScroll();

	/*
	 * Move focus after the open state has been painted.
	 */
	window.requestAnimationFrame(
		() => {
			focusLightbox();
		}
	);
}


/* ============================================================
   17. CLOSE LIGHTBOX
   ============================================================ */

/**
 * Close the currently open lightbox.
 *
 * @param {Event|null} event
 */
export function closeLightbox(event = null) {
	if (event) {
		event.preventDefault();
	}

	if (
		!state.isOpen ||
		!elements.lightbox
	) {
		return;
	}

	state.isOpen = false;

	removeClass(
		elements.lightbox,
		"is-open"
	);

	updateAriaState(false);

	unlockBodyScroll();

	state.activeGallery = null;
	state.activeIndex = -1;
	state.galleryItems = [];

	restoreFocus();
}


/* ============================================================
   18. NAVIGATE TO INDEX
   ============================================================ */

/**
 * Display a gallery item by index.
 *
 * @param {number} index
 */
function showGalleryIndex(index) {
	if (
		!state.isOpen ||
		!state.galleryItems.length
	) {
		return;
	}

	const total =
		state.galleryItems.length;

	let normalizedIndex =
		index;

	if (normalizedIndex < 0) {
		normalizedIndex =
			total - 1;
	}

	if (normalizedIndex >= total) {
		normalizedIndex = 0;
	}

	state.activeIndex =
		normalizedIndex;

	updateLightboxContent(
		state.galleryItems[
			normalizedIndex
		],
		normalizedIndex,
		total
	);

	/*
	 * Keep keyboard focus in the lightbox without stealing
	 * focus unnecessarily after every image change.
	 */
	if (
		document.activeElement &&
		!elements.lightboxDialog.contains(
			document.activeElement
		)
	) {
		focusLightbox();
	}
}


/* ============================================================
   19. PREVIOUS / NEXT
   ============================================================ */

/**
 * Show the previous image.
 *
 * @param {Event|null} event
 */
export function showPrevious(event = null) {
	if (event) {
		event.preventDefault();
	}

	if (!state.isOpen) {
		return;
	}

	showGalleryIndex(
		state.activeIndex - 1
	);
}


/**
 * Show the next image.
 *
 * @param {Event|null} event
 */
export function showNext(event = null) {
	if (event) {
		event.preventDefault();
	}

	if (!state.isOpen) {
		return;
	}

	showGalleryIndex(
		state.activeIndex + 1
	);
}


/* ============================================================
   20. KEYBOARD CONTROLS
   ============================================================ */

/**
 * Handle lightbox keyboard commands.
 *
 * Supported:
 * - Escape → close
 * - ArrowLeft → previous
 * - ArrowRight → next
 *
 * @param {KeyboardEvent} event
 */
function handleKeyboard(event) {
	if (!state.isOpen) {
		return;
	}

	switch (event.key) {
		case "Escape":
			event.preventDefault();

			closeLightbox();

			break;

		case "ArrowLeft":
			event.preventDefault();

			showPrevious();

			break;

		case "ArrowRight":
			event.preventDefault();

			showNext();

			break;

		default:
			break;
	}
}


/* ============================================================
   21. GALLERY TRIGGERS
   ============================================================ */

/**
 * Handle activation of a gallery trigger.
 *
 * @param {Event} event
 */
function handleGalleryTrigger(event) {
	const trigger =
		event.currentTarget;

	if (
		!(trigger instanceof HTMLElement)
	) {
		return;
	}

	event.preventDefault();

	openLightbox(trigger);
}


/**
 * Bind gallery trigger events.
 */
function bindGalleryTriggers() {
	state.galleryItems =
		collectGalleryItems();

	state.galleryItems.forEach(
		(item) => {
			on(
				item,
				"click",
				handleGalleryTrigger
			);

			/*
			 * Allow non-button elements to become keyboard
			 * accessible gallery triggers.
			 */
			const naturallyFocusable =
				item instanceof HTMLButtonElement ||
				item instanceof HTMLAnchorElement ||
				item.hasAttribute(
					"tabindex"
				);

			if (!naturallyFocusable) {
				item.setAttribute(
					"tabindex",
					"0"
				);

				item.setAttribute(
					"role",
					"button"
				);
			}

			on(
				item,
				"keydown",
				(event) => {
					if (
						event.key !== "Enter" &&
						event.key !== " "
					) {
						return;
					}

					event.preventDefault();

					openLightbox(item);
				}
			);
		}
	);
}


/* ============================================================
   22. LIGHTBOX CONTROLS
   ============================================================ */

/**
 * Bind lightbox control events.
 */
function bindLightboxControls() {
	if (elements.close) {
		on(
			elements.close,
			"click",
			closeLightbox
		);
	}

	if (elements.backdrop) {
		on(
			elements.backdrop,
			"click",
			closeLightbox
		);
	}

	if (elements.previous) {
		on(
			elements.previous,
			"click",
			showPrevious
		);
	}

	if (elements.next) {
		on(
			elements.next,
			"click",
			showNext
		);
	}

	if (elements.lightboxDialog) {
		on(
			elements.lightboxDialog,
			"keydown",
			handleFocusTrap
		);
	}

	if (!state.keydownBound) {
		on(
			document,
			"keydown",
			handleKeyboard
		);

		state.keydownBound = true;
	}
}


/* ============================================================
   23. IMAGE ERROR HANDLING
   ============================================================ */

/**
 * Handle a failed lightbox image.
 *
 * This prevents a broken-image experience if a supplied path
 * cannot be loaded.
 */
function handleImageError() {
	if (!elements.image) {
		return;
	}

	/*
	 * Do not repeatedly trigger the same failed source.
	 * Clear source elements so the fallback can be retried
	 * deterministically.
	 */
	if (elements.sourceAVIF) {
		elements.sourceAVIF.removeAttribute(
			"srcset"
		);
	}

	if (elements.sourceWebP) {
		elements.sourceWebP.removeAttribute(
			"srcset"
		);
	}
}


/* ============================================================
   24. INITIALIZATION
   ============================================================ */

/**
 * Initialize gallery and lightbox functionality.
 */
export function initGallery() {
	if (state.initialized) {
		return;
	}

	cacheElements();

	/*
	 * Gallery triggers can exist on a page without the global
	 * lightbox, but they cannot open one until the component
	 * exists.
	 */
	state.galleryItems =
		collectGalleryItems();

	if (!state.galleryItems.length) {
		state.initialized = true;

		return;
	}

	if (
		!elements.lightbox ||
		!elements.lightboxDialog
	) {
		state.initialized = true;

		return;
	}

	updateAriaState(false);

	bindGalleryTriggers();

	bindLightboxControls();

	if (elements.image) {
		on(
			elements.image,
			"error",
			handleImageError
		);
	}

	state.initialized = true;
}


/* ============================================================
   25. CLEANUP
   ============================================================ */

/**
 * Destroy gallery listeners/state.
 *
 * Primarily useful for development or dynamically replaced
 * page content.
 */
export function destroyGallery() {
	if (elements.lightbox) {
		removeClass(
			elements.lightbox,
			"is-open"
		);
	}

	unlockBodyScroll();

	state.isOpen = false;
	state.activeGallery = null;
	state.activeIndex = -1;
	state.galleryItems = [];
	state.previouslyFocusedElement = null;
	state.initialized = false;
}


/* ============================================================
   26. PUBLIC API
   ============================================================ */

export const gallery =
	Object.freeze({
		init: initGallery,

		destroy: destroyGallery,

		open: openLightbox,

		close: closeLightbox,

		previous: showPrevious,

		next: showNext,

		get isOpen() {
			return state.isOpen;
		},

		get activeGallery() {
			return state.activeGallery;
		},

		get activeIndex() {
			return state.activeIndex;
		},

		get reducedMotion() {
			return prefersReducedMotion();
		}
	});


export default gallery;


/* ============================================================
   27. AUTOMATIC INITIALIZATION
   ============================================================ */

// onDOMReady(
// 	initGallery
// );
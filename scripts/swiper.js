import {
	$$,
	addClass,
	removeClass,
	prefersReducedMotion,
	onDOMReady
} from "./helpers.js";
/* ============================================================
   MODEINFINITY SWIPER / CAROUSEL SYSTEM
   ============================================================ */
const CONFIG = Object.freeze({
	/* Generic carousel */
	selector: "[data-carousel]",
	/* ModeInfinity Craft carousel */
	craftSelector: "[data-craft-carousel]",
	/* Autoplay */
	defaultInterval: 5000,
	/* Touch / pointer swipe */
	minimumSwipeDistance: 40,
	maximumSwipeTime: 700,
	swipeDirectionRatio: 1.15
});
/* ============================================================
   STATE
   ============================================================ */
const carouselState = new WeakMap();
/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */
function clamp(value, minimum, maximum) {
	return Math.min(Math.max(value, minimum), maximum);
}

function positiveNumber(value, fallback) {
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : fallback;
}

function parseBoolean(value, fallback = false) {
	if (value === undefined || value === null || value === "") {
		return fallback;
	}
	return String(value).trim().toLowerCase() === "true";
}
/* ============================================================
   DISCOVERY
   ============================================================ */
function findCarousels(root = document) {
	if (!root || typeof root.querySelectorAll !== "function") {
		return [];
	}
	return Array.from(root.querySelectorAll(CONFIG.selector)).filter(
		(element) => element instanceof HTMLElement);
}

function findCraftCarousels(root = document) {
	if (!root || typeof root.querySelectorAll !== "function") {
		return [];
	}
	return Array.from(root.querySelectorAll(CONFIG.craftSelector)).filter(
		(element) => element instanceof HTMLElement);
}
/* ============================================================
   GENERIC CAROUSEL ELEMENTS
   ============================================================ */
function getCarouselElements(carousel) {
	const viewport = carousel.querySelector(".carousel__viewport");
	const track = carousel.querySelector(".carousel__track");
	const previous = carousel.querySelector("[data-carousel-previous]");
	const next = carousel.querySelector("[data-carousel-next]");
	const pagination = carousel.querySelector("[data-carousel-pagination]");
	const slides = track ? Array.from(track.children).filter(
		(slide) => slide instanceof HTMLElement) : [];
	return {
		carousel,
		viewport,
		track,
		previous,
		next,
		pagination,
		slides
	};
}
/* ============================================================
   CRAFT CAROUSEL ELEMENTS
   ============================================================ */
function getCraftCarouselElements(carousel) {
	const slides = Array.from(carousel.querySelectorAll("[data-craft-slide]")).filter(
		(slide) => slide instanceof HTMLElement);
	const previous = carousel.querySelector("[data-craft-prev]");
	const next = carousel.querySelector("[data-craft-next]");
	const pagination = carousel.querySelector("[data-craft-pagination]");
	const paginationButtons = Array.from(carousel.querySelectorAll("[data-craft-dot]")).filter(
		(button) => button instanceof HTMLButtonElement);
	const index = carousel.querySelector("[data-craft-index]");
	return {
		carousel,
		viewport: carousel,
		track: null,
		previous,
		next,
		pagination,
		paginationButtons,
		index,
		slides
	};
}
/* ============================================================
   STATE CREATION
   ============================================================ */
function createCarouselState(carousel, type = "generic") {
	const elements = type === "craft" ? getCraftCarouselElements(carousel) : getCarouselElements(carousel);
	const state = {
		...elements,
		type,
		currentIndex: 0,
		autoplayTimer: null,
		pointerStartX: 0,
		pointerStartY: 0,
		pointerStartTime: 0,
		isPointerDown: false,
		listenersBound: false,
		loop: parseBoolean(carousel.dataset.carouselLoop, true),
		/*
		 * Generic carousels can opt into autoplay
		 * through data-carousel-autoplay="true".
		 */
		autoplay: parseBoolean(carousel.dataset.carouselAutoplay, false),
		interval: positiveNumber(carousel.dataset.carouselInterval, CONFIG.defaultInterval),
		perView: positiveNumber(carousel.dataset.carouselPerView, 1)
	};
	carouselState.set(carousel, state);
	return state;
}

function getState(carousel) {
	return carouselState.get(carousel) || null;
}
/* ============================================================
   INDEX MANAGEMENT
   ============================================================ */
function normalizeIndex(state, index) {
	const total = state.slides.length;
	if (total <= 0) {
		return 0;
	}
	if (state.loop) {
		return (
			(index % total) + total) % total;
	}
	return clamp(index, 0, total - 1);
}
/* ============================================================
   GENERIC CAROUSEL TRANSLATION
   ============================================================ */
function calculateTranslate(state, index) {
	const total = state.slides.length;
	if (total === 0 || !state.track) {
		return 0;
	}
	const slide = state.slides[0];
	const slideWidth = slide.getBoundingClientRect().width;
	const computedStyle = getComputedStyle(state.track);
	const gap = parseFloat(computedStyle.gap) || 0;
	return -(index * (slideWidth + gap));
}

function applyTranslation(state, index) {
	if (!state.track) {
		return;
	}
	const translate = calculateTranslate(state, index);
	const reduced = prefersReducedMotion();
	state.track.style.transform = `translate3d(${translate}px, 0, 0)`;
	state.track.style.transition = reduced ? "none" : "";
}
/* ============================================================
   CRAFT SLIDE STATE
   ============================================================ */
function updateCraftSlideState(state) {
	const total = state.slides.length;
	if (total <= 0) {
		return;
	}
	const previousIndex = normalizeIndex(state, state.currentIndex - 1);
	const nextIndex = normalizeIndex(state, state.currentIndex + 1);
	state.slides.forEach(
		(slide, index) => {
			const active = index === state.currentIndex;
			slide.classList.toggle("is-active", active);
			slide.classList.remove("is-prev", "is-next");
			if (!active) {
				if (index === previousIndex && index !== nextIndex) {
					slide.classList.add("is-prev");
				}
				if (index === nextIndex && index !== previousIndex) {
					slide.classList.add("is-next");
				}
			}
			slide.setAttribute("aria-hidden", active ? "false" : "true");
			if (active) {
				slide.removeAttribute("inert");
			} else {
				slide.setAttribute("inert", "");
			}
			slide.setAttribute("data-slide-index", String(index));
		});
}
/* ============================================================
   GENERIC SLIDE STATE
   ============================================================ */
function updateSlideState(state) {
	state.slides.forEach(
		(slide, index) => {
			const active = index === state.currentIndex;
			slide.classList.toggle("is-active", active);
			slide.setAttribute("aria-hidden", active ? "false" : "true");
			slide.setAttribute("data-slide-index", String(index));
		});
}
/* ============================================================
   CRAFT PAGINATION
   ============================================================ */
function getCraftStageName(index) {
	const names = ["Material", "Construction", "Finishing", "Identity"];
	return (names[index] || `Stage ${index + 1}`);
}

function updateCraftPagination(state) {
	if (!state.paginationButtons || !state.paginationButtons.length) {
		return;
	}
	state.paginationButtons.forEach(
		(button, index) => {
			const active = index === state.currentIndex;
			button.classList.toggle("is-active", active);
			button.setAttribute("aria-selected", active ? "true" : "false");
			button.setAttribute("tabindex", active ? "0" : "-1");
			button.setAttribute("aria-label", `Show ${getCraftStageName(index)} stage`);
		});
}
/* ============================================================
   CRAFT INDEX
   ============================================================ */
function updateCraftIndex(state) {
	if (!state.index) {
		return;
	}
	const current = String(state.currentIndex + 1).padStart(2, "0");
	const total = String(state.slides.length).padStart(2, "0");
	state.index.textContent = `${current} / ${total}`;
}
/* ============================================================
   GENERIC PAGINATION
   ============================================================ */
function createPagination(state) {
	if (!state.pagination) {
		return;
	}
	state.pagination.innerHTML = "";
	state.slides.forEach(
		(slide, index) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "carousel__pagination-button";
			button.dataset.carouselIndex = String(index);
			button.setAttribute("aria-label", `Go to slide ${index + 1}`);
			button.setAttribute("aria-selected", index === state.currentIndex ? "true" : "false");
			button.setAttribute("role", "tab");
			state.pagination.appendChild(button);
		});
	state.pagination.setAttribute("role", "tablist");
	updatePagination(state);
}

function updatePagination(state) {
	if (!state.pagination) {
		return;
	}
	const buttons = state.pagination.querySelectorAll("[data-carousel-index]");
	buttons.forEach(
		(button, index) => {
			const active = index === state.currentIndex;
			button.classList.toggle("is-active", active);
			button.setAttribute("aria-selected", active ? "true" : "false");
		});
}
/* ============================================================
   CONTROLS
   ============================================================ */
function updateControls(state) {
	const total = state.slides.length;
	if (state.previous) {
		state.previous.disabled = !state.loop && state.currentIndex <= 0;
		state.previous.setAttribute("aria-label", state.type === "craft" ? "Previous craft stage" : "Previous slide");
	}
	if (state.next) {
		state.next.disabled = !state.loop && state.currentIndex >= total - 1;
		state.next.setAttribute("aria-label", state.type === "craft" ? "Next craft stage" : "Next slide");
	}
}
/* ============================================================
   SCREEN READER ANNOUNCEMENT
   ============================================================ */
function announceActiveSlide(state) {
	const status = state.carousel.querySelector("[data-carousel-status]");
	if (!status) {
		return;
	}
	const total = state.slides.length;
	status.textContent = `Slide ${state.currentIndex + 1} of ${total}.`;
}
/* ============================================================
   AUTOPLAY
   ============================================================ */
function stopAutoplay(state) {
	if (state.autoplayTimer !== null) {
		window.clearInterval(state.autoplayTimer);
		state.autoplayTimer = null;
	}
}

function startAutoplay(state) {
	stopAutoplay(state);
	/*
	 * Never autoplay when the user has
	 * requested reduced motion.
	 */
	if (prefersReducedMotion()) {
		return;
	}
	if (!state.autoplay || state.slides.length <= 1) {
		return;
	}
	state.autoplayTimer = window.setInterval(
		() => {
			nextSlide(state.carousel);
		}, state.interval);
}

function resetAutoplay(state) {
	if (!state.autoplay) {
		return;
	}
	startAutoplay(state);
}
/* ============================================================
   POINTER / TOUCH SWIPE
   ============================================================ */
function pointerStart(state, event) {
	if (!state.viewport) {
		return;
	}
	state.pointerStartX = event.clientX;
	state.pointerStartY = event.clientY;
	state.pointerStartTime = Date.now();
	state.isPointerDown = true;
}

function pointerEnd(state, event) {
	if (!state.isPointerDown) {
		return;
	}
	state.isPointerDown = false;
	const deltaX = event.clientX - state.pointerStartX;
	const deltaY = event.clientY - state.pointerStartY;
	const elapsed = Date.now() - state.pointerStartTime;
	if (elapsed > CONFIG.maximumSwipeTime) {
		return;
	}
	/*
	 * Ignore predominantly vertical
	 * gestures so normal page scrolling
	 * continues to work.
	 */
	if (Math.abs(deltaY) > Math.abs(deltaX) / CONFIG.swipeDirectionRatio) {
		return;
	}
	if (Math.abs(deltaX) < CONFIG.minimumSwipeDistance) {
		return;
	}
	if (deltaX < 0) {
		nextSlide(state.carousel);
	} else {
		previousSlide(state.carousel);
	}
}
/* ============================================================
   KEYBOARD NAVIGATION
   ============================================================ */
function handleKeyboard(state, event) {
	const activeElement = document.activeElement;
	if (!activeElement || !state.carousel.contains(activeElement)) {
		return;
	}
	switch (event.key) {
		case "ArrowLeft":
			event.preventDefault();
			previousSlide(state.carousel);
			break;
		case "ArrowRight":
			event.preventDefault();
			nextSlide(state.carousel);
			break;
		case "Home":
			event.preventDefault();
			goToSlide(state.carousel, 0);
			break;
		case "End":
			event.preventDefault();
			goToSlide(state.carousel, state.slides.length - 1);
			break;
		default:
			break;
	}
}
/* ============================================================
   AUTOPLAY INTERACTION
   ============================================================ */
function pauseOnPointerEnter(state) {
	if (!state.autoplay) {
		return;
	}
	stopAutoplay(state);
}

function resumeOnPointerLeave(state) {
	if (!state.autoplay) {
		return;
	}
	startAutoplay(state);
}
/* ============================================================
   DOCUMENT VISIBILITY
   ============================================================ */
function handleVisibilityChange(state) {
	if (document.visibilityState === "hidden") {
		stopAutoplay(state);
		return;
	}
	if (document.visibilityState === "visible") {
		startAutoplay(state);
	}
}
/* ============================================================
   RESIZE
   ============================================================ */
function handleResize(state) {
	window.requestAnimationFrame(
		() => {
			if (state.type === "generic") {
				applyTranslation(state, state.currentIndex);
			}
		});
}
/* ============================================================
   GO TO SLIDE
   ============================================================ */
export function goToSlide(carousel, index) {
	const state = getState(carousel);
	if (!state || !state.slides.length) {
		return;
	}
	const previousIndex = state.currentIndex;
	const nextIndex = normalizeIndex(state, index);
	state.currentIndex = nextIndex;
	/* --------------------------------------------------------
	   GENERIC CAROUSEL
	   -------------------------------------------------------- */
	if (state.type === "generic") {
		applyTranslation(state, state.currentIndex);
		updateSlideState(state);
		updatePagination(state);
	}
	/* --------------------------------------------------------
	   CRAFT CAROUSEL
	   -------------------------------------------------------- */
	if (state.type === "craft") {
		state.slides.forEach(
			(slide) => {
				slide.classList.remove("is-prev", "is-next", "is-transitioning");
			});
		if (previousIndex !== state.currentIndex) {
			state.slides[previousIndex]?.classList.add("is-transitioning");
			state.slides[state.currentIndex]?.classList.add("is-transitioning");
		}
		updateCraftSlideState(state);
		updateCraftPagination(state);
		updateCraftIndex(state);
	}
	updateControls(state);
	announceActiveSlide(state);
	/*
	 * Restart the autoplay timer after
	 * manual interaction.
	 */
	resetAutoplay(state);
}
/* ============================================================
   PREVIOUS
   ============================================================ */
export function previousSlide(carousel) {
	const state = getState(carousel);
	if (!state) {
		return;
	}
	goToSlide(carousel, state.currentIndex - 1);
}
/* ============================================================
   NEXT
   ============================================================ */
export function nextSlide(carousel) {
	const state = getState(carousel);
	if (!state) {
		return;
	}
	goToSlide(carousel, state.currentIndex + 1);
}
/* ============================================================
   GENERIC EVENTS
   ============================================================ */
function bindGenericEvents(state) {
	if (state.listenersBound) {
		return;
	}
	if (state.previous) {
		state.previous.addEventListener("click",
			() => {
				previousSlide(state.carousel);
			});
	}
	if (state.next) {
		state.next.addEventListener("click",
			() => {
				nextSlide(state.carousel);
			});
	}
	if (state.pagination) {
		state.pagination.addEventListener("click",
			(event) => {
				const target = event.target;
				if (!(target instanceof Element)) {
					return;
				}
				const button = target.closest("[data-carousel-index]");
				if (!button) {
					return;
				}
				const index = Number(button.dataset.carouselIndex);
				if (Number.isFinite(index)) {
					goToSlide(state.carousel, index);
				}
			});
	}
	if (state.viewport) {
		state.viewport.addEventListener("pointerdown",
			(event) => {
				pointerStart(state, event);
			}, {
				passive: true
			});
		state.viewport.addEventListener("pointerup",
			(event) => {
				pointerEnd(state, event);
			}, {
				passive: true
			});
		state.viewport.addEventListener("pointercancel",
			() => {
				state.isPointerDown = false;
			}, {
				passive: true
			});
	}
	state.carousel.addEventListener("keydown",
		(event) => {
			handleKeyboard(state, event);
		});
	state.carousel.addEventListener("pointerenter",
		() => {
			pauseOnPointerEnter(state);
		});
	state.carousel.addEventListener("pointerleave",
		() => {
			resumeOnPointerLeave(state);
		});
	document.addEventListener("visibilitychange",
		() => {
			handleVisibilityChange(state);
		});
	window.addEventListener("resize",
		() => {
			handleResize(state);
		}, {
			passive: true
		});
	state.listenersBound = true;
}
/* ============================================================
   CRAFT EVENTS
   ============================================================ */
function bindCraftEvents(state) {
	if (state.listenersBound) {
		return;
	}
	/* Previous arrow */
	if (state.previous) {
		state.previous.addEventListener("click",
			(event) => {
				event.preventDefault();
				previousSlide(state.carousel);
			});
	}
	/* Next arrow */
	if (state.next) {
		state.next.addEventListener("click",
			(event) => {
				event.preventDefault();
				nextSlide(state.carousel);
			});
	}
	/* Pagination */
	state.paginationButtons.forEach(
		(button, index) => {
			button.addEventListener("click",
				(event) => {
					event.preventDefault();
					goToSlide(state.carousel, index);
				});
		});
	/* Touch / pointer */
	state.viewport.addEventListener("pointerdown",
		(event) => {
			pointerStart(state, event);
		}, {
			passive: true
		});
	state.viewport.addEventListener("pointerup",
		(event) => {
			pointerEnd(state, event);
		}, {
			passive: true
		});
	state.viewport.addEventListener("pointercancel",
		() => {
			state.isPointerDown = false;
		}, {
			passive: true
		});
	/* Prevent image dragging */
	state.viewport.addEventListener("dragstart",
		(event) => {
			event.preventDefault();
		});
	/* Keyboard */
	state.carousel.addEventListener("keydown",
		(event) => {
			handleKeyboard(state, event);
		});
	/* Pause while pointer is over carousel */
	state.carousel.addEventListener("pointerenter",
		() => {
			pauseOnPointerEnter(state);
		});
	state.carousel.addEventListener("pointerleave",
		() => {
			resumeOnPointerLeave(state);
		});
	/* Pause when browser tab is hidden */
	document.addEventListener("visibilitychange",
		() => {
			handleVisibilityChange(state);
		});
	state.listenersBound = true;
}
/* ============================================================
   GENERIC ACCESSIBILITY
   ============================================================ */
function setupAccessibility(state) {
	state.carousel.setAttribute("role", "region");
	state.slides.forEach(
		(slide) => {
			slide.setAttribute("role", "group");
		});
	if (state.previous) {
		state.previous.setAttribute("type", "button");
	}
	if (state.next) {
		state.next.setAttribute("type", "button");
	}
}
/* ============================================================
   CRAFT ACCESSIBILITY
   ============================================================ */
function setupCraftAccessibility(state) {
	state.carousel.setAttribute("role", "region");
	state.carousel.setAttribute("aria-roledescription", "carousel");
	if (!state.carousel.getAttribute("aria-label")) {
		state.carousel.setAttribute("aria-label", "ModeInfinity craftsmanship process");
	}
	state.slides.forEach(
		(slide, index) => {
			slide.setAttribute("role", "group");
			slide.setAttribute("aria-roledescription", "slide");
			slide.setAttribute("aria-label", `${index + 1} of ${state.slides.length}: ${getCraftStageName(index)}`);
		});
	if (state.previous) {
		state.previous.setAttribute("type", "button");
		state.previous.setAttribute("aria-label", "Previous craft stage");
	}
	if (state.next) {
		state.next.setAttribute("type", "button");
	}
	if (state.pagination) {
		state.pagination.setAttribute("role", "tablist");
		state.pagination.setAttribute("aria-label", "Craft stages");
	}
	state.paginationButtons.forEach(
		(button, index) => {
			button.setAttribute("role", "tab");
			button.setAttribute("type", "button");
			button.setAttribute("aria-label", `Show ${getCraftStageName(index)} stage`);
		});
}
/* ============================================================
   GENERIC CAROUSEL INITIALIZATION
   ============================================================ */
export function initCarousel(carousel) {
	if (!(carousel instanceof HTMLElement)) {
		return null;
	}
	const existingState = getState(carousel);
	if (existingState) {
		return existingState;
	}
	const state = createCarouselState(carousel, "generic");
	if (!state.track || !state.viewport || !state.slides.length) {
		carouselState.delete(carousel);
		return null;
	}
	setupAccessibility(state);
	createPagination(state);
	goToSlide(carousel, 0);
	bindGenericEvents(state);
	startAutoplay(state);
	window.requestAnimationFrame(
		() => {
			removeClass(state.track, "is-initializing");
		});
	return state;
}
/* ============================================================
   CRAFT CAROUSEL INITIALIZATION
   ============================================================ */
export function initCraftCarousel(carousel) {
	if (!(carousel instanceof HTMLElement)) {
		return null;
	}
	const existingState = getState(carousel);
	if (existingState) {
		return existingState;
	}
	const state = createCarouselState(carousel, "craft");
	if (!state.slides.length) {
		carouselState.delete(carousel);
		return null;
	}
	/*
	 * IMPORTANT:
	 *
	 * The Craft carousel is intentionally
	 * configured for automatic sliding.
	 *
	 * Five seconds between stages.
	 */
	state.autoplay = true;
	state.interval = positiveNumber(carousel.dataset.carouselInterval, CONFIG.defaultInterval);
	setupCraftAccessibility(state);
	/*
	 * Set the first slide immediately.
	 */
	goToSlide(carousel, 0);
	bindCraftEvents(state);
	/*
	 * Start automatic sliding.
	 */
	startAutoplay(state);
	return state;
}
/* ============================================================
   INITIALIZE ALL GENERIC CAROUSELS
   ============================================================ */
export function initCarousels() {
	const carousels = findCarousels();
	carousels.forEach(initCarousel);
	return carousels.length;
}
/* ============================================================
   INITIALIZE ALL CRAFT CAROUSELS
   ============================================================ */
export function initCraftCarousels() {
	const carousels = findCraftCarousels();
	carousels.forEach(initCraftCarousel);
	return carousels.length;
}
/* ============================================================
   DESTROY CAROUSEL
   ============================================================ */
export function destroyCarousel(carousel) {
	const state = getState(carousel);
	if (!state) {
		return;
	}
	stopAutoplay(state);
	if (state.track) {
		state.track.style.transform = "";
		state.track.style.transition = "";
	}
	state.slides.forEach(
		(slide) => {
			slide.classList.remove("is-active", "is-prev", "is-next", "is-transitioning");
			slide.removeAttribute("aria-hidden");
			slide.removeAttribute("inert");
		});
	carouselState.delete(carousel);
}
/* ============================================================
   PUBLIC SWIPER API
   ============================================================ */
export const swiper = Object.freeze({
	init: initCarousels,
	initCarousel,
	initCraftCarousel,
	initCraftCarousels,
	destroy: destroyCarousel,
	previous: previousSlide,
	next: nextSlide,
	goTo: goToSlide,
	prefersReducedMotion
});
export default swiper;
/* ============================================================
   AUTOMATIC DOM INITIALIZATION
   ============================================================ */
// onDOMReady(
// 	() => {
// 		initCarousels();
// 		initCraftCarousels();
// 	});

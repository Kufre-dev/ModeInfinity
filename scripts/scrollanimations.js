import { $$, addClass, prefersReducedMotion, onDOMReady } from "./helpers.js";

if (document.documentElement) {
    document.documentElement.classList.add("js");
}

const CONFIG = Object.freeze({
    selector: [
        ".reveal",
        ".reveal-up",
        ".reveal-down",
        ".reveal-left",
        ".reveal-right",
        ".reveal-scale",
    ].join(","),
    threshold: 0.12,
    rootMargin: "0px 0px -8% 0px",
});

const state = {
    observer: null,
    mutationObserver: null,
    reducedMotion: null,
    seen: new WeakSet(),
    observedCount: 0,
};

function applyStaggerDelay(element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    const rawDelay = element.dataset.delay ?? element.dataset.animationDelay;
    if (rawDelay === undefined || rawDelay === "") {
        return;
    }

    const delay = Number.parseFloat(rawDelay);
    if (!Number.isFinite(delay) || delay < 0) {
        return;
    }

    element.style.setProperty("--reveal-delay", `${delay}ms`);
}

function markPending(element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }
    element.style.willChange = "opacity, transform";
}

function clearPending(element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    const clear = () => {
        element.style.removeProperty("will-change");
    };

    let cleared = false;
    const onTransitionEnd = (event) => {
        if (event.target !== element) {
            return;
        }
        cleared = true;
        element.removeEventListener("transitionend", onTransitionEnd);
        clear();
    };

    element.addEventListener("transitionend", onTransitionEnd);

    window.setTimeout(() => {
        if (cleared) {
            return;
        }
        element.removeEventListener("transitionend", onTransitionEnd);
        clear();
    }, 900);
}

function revealImmediately(element) {
    addClass(element, "is-visible");
    element.style.removeProperty("--reveal-delay");
    element.style.removeProperty("will-change");
}

function createObserver() {
    if (typeof window.IntersectionObserver !== "function") {
        return null;
    }
    return new IntersectionObserver(handleIntersection, {
        threshold: CONFIG.threshold,
        rootMargin: CONFIG.rootMargin,
    });
}

function handleIntersection(entries, observer) {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) {
            return;
        }
        const element = entry.target;
        if (!(element instanceof HTMLElement)) {
            return;
        }
        addClass(element, "is-visible");
        clearPending(element);
        observer.unobserve(element);
    });
}

function processElements(elements) {
    if (!elements.length) {
        return;
    }

    elements.forEach((element) => state.seen.add(element));
    elements.forEach((element) => applyStaggerDelay(element));

    if (state.reducedMotion) {
        elements.forEach(revealImmediately);
        return;
    }

    if (!state.observer) {
        state.observer = createObserver();
    }

    if (!state.observer) {
        elements.forEach(revealImmediately);
        return;
    }

    elements.forEach((element) => {
        markPending(element);
        state.observer.observe(element);
    });

    state.observedCount += elements.length;
}

function scanForNewElements() {
    const found = $$(CONFIG.selector).filter((element) => !state.seen.has(element));
    processElements(found);
}

/**
 * Watches the whole document for newly inserted nodes and
 * re-scans for .reveal elements whenever something changes.
 *
 * This is what makes the system independent of *when* or *how*
 * content lands in the DOM — a component fetched and inserted
 * asynchronously, an AJAX-loaded modal, anything. No other file
 * needs to know this exists or call anything after loading
 * content; it's caught automatically here.
 */
function startMutationWatcher() {
    if (state.mutationObserver || typeof window.MutationObserver !== "function") {
        return;
    }

    state.mutationObserver = new MutationObserver(() => {
        scanForNewElements();
    });

    state.mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
}

export function initScrollAnimations() {
    if (state.reducedMotion === null) {
        state.reducedMotion = prefersReducedMotion();
    }

    scanForNewElements();
    startMutationWatcher();
}

export function destroyScrollAnimations() {
    if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
    }
    if (state.mutationObserver) {
        state.mutationObserver.disconnect();
        state.mutationObserver = null;
    }
    state.seen = new WeakSet();
    state.reducedMotion = null;
    state.observedCount = 0;
}

export const scrollAnimations = Object.freeze({
    init: initScrollAnimations,
    destroy: destroyScrollAnimations,
    get observedElements() {
        return state.observedCount;
    },
});

export default scrollAnimations;

// onDOMReady(initScrollAnimations);
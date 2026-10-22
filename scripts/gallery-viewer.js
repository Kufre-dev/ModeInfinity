/* ============================================================
   MODEINFINITY — GALLERY VIEWER
   File: scripts/gallery-viewer.js

   Behaviour:
   - Click a box → grid hides, that box's panel appears in its place.
   - Click the same box again → no-op (grid is already hidden).
   - Close the panel → panel hides, grid reappears.
   - Click any item in a panel → fullscreen viewer opens, scoped to
     that panel's items only.
   - Viewer supports prev/next (buttons + arrows), Escape to close,
     backdrop close, live counter, focus trap.
   - Focus returns to the tile on panel close, and to the item on
     viewer close.
   ============================================================ */

export function initGalleryViewer() {
	"use strict";

	var boxes = document.querySelectorAll("[data-gallery-box]");
	if (!boxes.length) return;

	var viewer = document.getElementById("gallery-viewer");
	if (!viewer) {
		console.warn(
			"[ModeInfinity] #gallery-viewer not found in DOM. " +
			"Gallery viewer cannot initialise."
		);
		return;
	}

	var viewerClose = viewer.querySelector("[data-gallery-viewer-close]");
	var viewerPrev = viewer.querySelector("[data-gallery-viewer-prev]");
	var viewerNext = viewer.querySelector("[data-gallery-viewer-next]");
	var viewerCounter = viewer.querySelector("[data-gallery-viewer-counter]");
	var viewerImage = viewer.querySelector("[data-gallery-viewer-image]");
	var viewerAvif = viewer.querySelector("[data-gallery-viewer-avif]");
	var viewerWebp = viewer.querySelector("[data-gallery-viewer-webp]");
	var viewerTitle = viewer.querySelector("[data-gallery-viewer-title]");
	var viewerDesc = viewer.querySelector("[data-gallery-viewer-description]");

	var grid = document.querySelector(".gallery-hub__grid");

	var openBox = null;
	var openPanel = null;

	var viewerOpen = false;
	var viewerItems = [];
	var viewerIndex = 0;
	var viewerLastFocus = null;

	function isVisible(el) {
		if (!el) return false;
		return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
	}

	function trapFocus(container, event) {
		if (!container || event.key !== "Tab") return;

		var focusables = container.querySelectorAll(
			'a[href], button:not([disabled]), input:not([disabled]), ' +
			'select:not([disabled]), textarea:not([disabled]), ' +
			'[tabindex]:not([tabindex="-1"])'
		);

		var list = Array.prototype.slice.call(focusables).filter(isVisible);
		if (!list.length) return;

		var first = list[0];
		var last = list[list.length - 1];
		var active = document.activeElement;

		if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus({ preventScroll: false });
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus({ preventScroll: false });
		}
	}

	function getPanelForKey(key) {
		return document.querySelector('[data-gallery-panel="' + key + '"]');
	}

	function getBoxKey(box) {
		return box ? box.getAttribute("data-gallery-box") : "";
	}

	function scrollToElement(el) {
		if (!el) return;
		var header = document.querySelector(".site-header");
		var offset = header ? header.offsetHeight + 16 : 16;
		var top = window.scrollY + el.getBoundingClientRect().top - offset;
		window.scrollTo({ top: top, behavior: "smooth" });
	}

	/* ------------------------------------------------------------
	   Panel open / close
	   ------------------------------------------------------------ */

	function openBoxFn(box) {
		if (!box) return;

		// Same box already open → ignore
		if (openBox === box) return;

		// Another box was open → close it first (without touching scroll)
		if (openBox) closeBoxFn(openBox, { skipScroll: true, skipFocus: true });

		var key = getBoxKey(box);
		if (!key) return;

		var panel = getPanelForKey(key);
		if (!panel) return;

		// Swap grid → panel
		if (grid) grid.hidden = true;
		panel.hidden = false;

		var trigger = box.querySelector("[data-gallery-open]");
		if (trigger) trigger.setAttribute("aria-expanded", "true");

		openBox = box;
		openPanel = panel;

		window.requestAnimationFrame(function () {
			scrollToElement(panel);
		});

		var backBtn = panel.querySelector("[data-gallery-close]");
		window.requestAnimationFrame(function () {
			if (backBtn) backBtn.focus({ preventScroll: true });
		});
	}

	function closeBoxFn(box, options) {
		if (!box || openBox !== box) return;

		var opts = options || {};
		var key = getBoxKey(box);
		var panel = key ? getPanelForKey(key) : null;

		if (panel) panel.hidden = true;

		// Restore grid
		if (grid) grid.hidden = false;

		var trigger = box.querySelector("[data-gallery-open]");
		if (trigger) trigger.setAttribute("aria-expanded", "false");

		openBox = null;
		openPanel = null;

		if (viewerOpen) closeViewerFn();

		if (!opts.skipScroll) {
			window.requestAnimationFrame(function () {
				scrollToElement(grid || box);
			});
		}

		if (!opts.skipFocus && trigger) {
			window.requestAnimationFrame(function () {
				trigger.focus({ preventScroll: true });
			});
		}
	}

	/* ------------------------------------------------------------
	   Item collection
	   ------------------------------------------------------------ */

	function collectItems(panel) {
		if (!panel) return [];
		var itemEls = panel.querySelectorAll("[data-gallery-item]");
		var items = [];
		for (var i = 0; i < itemEls.length; i++) {
			var el = itemEls[i];
			items.push({
				title: el.getAttribute("data-gallery-title") || "",
				description: el.getAttribute("data-gallery-description") || "",
				avif: el.getAttribute("data-image-avif") || "",
				webp: el.getAttribute("data-image-webp") || "",
				fallback: el.getAttribute("data-image-fallback") || "",
				alt: el.getAttribute("data-image-alt") || ""
			});
		}
		return items;
	}

	/* ------------------------------------------------------------
	   Viewer render
	   ------------------------------------------------------------ */

	function renderViewer() {
		if (!viewerItems.length) return;
		var item = viewerItems[viewerIndex];

		if (viewerAvif) {
			if (item.avif) viewerAvif.setAttribute("srcset", item.avif);
			else viewerAvif.removeAttribute("srcset");
		}
		if (viewerWebp) {
			if (item.webp) viewerWebp.setAttribute("srcset", item.webp);
			else viewerWebp.removeAttribute("srcset");
		}
		if (viewerImage) {
			viewerImage.src = item.fallback;
			viewerImage.alt = item.alt || item.title || "";
		}
		if (viewerTitle) viewerTitle.textContent = item.title || "";
		if (viewerDesc) viewerDesc.textContent = item.description || "";
		if (viewerCounter) {
			viewerCounter.textContent = (viewerIndex + 1) + " of " + viewerItems.length;
		}

		var multi = viewerItems.length > 1;
		if (viewerPrev) viewerPrev.disabled = !multi;
		if (viewerNext) viewerNext.disabled = !multi;
	}

	/* ------------------------------------------------------------
	   Viewer open / close / prev / next
	   ------------------------------------------------------------ */

	function openViewerFn(panel, index) {
		if (viewerOpen) return;

		viewerItems = collectItems(panel);
		if (!viewerItems.length) return;

		viewerIndex = Math.max(0, Math.min(index, viewerItems.length - 1));
		viewerLastFocus =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;

		renderViewer();

		viewer.setAttribute("aria-hidden", "false");
		viewerOpen = true;

		window.requestAnimationFrame(function () {
			if (viewerClose) viewerClose.focus({ preventScroll: true });
		});
	}

	function closeViewerFn() {
		if (!viewerOpen) return;

		viewer.setAttribute("aria-hidden", "true");
		viewerOpen = false;

		if (viewerLastFocus && document.contains(viewerLastFocus)) {
			viewerLastFocus.focus({ preventScroll: true });
		}
		viewerLastFocus = null;
	}

	function showPrev() {
		if (!viewerItems.length) return;
		viewerIndex = (viewerIndex - 1 + viewerItems.length) % viewerItems.length;
		renderViewer();
	}

	function showNext() {
		if (!viewerItems.length) return;
		viewerIndex = (viewerIndex + 1) % viewerItems.length;
		renderViewer();
	}

	/* ------------------------------------------------------------
	   Clicks
	   ------------------------------------------------------------ */

	document.addEventListener("click", function (event) {
		var target = event.target;

		var opener = target.closest("[data-gallery-open]");
		if (opener) {
			event.preventDefault();
			var box = opener.closest("[data-gallery-box]");
			if (box) openBoxFn(box);
			return;
		}

		var closer = target.closest("[data-gallery-close]");
		if (closer) {
			event.preventDefault();
			var panelForClose = closer.closest("[data-gallery-panel]");
			if (panelForClose) {
				var key = panelForClose.getAttribute("data-gallery-panel");
				var boxForClose = document.querySelector('[data-gallery-box="' + key + '"]');
				if (boxForClose) closeBoxFn(boxForClose);
			}
			return;
		}

		var itemBtn = target.closest("[data-gallery-item]");
		if (itemBtn) {
			event.preventDefault();
			var panel = itemBtn.closest("[data-gallery-panel]");
			if (!panel) return;
			var items = panel.querySelectorAll("[data-gallery-item]");
			var idx = Array.prototype.indexOf.call(items, itemBtn);
			if (idx >= 0) openViewerFn(panel, idx);
			return;
		}

		var viewerCloser = target.closest("[data-gallery-viewer-close]");
		if (viewerCloser) {
			event.preventDefault();
			closeViewerFn();
			return;
		}

		var prevBtn = target.closest("[data-gallery-viewer-prev]");
		if (prevBtn) {
			event.preventDefault();
			showPrev();
			return;
		}

		var nextBtn = target.closest("[data-gallery-viewer-next]");
		if (nextBtn) {
			event.preventDefault();
			showNext();
			return;
		}
	});

	/* ------------------------------------------------------------
	   Keyboard
	   ------------------------------------------------------------ */

	document.addEventListener("keydown", function (event) {
		if (event.key === "Escape") {
			if (viewerOpen) {
				event.preventDefault();
				closeViewerFn();
				return;
			}
			if (openBox) {
				event.preventDefault();
				closeBoxFn(openBox);
				return;
			}
		}

		if (viewerOpen) {
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				showPrev();
				return;
			}
			if (event.key === "ArrowRight") {
				event.preventDefault();
				showNext();
				return;
			}
			trapFocus(viewer, event);
		}
	});

	/* ------------------------------------------------------------
	   Initial state
	   ------------------------------------------------------------ */

	viewer.setAttribute("aria-hidden", "true");

	document.querySelectorAll("[data-gallery-panel]").forEach(function (panel) {
		if (!panel.hasAttribute("hidden")) {
			panel.setAttribute("hidden", "");
		}
	});

	if (grid && grid.hasAttribute("hidden")) {
		grid.hidden = false;
	}

	return {
		openBox: function (key) {
			var box = document.querySelector('[data-gallery-box="' + key + '"]');
			if (box) openBoxFn(box);
		},
		closeBox: function () {
			if (openBox) closeBoxFn(openBox);
		},
		closeViewer: closeViewerFn,
		prev: showPrev,
		next: showNext,
		get state() {
			return {
				boxOpen: !!openBox,
				viewerOpen: viewerOpen,
				viewerIndex: viewerIndex,
				viewerCount: viewerItems.length
			};
		}
	};
}

export default initGalleryViewer;
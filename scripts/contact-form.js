/* ============================================================
   MODEINFINITY — CONTACT FORM PAGE CONTROLLER
   File: scripts/contact-form.js
   ============================================================ */

(function () {
	"use strict";

	/* ============================================================
	   0. SUBJECT HINTS
	   ============================================================ */

	const SUBJECT_HINTS = {
		"Academy Inquiry":     "Apply to the shoemaking academy. We'll arrange a consultation and workshop tour before you secure a place.",
		"Commission Pair":     "A bespoke pair made from scratch to your measurements and design vision.",
		"Custom Order":        "Personalise a design from the gallery — choose your leather, colour, and size.",
		"Existing Order":      "Check the status of a pair already in progress, or ask about an adjustment.",
		"Repairs":             "Repair, resole, or restore a ModeInfinity pair made in our workshop.",
		"Partnership Inquiry": "Wholesale, collaborations, media interviews, or brand features.",
		"Book Workshop Tour":  "Tour the Abuja workshop or visit the Lagos showroom to see the collection.",
		"Gift":                "Purchase a gift, enquire about gift vouchers, or ask about gifting options.",
		"Client Inquiry":      "Anything that doesn't fit the categories above — we'll route it to the right person."
	};

	/* ============================================================
	   1. PREFILL FROM SHOP
	   ============================================================ */

	function initPrefillFromShop() {
		const params = new URLSearchParams(window.location.search);
		const productName = (params.get("custom") || "").trim();
		const shoeId = (params.get("shoe") || "").trim();

		if (!productName && !shoeId) {
			return;
		}

		const subjectSelect = document.getElementById("modernSubject");
		const customSubject = document.getElementById("customSubject");
		const messageField = document.getElementById("modernMessage");
		const formWrap = document.querySelector(".contact-form-wrap");

		if (!subjectSelect) {
			return;
		}

		/* 1. Pre-select "Custom Order" and fire change so
		      applyVisibility() reveals the reference field. */
		subjectSelect.value = "Custom Order";
		subjectSelect.dispatchEvent(new Event("change", { bubbles: true }));

		/* 2. Prefill reference code */
		if (customSubject && shoeId && !customSubject.value) {
			customSubject.value = shoeId;
		}

				/* 3. Prefill message with an editable template */
		if (messageField && !messageField.value) {
			const displayName = productName || "this pair";
			const refLine = shoeId ? ` (${shoeId})` : "";

			messageField.value =
				`I'd like to customise "${displayName}"${refLine}.\n\n` +
				`My preferences:\n` +
				`- Colour / finish: \n` +
				`- Leather preference: \n` +
				`- Size: \n` +
				`- Foot / fit notes (if any): \n` +
				`- When I'd like it: \n` +
				`- Occasion (everyday, work, event, gift): \n` +
				`- Anything else — inspiration, materials, or photos you'd like to share: `;
		}

		/* 4. Scroll to the FORM WRAP (not the section header), then focus */
		window.requestAnimationFrame(function () {
			if (formWrap) {
				formWrap.scrollIntoView({
					behavior: "smooth",
					block: "start"
				});
			}

			window.setTimeout(function () {
				if (customSubject) {
					customSubject.focus({ preventScroll: true });
				}
			}, 500);
		});

		/* 5. Clean the URL */
		try {
			history.replaceState(
				null,
				"",
				window.location.pathname + "#contact-form"
			);
		} catch (e) {}
	}

	/* ============================================================
	   2. CONDITIONAL FIELD VISIBILITY + HINT
	   ============================================================ */

	function initConditionalFields() {
		const subjectSelect = document.getElementById("modernSubject");
		const programField = document.getElementById("programSelectField");
		const customField = document.getElementById("customSubjectField");
		const orderField = document.getElementById("orderReferenceField");
		const hintEl = document.getElementById("subjectHint");

		if (!subjectSelect) {
			return;
		}

		function updateHint(value) {
			if (!hintEl) {
				return;
			}

			const text = SUBJECT_HINTS[value] || "";
			hintEl.textContent = text;
			hintEl.hidden = !text;
		}

		function applyVisibility() {
			const value = subjectSelect.value;

			/* Academy application */
			if (programField) {
				programField.classList.toggle(
					"visible",
					value === "Academy Inquiry"
				);

				const programSelect = programField.querySelector("select");

				if (programSelect && value !== "Academy Inquiry") {
					programSelect.classList.remove("has-value");
				}
			}

			/* Custom order */
			if (customField) {
				customField.classList.toggle(
					"visible",
					value === "Custom Order"
				);

				const customInput = customField.querySelector("input");

				if (customInput && value !== "Custom Order") {
					customInput.classList.remove("has-value");
				}
			}

			/* Existing order */
			if (orderField) {
				orderField.classList.toggle(
					"visible",
					value === "Existing Order"
				);

				const orderInput = orderField.querySelector("input");

				if (orderInput && value !== "Existing Order") {
					orderInput.classList.remove("has-value");
				}
			}

			updateHint(value);
		}

		subjectSelect.addEventListener("change", applyVisibility);
		applyVisibility();
	}

	/* ============================================================
	   3. SUCCESS MODAL
	   ============================================================ */

	function initSuccessModal() {
		const modal = document.getElementById("successModal");

		if (!modal) {
			return;
		}

		const closeButtons =
			modal.querySelectorAll("[data-contact-success-close]");
		const panel = modal.querySelector(".contact-success__panel");

		let lastFocus = null;
		let isOpen = false;

		function open() {
			if (isOpen) {
				return;
			}

			lastFocus =
				document.activeElement instanceof HTMLElement ?
				document.activeElement :
				null;

			modal.setAttribute("aria-hidden", "false");
			document.body.style.overflow = "hidden";
			isOpen = true;

			window.requestAnimationFrame(function () {
				const focusables =
					panel ?
					panel.querySelectorAll(
						'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
					) :
					null;

				const first =
					focusables && focusables.length ?
					focusables[0] :
					panel;

				if (first && typeof first.focus === "function") {
					first.focus({ preventScroll: true });
				}
			});
		}

		function close() {
			if (!isOpen) {
				return;
			}

			modal.setAttribute("aria-hidden", "true");
			document.body.style.overflow = "";
			isOpen = false;

			if (
				lastFocus &&
				document.contains(lastFocus) &&
				typeof lastFocus.focus === "function"
			) {
				lastFocus.focus({ preventScroll: true });
			}

			lastFocus = null;
		}

		closeButtons.forEach(function (button) {
			button.addEventListener("click", function (event) {
				event.preventDefault();
				close();
			});
		});

		document.addEventListener("keydown", function (event) {
			if (!isOpen) {
				return;
			}

			if (event.key === "Escape") {
				event.preventDefault();
				close();
			}
		});

		modal.addEventListener("keydown", function (event) {
			if (!isOpen || event.key !== "Tab" || !panel) {
				return;
			}

			const focusables =
				panel.querySelectorAll(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
				);

			const list =
				Array.prototype.filter.call(
					focusables,
					function (el) {
						return (
							el.offsetWidth > 0 ||
							el.offsetHeight > 0 ||
							el === document.activeElement
						);
					}
				);

			if (!list.length) {
				return;
			}

			const first = list[0];
			const last = list[list.length - 1];
			const active = document.activeElement;

			if (event.shiftKey && active === first) {
				event.preventDefault();
				last.focus({ preventScroll: true });
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus({ preventScroll: true });
			}
		});

		document.addEventListener(
			"modeinfinity:form:success",
			function (event) {
				const detail = event.detail || {};

				if (detail.formName !== "contact") {
					return;
				}

				open();
			}
		);
	}

	/* ============================================================
	   4. INITIALIZATION
	   ============================================================ */

	function init() {
		initConditionalFields();
		initPrefillFromShop();
		initSuccessModal();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, {
			once: true
		});
	} else {
		init();
	}
})();
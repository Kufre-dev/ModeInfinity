/* ============================================================
   MODEINFINITY — CONTACT FORM PAGE CONTROLLER
   File: scripts/contact-form.js

   Owns the contact-page-specific UI that scripts/formhandler.js
   deliberately does not touch:

     1. Conditional field visibility
        - #programSelectField.visible  → when enquiry type = "Academy Inquiry"
        - #customSubjectField.visible  → when enquiry type = "Custom Order"
        - #orderReferenceField.visible → when enquiry type = "Existing Order"

     2. Live hint under the enquiry select
        - #subjectHint updates on every change with a short description
          of the selected option.

     3. Success modal open / close
        - Opens on "modeinfinity:form:success" (dispatched by formhandler.js)
        - Closes via [data-contact-success-close] buttons, backdrop, or Escape
        - Traps focus while open, restores focus on close, locks body scroll

   Loaded only on contact.html. Null-guards every lookup, so the
   file is safe to load even if the contact markup changes.

   Dependencies:
     - scripts/formhandler.js must fire "modeinfinity:form:success"
       with detail.formName === "contact".
   ============================================================ */

(function () {
	"use strict";

	/* ============================================================
	   0. SUBJECT HINTS
	   ============================================================
	   Short, human descriptions shown under the enquiry select.
	   Keys must match the <option value="…"> strings in contact.html.
	   Edit a description by changing one line here.
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
	   1. CONDITIONAL FIELD VISIBILITY + HINT
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

			/* ---- Academy application ---- */
			if (programField) {
				programField.classList.toggle(
					"visible",
					value === "Academy Inquiry"
				);

				/*
				 * When program is hidden, mark its select
				 * .has-value=false so the floating label
				 * returns to its resting position on the
				 * next open. formhandler.js keeps this in
				 * sync on input/change, but we handle the
				 * hidden case here because the field is
				 * display:none and never receives an event.
				 */
				const programSelect =
					programField.querySelector("select");

				if (programSelect && value !== "Academy Inquiry") {
					programSelect.classList.remove("has-value");
				}
			}

			/* ---- Custom order ---- */
			if (customField) {
				customField.classList.toggle(
					"visible",
					value === "Custom Order"
				);

				const customInput =
					customField.querySelector("input");

				if (customInput && value !== "Custom Order") {
					customInput.classList.remove("has-value");
				}
			}

			/* ---- Existing order ---- */
			if (orderField) {
				orderField.classList.toggle(
					"visible",
					value === "Existing Order"
				);

				const orderInput =
					orderField.querySelector("input");

				if (orderInput && value !== "Existing Order") {
					orderInput.classList.remove("has-value");
				}
			}

			/* ---- Live hint ---- */
			updateHint(value);
		}

		subjectSelect.addEventListener("change", applyVisibility);

		/* Honour a preselected option on first paint */
		applyVisibility();
	}

	/* ============================================================
	   2. SUCCESS MODAL
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

			/* Move focus into the panel on next frame */
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

		/* Close on any [data-contact-success-close] element */
		closeButtons.forEach(function (button) {
			button.addEventListener("click", function (event) {
				event.preventDefault();
				close();
			});
		});

		/* Close on Escape */
		document.addEventListener("keydown", function (event) {
			if (!isOpen) {
				return;
			}

			if (event.key === "Escape") {
				event.preventDefault();
				close();
			}
		});

		/* Basic focus trap while open */
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

		/*
		 * Open the modal when formhandler dispatches success.
		 *
		 * Guard on formName so this listener does nothing if a
		 * different form on the page ever fires the same event.
		 */
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
	   3. INITIALIZATION
	   ============================================================ */

	function init() {
		initConditionalFields();
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
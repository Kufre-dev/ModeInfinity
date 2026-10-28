/* ============================================================
   MODEINFINITY — FORM HANDLER
   ============================================================

   Handles shared form behavior for the ModeInfinity website.

   Responsibilities:
   - Form discovery
   - Client-side validation
   - Accessible error handling
   - Submit-state management
   - Duplicate-submit prevention
   - Success / error notifications
   - Backend-ready request handling
   - Safe form data collection
   - Form reset after successful submission
   - Accessible status announcements
   - Floating-label state (for <select>)
   - Cross-module events (success / invalid / error)
   - Formspree magic fields (_replyto / _cc / _subject)
   - Optional WhatsApp handoff (data-whatsapp="true")

   Intended forms:
   - Contact form
   - Academy enquiry form
   - General enquiry forms
   - Future application forms

   Dependencies:
   - scripts/helpers.js
   - scripts/validators.js

   Related files:
   - components/toast.html
   - styles/components.css
   - styles/animations.css
   - styles/responsive.css

   Important:
   - Client-side validation is not a security boundary.
   - Server-side validation remains mandatory.
   - No credentials, payment information, or secrets are
     stored in this frontend module.
   - No external form service is assumed.

   Form configuration (via data attributes):
   - data-form="contact"                 → form name in events
   - data-endpoint="https://..."         → POST target (Formspree)
   - data-whatsapp="true"                → open WhatsApp on success
   - data-sender-copy="cc" | "none"      → _cc sender on owner email
                                           (default "cc"; set "none"
                                           when Formspree Autoresponse
                                           is enabled to avoid double
                                           emails to the sender)

   WhatsApp number is set once in WHATSAPP_NUMBER below.
   Format: international, no +, no spaces, no leading 0.
   Example: +2348050424000 → "2348050424000"

   Events dispatched on document:
   - "modeinfinity:toast"         → { type, title, message }
   - "modeinfinity:form:success"  → { form, formName, message, response,
                                     payload, whatsappUrl? }
   - "modeinfinity:form:invalid"  → { form, formName, errors }
   - "modeinfinity:form:error"    → { form, formName, error }

   Principles:
   - ES modules
   - No external dependencies
   - Accessible
   - Progressive enhancement
   - No emoji-dependent UI
   ============================================================ */


/* ============================================================
   1. IMPORTS
   ============================================================ */

import { $$, on } from "./helpers.js";

import {
	validateForm,
	focusFirstError
} from "./validators.js";


/* ============================================================
   2. CONFIGURATION
   ============================================================ */

/*
 * Receiving WhatsApp number.
 *
 * Example: +2348050424000 → "2348050424000"
 * Change this one line if the business WhatsApp changes.
 */
const WHATSAPP_NUMBER = "2348050424000";

const CONFIG = Object.freeze({
	formSelector: "form[data-form]",

	/*
	 * Default request timeout.
	 */
	requestTimeout: 15000,

	/*
	 * Default success message.
	 */
	successTitle: "Message sent",

	successMessage: "Your message has been submitted successfully.",

	errorTitle: "Submission failed",

	errorMessage: "We could not submit your message. Please try again."
});


/* ============================================================
   3. VALIDATION CONFIGURATION
   ============================================================ */

/**
 * Default validation rules used when a field provides
 * data-validate attributes.
 *
 * The actual page forms will define their own rules through
 * data attributes or explicit form configuration.
 */
const VALIDATION_RULES = Object.freeze({
	name: [{
			type: "required",
			message: "Enter your name."
		},
		{
			type: "minLength",
			minimum: 2,
			message: "Your name must contain at least 2 characters."
		}
	],

	email: [{
			type: "required",
			message: "Enter your email address."
		},
		{
			type: "email",
			message: "Enter a valid email address."
		}
	],

	phone: [{
		type: "phone",
		message: "Enter a valid phone number."
	}],

	message: [{
			type: "required",
			message: "Enter your message."
		},
		{
			type: "minLength",
			minimum: 10,
			message: "Your message must contain at least 10 characters."
		}
	]
});


/* ============================================================
   4. STATE
   ============================================================ */

const state = {
	initialized: false,

	submittingForms: new WeakSet()
};


/* ============================================================
   5. FORM STATE HELPERS
   ============================================================ */

/**
 * Determine whether a form is currently submitting.
 *
 * @param {HTMLFormElement} form
 * @returns {boolean}
 */
function isSubmitting(form) {
	return state.submittingForms.has(
		form
	);
}


/**
 * Mark a form as submitting.
 *
 * @param {HTMLFormElement} form
 */
function setSubmitting(form) {
	state.submittingForms.add(
		form
	);
}


/**
 * Clear the submitting state.
 *
 * @param {HTMLFormElement} form
 */
function clearSubmitting(form) {
	state.submittingForms.delete(
		form
	);
}


/* ============================================================
   6. FIELD STATE HELPERS
   ============================================================ */

/**
 * Keep the select floating-label state in sync.
 *
 * The contact.css floating-label rules rely on
 *   select.has-value ~ label
 * because the DOM `value` attribute never updates when the
 * user picks an option. This helper adds / removes the class
 * so the label lifts when a real option is chosen.
 *
 * @param {HTMLElement} field
 */
function updateFieldState(field) {
	if (!(field instanceof HTMLElement)) {
		return;
	}

	if (field instanceof HTMLSelectElement) {
		const hasValue =
			typeof field.value === "string" &&
			field.value.trim() !== "";

		field.classList.toggle(
			"has-value",
			hasValue
		);
	}
}


/**
 * Remove a field's validation error state and its message node.
 *
 * Mirrors what validators.js `clearFieldError` would do, but
 * defined locally so this module stays robust against
 * validators.js API changes.
 *
 * @param {HTMLElement} field
 */
function clearFieldError(field) {
	if (!(field instanceof HTMLElement)) {
		return;
	}

	field.removeAttribute(
		"aria-invalid"
	);

	const errorId =
		`${field.id || field.name}-error`;

	if (!errorId || errorId === "-error") {
		return;
	}

	const errorEl =
		document.getElementById(errorId);

	if (errorEl) {
		errorEl.remove();
	}

	const describedBy =
		field.getAttribute(
			"aria-describedby"
		);

	if (!describedBy) {
		return;
	}

	const remainingIds =
		describedBy
		.split(/\s+/)
		.filter((id) => id && id !== errorId);

	if (remainingIds.length) {
		field.setAttribute(
			"aria-describedby",
			remainingIds.join(" ")
		);
	} else {
		field.removeAttribute(
			"aria-describedby"
		);
	}
}


/* ============================================================
   7. FORM VALIDATION RULE PARSING
   ============================================================ */

/**
 * Parse validation rules supplied through data attributes.
 *
 * Examples:
 *
 * data-validate="required,email"
 * data-min-length="10"
 * data-max-length="500"
 *
 * @param {HTMLElement} field
 * @returns {Object[]}
 */
function getFieldRules(field) {
	if (!(field instanceof HTMLElement)) {
		return [];
	}

	const rules = [];

	/*
	 * A checkbox needs a "checkbox" rule rather than "required".
	 *
	 * The "required" rule is implemented by validateRequired()
	 * which returns !isEmpty(value). isEmpty() runs
	 * String(value).trim().length === 0. For a checkbox,
	 * getFieldValue returns field.checked — a boolean. When
	 * unchecked, String(false).trim() is "false" — length 5 —
	 * so isEmpty returns false and validateRequired passes.
	 *
	 * The "checkbox" rule, by contrast, returns Boolean(value),
	 * which correctly fails on false.
	 */
	const isCheckbox =
		field instanceof HTMLInputElement &&
		field.type === "checkbox";

	const validateAttribute =
		field.dataset.validate || "";

	const requestedRules =
		validateAttribute
		.split(",")
		.map(
			(rule) =>
			rule.trim().toLowerCase()
		)
		.filter(Boolean);

	requestedRules.forEach(
		(ruleType) => {
			switch (ruleType) {
				case "required":
					if (isCheckbox) {
						rules.push({
							type: "checkbox",
							message:
								field.dataset.requiredMessage ||
								"Please confirm to continue."
						});
					} else {
						rules.push({
							type: "required"
						});
					}
					break;

				case "email":
					rules.push({
						type: "email"
					});
					break;

				case "phone":
					rules.push({
						type: "phone"
					});
					break;

				case "number":
					rules.push({
						type: "number"
					});
					break;

				case "integer":
					rules.push({
						type: "integer"
					});
					break;

				case "positive":
					rules.push({
						type: "positive"
					});
					break;

				case "url":
					rules.push({
						type: "url"
					});
					break;

				default:
					break;
			}
		}
	);

	const minimum =
		Number(
			field.dataset.minLength
		);

	if (
		Number.isFinite(minimum) &&
		minimum > 0
	) {
		rules.push({
			type: "minLength",
			minimum
		});
	}

	const maximum =
		Number(
			field.dataset.maxLength
		);

	if (
		Number.isFinite(maximum) &&
		maximum > 0
	) {
		rules.push({
			type: "maxLength",
			maximum
		});
	}

	return rules;
}


/* ============================================================
   8. FIELD RULE COLLECTION
   ============================================================ */

/**
 * Build validation configuration from the form.
 *
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
function buildValidationRules(form) {
	const fieldRules = {};

	const fields =
		Array.from(
			form.elements
		).filter(
			(field) =>
			field instanceof HTMLElement &&
			field instanceof HTMLInputElement ||
			field instanceof HTMLSelectElement ||
			field instanceof HTMLTextAreaElement
		);

	fields.forEach(
		(field) => {
			if (!field.name) {
				return;
			}

			const explicitRules =
				getFieldRules(field);

			if (explicitRules.length) {
				fieldRules[field.name] =
					explicitRules;

				return;
			}

			/*
			 * Provide sensible defaults for common field names.
			 */
			const commonRules =
				VALIDATION_RULES[
					field.name
				];

			if (
				commonRules
			) {
				fieldRules[field.name] =
					commonRules;
			}
		}
	);

	return fieldRules;
}


/* ============================================================
   9. FORM DATA COLLECTION
   ============================================================ */

/**
 * Collect form data into a plain object.
 *
 * Checkbox values are represented as booleans.
 * Multiple fields with the same name are represented as arrays.
 *
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
export function collectFormData(form) {
	if (!(form instanceof HTMLFormElement)) {
		return {};
	}

	const formData =
		new FormData(form);

	const data = {};

	for (const [
			key,
			value
		] of formData.entries()) {
		const cleanKey =
			String(key).trim();

		if (!cleanKey) {
			continue;
		}

		const cleanValue =
			typeof value === "string" ?
			value.trim() :
			value;

		if (
			Object.prototype.hasOwnProperty.call(
				data,
				cleanKey
			)
		) {
			if (!Array.isArray(data[cleanKey])) {
				data[cleanKey] = [
					data[cleanKey]
				];
			}

			data[cleanKey].push(
				cleanValue
			);

			continue;
		}

		data[cleanKey] =
			cleanValue;
	}

	return data;
}


/* ============================================================
   10. SUBMIT BUTTON
   ============================================================ */

/**
 * Return the submit button associated with a form.
 *
 * @param {HTMLFormElement} form
 * @returns {HTMLButtonElement|HTMLInputElement|null}
 */
function getSubmitButton(form) {
	return (
		form.querySelector(
			"button[type='submit'], input[type='submit']"
		) ||
		null
	);
}


/**
 * Set the submit button state.
 *
 * @param {HTMLFormElement} form
 * @param {boolean} submitting
 */
function setSubmitButtonState(
	form,
	submitting
) {
	const button =
		getSubmitButton(form);

	if (!button) {
		return;
	}

	if (submitting) {
		if (
			!button.dataset.originalText
		) {
			button.dataset.originalText =
				button instanceof HTMLButtonElement ?
				button.textContent.trim() :
				button.value;
		}

		button.disabled = true;

		button.setAttribute(
			"aria-busy",
			"true"
		);

		if (
			button instanceof HTMLButtonElement
		) {
			button.textContent =
				button.dataset.loadingText ||
				"Sending...";
		} else {
			button.value =
				button.dataset.loadingText ||
				"Sending...";
		}

		return;
	}

	button.disabled = false;

	button.removeAttribute(
		"aria-busy"
	);

	if (
		button.dataset.originalText
	) {
		if (
			button instanceof HTMLButtonElement
		) {
			button.textContent =
				button.dataset.originalText;
		} else {
			button.value =
				button.dataset.originalText;
		}
	}
}


/* ============================================================
   11. FORM STATUS
   ============================================================ */

/**
 * Find the optional form status element.
 *
 * Expected markup:
 *
 * <p
 *     class="form-status"
 *     data-form-status
 *     aria-live="polite"
 * ></p>
 *
 * @param {HTMLFormElement} form
 * @returns {HTMLElement|null}
 */
function getFormStatus(form) {
	return (
		form.querySelector(
			"[data-form-status]"
		) ||
		null
	);
}


/**
 * Set a visible status message for a form.
 *
 * @param {HTMLFormElement} form
 * @param {"success"|"error"|"info"} type
 * @param {string} message
 */
function setFormStatus(
	form,
	type,
	message
) {
	const status =
		getFormStatus(form);

	if (!status) {
		return;
	}

	status.textContent =
		String(message).trim();

	status.dataset.status =
		type;

	status.hidden = !message;
}


/**
 * Clear a form status.
 *
 * @param {HTMLFormElement} form
 */
function clearFormStatus(form) {
	const status =
		getFormStatus(form);

	if (!status) {
		return;
	}

	status.textContent = "";
	status.hidden = true;

	delete status.dataset.status;
}


/* ============================================================
   12. EVENT BRIDGES
   ============================================================ */

/**
 * Show a notification through the global toast component
 * when it exists.
 *
 * @param {Object} options
 */
function notify(options) {
	const event =
		new CustomEvent(
			"modeinfinity:toast", {
				detail: options
			}
		);

	document.dispatchEvent(
		event
	);
}


/**
 * Dispatch a lifecycle event for this form.
 *
 * Used by scripts/contact-form.js (and any future page
 * module) to react to outcomes without formhandler needing
 * to know about page-specific UI.
 *
 * @param {"success"|"invalid"|"error"} stage
 * @param {HTMLFormElement} form
 * @param {Object} detail
 */
function dispatchFormEvent(stage, form, detail = {}) {
	const formName =
		form.dataset.form ||
		"form";

	document.dispatchEvent(
		new CustomEvent(
			`modeinfinity:form:${stage}`, {
				detail: {
					form,
					formName,
					...detail
				}
			}
		)
	);
}


/* ============================================================
   13. REQUEST TIMEOUT
   ============================================================ */

/**
 * Create an AbortController with a timeout.
 *
 * @param {number} timeout
 * @returns {{controller: AbortController, timeoutId: number}}
 */
function createRequestTimeout(
	timeout
) {
	const controller =
		new AbortController();

	const timeoutId =
		window.setTimeout(
			() => {
				controller.abort();
			},
			timeout
		);

	return {
		controller,
		timeoutId
	};
}


/* ============================================================
   14. BACKEND ENDPOINT
   ============================================================ */

/**
 * Read a form's configured endpoint.
 *
 * @param {HTMLFormElement} form
 * @returns {string}
 */
function getEndpoint(form) {
	const endpoint =
		form.dataset.endpoint;

	if (
		typeof endpoint !== "string" ||
		!endpoint.trim()
	) {
		return "";
	}

	return endpoint.trim();
}


/* ============================================================
   15. WHATSAPP HANDOFF
   ============================================================
   On successful submission, if the form has
   data-whatsapp="true", we open a pre-filled WhatsApp chat
   in a new tab. The visitor must still tap Send inside
   WhatsApp — no API-less way to bypass that.

   The success URL is also exposed via the "form:success"
   event so the page controller can render an "Open
   WhatsApp" button as a fallback if the tab was blocked.
   ============================================================ */

/**
 * Turn a form payload into a readable WhatsApp message.
 *
 * @param {Object} payload
 * @returns {string}
 */
function formatWhatsAppMessage(payload) {
	const now = new Date();

	const timestamp = now.toLocaleString("en-GB", {
		timeZone: "Africa/Lagos",
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	}).replace(",", "");

	const lines = [
		"*NEW MODEINFINITY INQUIRY*",
		"",
		`*Name:*  ${payload.name || "\u2014"}`,
		`*Email:* ${payload.email || "\u2014"}`
	];

	if (payload.telephone) {
		lines.push(`*Phone:* ${payload.telephone}`);
	}

	if (payload.inquiry_type) {
		lines.push(`*Enquiry type:* ${payload.inquiry_type}`);
	}

	if (payload.program_type && String(payload.program_type).trim()) {
		lines.push(`*Program interest:* ${payload.program_type}`);
	}

	if (payload.custom_subject && String(payload.custom_subject).trim()) {
		lines.push(`*Reference code:* ${payload.custom_subject}`);
	}

	if (payload.order_reference && String(payload.order_reference).trim()) {
		lines.push(`*Order reference:* ${payload.order_reference}`);
	}

	if (payload.message) {
		lines.push("", "*Message:*", payload.message);
	}

	lines.push(
		"",
		"---",
		`*Submitted:* ${timestamp}`,
		`*Email to ModeInfinity:* yes`,
		`*Sender copy:* ${payload.email || "sender"} (check spam if missing)`,
		`*WhatsApp:* +${WHATSAPP_NUMBER}`
	);

	return lines.join("\n");
}


/**
 * Build a wa.me URL for a form payload.
 *
 * @param {Object} payload
 * @returns {string}
 */
function buildWhatsAppUrl(payload) {
	return (
		"https://wa.me/" +
		WHATSAPP_NUMBER +
		"?text=" +
		encodeURIComponent(formatWhatsAppMessage(payload))
	);
}


/**
 * Open the WhatsApp URL in a new tab.
 *
 * Uses a temporary anchor element rather than window.open()
 * because anchor.click() survives most popup blockers when
 * called from an async callback.
 *
 * @param {string} url
 * @returns {boolean} true if the click was dispatched
 */
function openWhatsAppHandoff(url) {
	if (typeof url !== "string" || !url) {
		return false;
	}

	try {
		const link = document.createElement("a");

		link.href = url;
		link.target = "_blank";
		link.rel = "noopener noreferrer";
		link.style.display = "none";

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		return true;
	} catch (error) {
		console.error(
			"[ModeInfinity] WhatsApp handoff failed:",
			error
		);

		return false;
	}
}


/* ============================================================
   16. EMAIL PAYLOAD
   ============================================================
   Formspree magic fields:
     _replyto  → owner's "Reply" button goes to the sender
     _cc       → sender receives a copy of the notification
     _subject  → nice subject in the owner inbox

   data-sender-copy attribute:
     "cc"   (default) → add _cc (works on free plan)
     "none"            → omit _cc (use when Formspree
                         Autoresponse is enabled, to avoid
                         sending the sender two emails)
   ============================================================ */

/**
 * Wrap a raw payload with Formspree magic fields.
 *
 * @param {HTMLFormElement} form
 * @param {Object} payload
 * @returns {Object}
 */
function buildEmailBody(form, payload) {
	const body = {
		...payload,
		_subject:
			"ModeInfinity \u2014 " +
			(payload.inquiry_type || "Website enquiry")
	};

	if (payload.email) {
		body._replyto = payload.email;

		const senderCopyMode = form.dataset.senderCopy || "cc";

		if (senderCopyMode === "cc") {
			body._cc = payload.email;
		}
	}

	return body;
}


/* ============================================================
   17. NETWORK SUBMISSION
   ============================================================ */

/**
 * Extract a human-readable message from a backend error body.
 *
 * Handles shapes commonly returned by Formspree, JSON APIs,
 * and plain-text responses.
 *
 * @param {*} responseData
 * @param {number} status
 * @returns {string}
 */
function extractServerMessage(
	responseData,
	status
) {
	if (responseData && typeof responseData === "object") {
		if (
			typeof responseData.message === "string" &&
			responseData.message.trim()
		) {
			return responseData.message.trim();
		}

		if (
			typeof responseData.error === "string" &&
			responseData.error.trim()
		) {
			return responseData.error.trim();
		}

		if (
			Array.isArray(responseData.errors) &&
			responseData.errors.length > 0
		) {
			const joined =
				responseData.errors
				.map((entry) =>
					entry &&
					typeof entry.message === "string" ?
					entry.message.trim() :
					""
				)
				.filter(Boolean)
				.join(" ");

			if (joined) {
				return joined;
			}
		}
	}

	return `Request failed with status ${status}.`;
}


/**
 * Submit form data to the configured backend endpoint.
 *
 * @param {HTMLFormElement} form
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function submitToEndpoint(
	form,
	payload
) {
	const endpoint =
		getEndpoint(form);

	if (!endpoint) {
		return {
			submitted: false,
			configured: false
		};
	}

	const {
		controller,
		timeoutId
	} =
	createRequestTimeout(
		CONFIG.requestTimeout
	);

	try {
		const response =
			await fetch(
				endpoint, {
					method: form.method?.toUpperCase() ||
						"POST",

					headers: {
						"Content-Type": "application/json",
						"Accept": "application/json"
					},

					body: JSON.stringify(
						buildEmailBody(form, payload)
					),

					credentials: "same-origin",

					signal: controller.signal
				}
			);

		let responseData =
			null;

		const contentType =
			response.headers.get(
				"content-type"
			) || "";

		if (
			contentType.includes(
				"application/json"
			)
		) {
			responseData =
				await response.json();
		} else {
			responseData =
				await response.text();
		}

		if (!response.ok) {
			throw new Error(
				extractServerMessage(
					responseData,
					response.status
				)
			);
		}

		return {
			submitted: true,
			configured: true,
			data: responseData
		};
	} finally {
		window.clearTimeout(
			timeoutId
		);
	}
}


/* ============================================================
   18. FORM VALIDATION
   ============================================================ */

/**
 * Validate a form.
 *
 * @param {HTMLFormElement} form
 * @returns {{valid: boolean, errors: Array}}
 */
function validateCurrentForm(form) {
	const rules =
		buildValidationRules(
			form
		);

	/*
	 * A form without configured validation rules is still
	 * considered valid.
	 */
	if (
		!Object.keys(rules).length
	) {
		return {
			valid: true,
			errors: []
		};
	}

	return validateForm(
		form,
		rules
	);
}


/* ============================================================
   19. SUCCESS HANDLING
   ============================================================ */

/**
 * Handle successful form submission.
 *
 * Order of operations:
 *   1. Set form status + toast.
 *   2. Reset the form and its field state.
 *   3. Dispatch "form:success" with payload + whatsappUrl.
 *      The page controller uses this to open the success
 *      modal and render the "Open WhatsApp" button.
 *   4. If the form opted into WhatsApp (data-whatsapp="true"),
 *      open the pre-filled WhatsApp chat in a new tab. This
 *      happens AFTER dispatch so the modal DOM is already
 *      visible when the new tab appears — the visitor's
 *      current tab keeps focus.
 *
 * @param {HTMLFormElement} form
 * @param {Object} response
 * @param {Object|null} payload
 */
function handleSuccess(
	form,
	response,
	payload = null
) {
	const message =
		response?.data &&
		typeof response.data === "object" &&
		typeof response.data.message === "string" &&
		response.data.message.trim() ?
		response.data.message.trim() :
		form.dataset.successMessage ||
		CONFIG.successMessage;

	setFormStatus(
		form,
		"success",
		message
	);

	notify({
		type: "success",
		title: form.dataset.successTitle ||
			CONFIG.successTitle,
		message
	});

	form.reset();

	/*
	 * Full reset of state that formhandler owns:
	 *   - aria-invalid flags (validators.js sets these)
	 *   - error message nodes (validators.js injects these)
	 *   - aria-describedby references to those nodes
	 *   - floating-label has-value on selects
	 */
	const controls =
		form.querySelectorAll(
			"input, select, textarea"
		);

	controls.forEach(
		(control) => {
			clearFieldError(control);
			updateFieldState(control);
		}
	);

	const detail = {
		message,
		response,
		payload
	};

	/*
	 * Build the WhatsApp URL only when:
	 *   - the form opted in via data-whatsapp="true"
	 *   - we actually have the sender's email (needed in
	 *     the pre-filled message)
	 */
	const wantsWhatsApp =
		form.dataset.whatsapp === "true";

	if (
		wantsWhatsApp &&
		payload &&
		typeof payload === "object" &&
		payload.email
	) {
		detail.whatsappUrl = buildWhatsAppUrl(payload);
	}

	dispatchFormEvent("success", form, detail);

	/*
	 * Open WhatsApp after the event, so the page controller
	 * has already shown the success modal. The visitor stays
	 * on the modal tab; WhatsApp opens in a background tab.
	 */
	if (detail.whatsappUrl) {
		openWhatsAppHandoff(detail.whatsappUrl);
	}
}


/* ============================================================
   20. ERROR HANDLING
   ============================================================ */

/**
 * Handle failed form submission.
 *
 * @param {HTMLFormElement} form
 * @param {Error} error
 */
function handleError(
	form,
	error
) {
	const message =
		form.dataset.errorMessage ||
		CONFIG.errorMessage;

	setFormStatus(
		form,
		"error",
		message
	);

	notify({
		type: "error",
		title: form.dataset.errorTitle ||
			CONFIG.errorTitle,
		message
	});

	console.error(
		"ModeInfinity form submission failed:",
		error
	);

	dispatchFormEvent("error", form, {
		error,
		serverMessage: error?.message || ""
	});
}


/* ============================================================
   21. LOCAL / UNCONFIGURED FORMS
   ============================================================ */

/**
 * Handle a form that does not have a backend endpoint yet.
 *
 * The form does not pretend that an email or order has been
 * sent. Instead, the interface clearly communicates that the
 * backend connection is not configured.
 *
 * @param {HTMLFormElement} form
 * @param {Object} payload
 */
function handleUnconfiguredForm(
	form,
	payload
) {
	const formName =
		form.dataset.form ||
		"form";

	/*
	 * Prevent unused-payload warnings while keeping the
	 * structure ready for backend integration.
	 */
	void payload;

	const message =
		form.dataset.pendingMessage ||
		`The ${formName} form is ready, but its backend submission endpoint has not been configured yet.`;

	setFormStatus(
		form,
		"info",
		message
	);

	notify({
		type: "info",
		title: "Backend connection pending",
		message
	});
}


/* ============================================================
   22. FORM SUBMISSION
   ============================================================ */

/**
 * Process a form submission.
 *
 * @param {SubmitEvent} event
 */
async function handleSubmit(
	event
) {
	const form =
		event.currentTarget;

	if (
		!(form instanceof HTMLFormElement)
	) {
		return;
	}

	/*
	 * Stop duplicate submissions.
	 */
	if (isSubmitting(form)) {
		event.preventDefault();

		return;
	}

	const validation =
		validateCurrentForm(
			form
		);

	clearFormStatus(form);

	if (!validation.valid) {
		event.preventDefault();

		focusFirstError(
			validation.errors
		);

		setFormStatus(
			form,
			"error",
			"Please correct the highlighted fields and try again."
		);

		notify({
			type: "error",
			title: "Check your information",
			message: "Please correct the highlighted fields and try again."
		});

		dispatchFormEvent("invalid", form, {
			errors: validation.errors
		});

		return;
	}

	/*
	 * If no endpoint exists, prevent native submission and
	 * clearly identify the missing backend.
	 */
	const endpoint =
		getEndpoint(form);

	if (!endpoint) {
		event.preventDefault();

		const payload =
			collectFormData(form);

		handleUnconfiguredForm(
			form,
			payload
		);

		return;
	}

	event.preventDefault();

	setSubmitting(form);
	setSubmitButtonState(
		form,
		true
	);

	try {
		const payload =
			collectFormData(form);

		const response =
			await submitToEndpoint(
				form,
				payload
			);

		handleSuccess(
			form,
			response,
			payload
		);
	} catch (error) {
		handleError(
			form,
			error
		);
	} finally {
		clearSubmitting(form);

		setSubmitButtonState(
			form,
			false
		);
	}
}


/* ============================================================
   23. LIVE VALIDATION
   ============================================================ */

/**
 * Validate a field after the user has interacted with it.
 *
 * @param {Event} event
 */
function handleFieldBlur(event) {
	const field =
		event.currentTarget;

	if (
		!(field instanceof HTMLElement) ||
		!(field instanceof HTMLInputElement ||
			field instanceof HTMLSelectElement ||
			field instanceof HTMLTextAreaElement)
	) {
		return;
	}

	const rules =
		getFieldRules(
			field
		);

	if (!rules.length) {
		return;
	}

	const temporaryForm =
		field.form;

	if (!temporaryForm) {
		return;
	}

	const result =
		validateForm(
			temporaryForm, {
				[field.name]: rules
			}
		);

	/*
	 * Only modify this field's state. Other form errors should
	 * remain untouched.
	 */
	if (result.valid) {
		clearFieldError(field);

		return;
	}

	if (
		result.errors.length
	) {
		field.setAttribute(
			"aria-invalid",
			"true"
		);

		/*
		 * validateForm already creates the accessible error
		 * element through the validation module.
		 */
	}
}


/* ============================================================
   24. CLEAR VALIDATION ERROR ON INPUT
   ============================================================ */

/**
 * Remove a field's visual error indicator once the user starts
 * correcting the value.
 *
 * @param {Event} event
 */
function handleFieldInput(event) {
	const field =
		event.currentTarget;

	if (
		!(field instanceof HTMLElement)
	) {
		return;
	}

	updateFieldState(field);

	if (
		field.getAttribute(
			"aria-invalid"
		) !== "true"
	) {
		return;
	}

	clearFieldError(field);
}


/* ============================================================
   25. FORM EVENT BINDING
   ============================================================ */

/**
 * Bind events for one form.
 *
 * @param {HTMLFormElement} form
 */
function bindForm(form) {
	if (!(form instanceof HTMLFormElement)) {
		return;
	}

	on(
		form,
		"submit",
		handleSubmit
	);

	const fields =
		form.querySelectorAll(
			"input, select, textarea"
		);

	fields.forEach(
		(field) => {
			on(
				field,
				"blur",
				handleFieldBlur
			);

			on(
				field,
				"input",
				handleFieldInput
			);

			on(
				field,
				"change",
				handleFieldInput
			);

			/*
			 * Set the initial has-value state so a select
			 * with a preselected option shows its label
			 * lifted on first paint.
			 */
			updateFieldState(field);
		}
	);
}


/* ============================================================
   26. INITIALIZATION
   ============================================================ */

/**
 * Initialize all forms on the page.
 */
export function initFormHandler() {
	if (state.initialized) {
		return;
	}

	const forms =
		$$(CONFIG.formSelector)
		.filter(
			(form) =>
			form instanceof HTMLFormElement
		);

	forms.forEach(
		bindForm
	);

	state.initialized = true;
}


/* ============================================================
   27. PUBLIC API
   ============================================================ */

export const formHandler =
	Object.freeze({
		init: initFormHandler,

		collect: collectFormData
	});


export default formHandler;


/* ============================================================
   28. AUTOMATIC INITIALIZATION
   ============================================================ */

// onDOMReady(
// 	initFormHandler
// );
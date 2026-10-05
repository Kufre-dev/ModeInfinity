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

import {
    $$,
    $,
    on,
    escapeHTML,
    onDOMReady
} from "./helpers.js";

import {
	validateForm,
	focusFirstError
} from "./validators.js";


/* ============================================================
   2. CONFIGURATION
   ============================================================ */

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
   6. FORM VALIDATION RULE PARSING
   ============================================================ */

/**
 * Parse validation rules supplied through data attributes.
 *
 * Examples:
 *
 * data-validate="required,email"
 *
 * data-min-length="10"
 *
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
					rules.push({
						type: "required"
					});
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
   7. FIELD RULE COLLECTION
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
   8. FORM DATA COLLECTION
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
   9. SUBMIT BUTTON
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
   10. FORM STATUS
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
   11. TOAST BRIDGE
   ============================================================ */

/**
 * Show a notification through the global toast component
 * when it exists.
 *
 * This uses a browser event so formhandler.js does not need
 * to directly own the global toast implementation.
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


/* ============================================================
   12. REQUEST TIMEOUT
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
   13. BACKEND ENDPOINT
   ============================================================ */

/**
 * Read a form's configured endpoint.
 *
 * Supported:
 *
 * <form
 *     data-form="contact"
 *     data-endpoint="/api/contact"
 * >
 *
 * No endpoint means the form is not submitted to a server yet.
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
   14. NETWORK SUBMISSION
   ============================================================ */

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
						payload
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
			const serverMessage =
				responseData &&
				typeof responseData === "object" &&
				typeof responseData.message === "string" ?
				responseData.message :
				"";

			throw new Error(
				serverMessage ||
				`Request failed with status ${response.status}.`
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
   15. FORM VALIDATION
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
   16. SUCCESS HANDLING
   ============================================================ */

/**
 * Handle successful form submission.
 *
 * @param {HTMLFormElement} form
 * @param {Object} response
 */
function handleSuccess(
	form,
	response
) {
	const message =
		response?.data &&
		typeof response.data === "object" &&
		typeof response.data.message === "string" ?
		response.data.message :
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
	 * Reset fields that may still contain an explicit
	 * accessibility error state.
	 */
	const controls =
		form.querySelectorAll(
			"input, select, textarea"
		);

	controls.forEach(
		(control) => {
			control.removeAttribute(
				"aria-invalid"
			);
		}
	);
}


/* ============================================================
   17. ERROR HANDLING
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
}


/* ============================================================
   18. LOCAL / UNCONFIGURED FORMS
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
   19. FORM SUBMISSION
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

		return;
	}

	/*
	 * If no endpoint exists, keep native behavior only when
	 * explicitly requested. Otherwise prevent the browser
	 * navigation and clearly identify the missing backend.
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
			response
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
   20. LIVE VALIDATION
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
		field.removeAttribute(
			"aria-invalid"
		);

		const errorElement =
			document.getElementById(
				`${field.id || field.name}-error`
			);

		if (errorElement) {
			errorElement.remove();
		}

		return;
	}

	if (
		result.errors.length
	) {
		const firstError =
			result.errors[0];

		field.setAttribute(
			"aria-invalid",
			"true"
		);

		/*
		 * validateForm already creates the accessible error
		 * element through the validation module.
		 */
		void firstError;
	}
}


/* ============================================================
   21. CLEAR VALIDATION ERROR ON INPUT
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

	if (
		field.getAttribute(
			"aria-invalid"
		) !== "true"
	) {
		return;
	}

	field.removeAttribute(
		"aria-invalid"
	);

	const errorId =
		`${field.id || field.name}-error`;

	const errorElement =
		document.getElementById(
			errorId
		);

	if (errorElement) {
		errorElement.remove();
	}
}


/* ============================================================
   22. FORM EVENT BINDING
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
		}
	);
}


/* ============================================================
   23. TOAST EVENT BRIDGE
   ============================================================ */

/**
 * This bridge is intentionally small.
 *
 * main.js owns the global toast implementation. When
 * formhandler.js dispatches "modeinfinity:toast", main.js can
 * listen and forward the data to its toast controller.
 *
 * If main.js is not yet connected on a page, the event simply
 * has no consumer and the visible form status still works.
 */
function initializeToastBridge() {
	/*
	 * No listener is required here.
	 *
	 * CustomEvent dispatching in notify() is enough to keep the
	 * form module decoupled from the global notification UI.
	 */
}


/* ============================================================
   24. INITIALIZATION
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

	initializeToastBridge();

	state.initialized = true;
}


/* ============================================================
   25. PUBLIC API
   ============================================================ */

export const formHandler =
	Object.freeze({
		init: initFormHandler,

		collect: collectFormData
	});


export default formHandler;


/* ============================================================
   26. AUTOMATIC INITIALIZATION
   ============================================================ */

// onDOMReady(
// 	initFormHandler
// );
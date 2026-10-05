/* ============================================================
   MODEINFINITY — FORM VALIDATORS
   ============================================================

   Reusable client-side validation utilities.

   Used by:
   - scripts/formhandler.js
   - scripts/main.js
   - Future form modules

   Responsibilities:
   - Required-field validation
   - Email validation
   - Telephone validation
   - Minimum / maximum length validation
   - Numeric validation
   - Select validation
   - Checkbox validation
   - Multiple-rule validation
   - Field error message generation
   - Form-level validation
   - Accessible validation state support

   Principles:
   - Client-side validation improves user experience.
   - Server-side validation remains mandatory when a backend
     is implemented.
   - Validation messages must be clear and specific.
   - Never rely on color alone to communicate errors.
   - Never trust client-side validation for security.
   ============================================================ */


/* ============================================================
   1. VALIDATION CONSTANTS
   ============================================================ */

/**
 * General validation messages.
 */
export const VALIDATION_MESSAGES = Object.freeze({
	required: "This field is required.",
	email: "Enter a valid email address.",
	phone: "Enter a valid phone number.",
	minLength: "This field is too short.",
	maxLength: "This field is too long.",
	number: "Enter a valid number.",
	integer: "Enter a whole number.",
	positive: "Enter a value greater than zero.",
	pattern: "Enter a valid value.",
	select: "Select an option.",
	checkbox: "This field must be selected.",
	match: "The values do not match.",
	url: "Enter a valid URL."
});


/* ============================================================
   2. BASIC VALUE HELPERS
   ============================================================ */

/**
 * Convert an input value to a trimmed string.
 *
 * @param {*} value
 * @returns {string}
 */
export function normalizeValue(value) {
	if (
		value === null ||
		value === undefined
	) {
		return "";
	}

	return String(value).trim();
}


/**
 * Determine whether a value is empty.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isEmpty(value) {
	return normalizeValue(value).length === 0;
}


/**
 * Determine whether an element is a form control.
 *
 * @param {*} element
 * @returns {boolean}
 */
export function isFormControl(element) {
	if (!(element instanceof HTMLElement)) {
		return false;
	}

	return (
		element instanceof HTMLInputElement ||
		element instanceof HTMLSelectElement ||
		element instanceof HTMLTextAreaElement
	);
}


/* ============================================================
   3. REQUIRED VALIDATION
   ============================================================ */

/**
 * Validate that a field contains a value.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function validateRequired(value) {
	return !isEmpty(value);
}


/**
 * Validate a checkbox.
 *
 * @param {HTMLInputElement|null} input
 * @returns {boolean}
 */
export function validateCheckbox(input) {
	if (!(input instanceof HTMLInputElement)) {
		return false;
	}

	return input.checked;
}


/* ============================================================
   4. EMAIL VALIDATION
   ============================================================ */

/**
 * Validate an email address.
 *
 * This is intentionally practical rather than attempting to
 * implement the entire RFC email grammar.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function validateEmail(value) {
	const email = normalizeValue(value);

	if (!email) {
		return false;
	}

	const emailPattern =
		/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

	return emailPattern.test(email);
}


/* ============================================================
   5. PHONE VALIDATION
   ============================================================ */

/**
 * Validate a telephone number.
 *
 * Allows:
 * - International prefixes
 * - Spaces
 * - Parentheses
 * - Hyphens
 *
 * @param {*} value
 * @returns {boolean}
 */
export function validatePhone(value) {
	const phone = normalizeValue(value);

	if (!phone) {
		return false;
	}

	const digits =
		phone.replace(/\D/g, "");

	return (
		digits.length >= 7 &&
		digits.length <= 15
	);
}


/* ============================================================
   6. LENGTH VALIDATION
   ============================================================ */

/**
 * Validate minimum string length.
 *
 * @param {*} value
 * @param {number} minimum
 * @returns {boolean}
 */
export function validateMinLength(
	value,
	minimum
) {
	const text = normalizeValue(value);

	const limit =
		Number.isFinite(minimum) ?
		minimum :
		0;

	return text.length >= limit;
}


/**
 * Validate maximum string length.
 *
 * @param {*} value
 * @param {number} maximum
 * @returns {boolean}
 */
export function validateMaxLength(
	value,
	maximum
) {
	const text = normalizeValue(value);

	const limit =
		Number.isFinite(maximum) ?
		maximum :
		Number.MAX_SAFE_INTEGER;

	return text.length <= limit;
}


/* ============================================================
   7. NUMERIC VALIDATION
   ============================================================ */

/**
 * Convert a value to a numeric candidate.
 *
 * @param {*} value
 * @returns {number}
 */
export function parseNumber(value) {
	const normalized =
		normalizeValue(value)
		.replace(/,/g, "");

	const number =
		Number(normalized);

	return number;
}


/**
 * Validate a number.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function validateNumber(value) {
	if (isEmpty(value)) {
		return false;
	}

	return Number.isFinite(
		parseNumber(value)
	);
}


/**
 * Validate an integer.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function validateInteger(value) {
	if (!validateNumber(value)) {
		return false;
	}

	return Number.isInteger(
		parseNumber(value)
	);
}


/**
 * Validate a positive number.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function validatePositiveNumber(value) {
	if (!validateNumber(value)) {
		return false;
	}

	return parseNumber(value) > 0;
}


/* ============================================================
   8. SELECT VALIDATION
   ============================================================ */

/**
 * Validate that a select has a meaningful selected value.
 *
 * @param {HTMLSelectElement|null} select
 * @returns {boolean}
 */
export function validateSelect(select) {
	if (!(select instanceof HTMLSelectElement)) {
		return false;
	}

	return !isEmpty(select.value);
}


/* ============================================================
   9. URL VALIDATION
   ============================================================ */

/**
 * Validate a URL.
 *
 * @param {*} value
 * @param {Object} [options]
 * @param {boolean} [options.requireHttp=true]
 * @returns {boolean}
 */
export function validateURL(
	value, {
		requireHttp = true
	} = {}
) {
	const url = normalizeValue(value);

	if (!url) {
		return false;
	}

	try {
		const parsedURL =
			new URL(url);

		if (!requireHttp) {
			return true;
		}

		return (
			parsedURL.protocol === "http:" ||
			parsedURL.protocol === "https:"
		);
	} catch {
		return false;
	}
}


/* ============================================================
   10. PATTERN VALIDATION
   ============================================================ */

/**
 * Validate against a regular expression.
 *
 * @param {*} value
 * @param {RegExp} pattern
 * @returns {boolean}
 */
export function validatePattern(
	value,
	pattern
) {
	if (!(pattern instanceof RegExp)) {
		return false;
	}

	return pattern.test(
		normalizeValue(value)
	);
}


/* ============================================================
   11. COMPARISON VALIDATION
   ============================================================ */

/**
 * Check whether two values match.
 *
 * @param {*} firstValue
 * @param {*} secondValue
 * @returns {boolean}
 */
export function validateMatch(
	firstValue,
	secondValue
) {
	return (
		normalizeValue(firstValue) ===
		normalizeValue(secondValue)
	);
}


/* ============================================================
   12. SINGLE RULE VALIDATION
   ============================================================ */

/**
 * Validate a value using a rule.
 *
 * Supported rules:
 * - required
 * - email
 * - phone
 * - minLength
 * - maxLength
 * - number
 * - integer
 * - positive
 * - url
 * - pattern
 * - match
 * - checkbox
 * - select
 *
 * @param {*} value
 * @param {Object} rule
 * @returns {{valid: boolean, message: string}}
 */
export function validateRule(
	value,
	rule = {}
) {
	const {
		type,
		message,
		minimum,
		maximum,
		pattern,
		comparisonValue
	} = rule;

	let valid = true;
	let defaultMessage =
		VALIDATION_MESSAGES.pattern;

	switch (type) {
		case "required":
			valid =
				validateRequired(value);
			defaultMessage =
				VALIDATION_MESSAGES.required;
			break;

		case "email":
			valid =
				validateEmail(value);
			defaultMessage =
				VALIDATION_MESSAGES.email;
			break;

		case "phone":
			valid =
				validatePhone(value);
			defaultMessage =
				VALIDATION_MESSAGES.phone;
			break;

		case "minLength":
			valid =
				validateMinLength(
					value,
					minimum
				);
			defaultMessage =
				`${VALIDATION_MESSAGES.minLength} Minimum ${minimum} characters.`;
			break;

		case "maxLength":
			valid =
				validateMaxLength(
					value,
					maximum
				);
			defaultMessage =
				`${VALIDATION_MESSAGES.maxLength} Maximum ${maximum} characters.`;
			break;

		case "number":
			valid =
				validateNumber(value);
			defaultMessage =
				VALIDATION_MESSAGES.number;
			break;

		case "integer":
			valid =
				validateInteger(value);
			defaultMessage =
				VALIDATION_MESSAGES.integer;
			break;

		case "positive":
			valid =
				validatePositiveNumber(value);
			defaultMessage =
				VALIDATION_MESSAGES.positive;
			break;

		case "url":
			valid =
				validateURL(value);
			defaultMessage =
				VALIDATION_MESSAGES.url;
			break;

		case "pattern":
			valid =
				validatePattern(
					value,
					pattern
				);
			defaultMessage =
				VALIDATION_MESSAGES.pattern;
			break;

		case "match":
			valid =
				validateMatch(
					value,
					comparisonValue
				);
			defaultMessage =
				VALIDATION_MESSAGES.match;
			break;

		case "checkbox":
			valid =
				Boolean(value);
			defaultMessage =
				VALIDATION_MESSAGES.checkbox;
			break;

		case "select":
			valid = !isEmpty(value);
			defaultMessage =
				VALIDATION_MESSAGES.select;
			break;

		default:
			valid = true;
			defaultMessage = "";
	}

	return {
		valid,
		message: valid ?
			"" :
			(
				typeof message === "string" &&
				message.trim()
			) ?
			message.trim() :
			defaultMessage
	};
}


/* ============================================================
   13. MULTIPLE RULE VALIDATION
   ============================================================ */

/**
 * Validate a value against multiple rules.
 *
 * The first failing rule determines the error message.
 *
 * @param {*} value
 * @param {Object[]} rules
 * @returns {{valid: boolean, message: string}}
 */
export function validateRules(
	value,
	rules = []
) {
	if (!Array.isArray(rules)) {
		return {
			valid: true,
			message: ""
		};
	}

	for (const rule of rules) {
		const result =
			validateRule(
				value,
				rule
			);

		if (!result.valid) {
			return result;
		}
	}

	return {
		valid: true,
		message: ""
	};
}


/* ============================================================
   14. FIELD CONFIGURATION
   ============================================================ */

/**
 * Determine the field value correctly according to its type.
 *
 * @param {HTMLElement} field
 * @returns {*}
 */
export function getFieldValue(field) {
	if (!(field instanceof HTMLElement)) {
		return "";
	}

	if (
		field instanceof HTMLInputElement &&
		field.type === "checkbox"
	) {
		return field.checked;
	}

	if (
		field instanceof HTMLInputElement &&
		field.type === "radio"
	) {
		return field.checked ?
			field.value :
			"";
	}

	return field.value;
}


/**
 * Validate a single form field.
 *
 * @param {HTMLElement|null} field
 * @param {Object[]} rules
 * @returns {{valid: boolean, message: string, field: HTMLElement|null}}
 */
export function validateField(
	field,
	rules = []
) {
	if (!isFormControl(field)) {
		return {
			valid: false,
			message: "Invalid form field.",
			field: null
		};
	}

	const value =
		getFieldValue(field);

	const result =
		validateRules(
			value,
			rules
		);

	return {
		...result,
		field
	};
}


/* ============================================================
   15. FIELD ERROR STATE
   ============================================================ */

/**
 * Generate a stable error element ID for a field.
 *
 * @param {HTMLElement} field
 * @returns {string}
 */
export function getErrorId(field) {
	if (!isFormControl(field)) {
		return "";
	}

	const fieldId =
		field.id ||
		field.name ||
		"field";

	return `${fieldId}-error`;
}


/**
 * Apply an accessible error state to a field.
 *
 * @param {HTMLElement|null} field
 * @param {string} message
 */
export function setFieldError(
	field,
	message
) {
	if (!isFormControl(field)) {
		return;
	}

	const errorMessage =
		normalizeValue(message);

	const errorId =
		getErrorId(field);

	field.setAttribute(
		"aria-invalid",
		"true"
	);

	if (errorId) {
		const existingDescribedBy =
			normalizeValue(
				field.getAttribute(
					"aria-describedby"
				)
			);

		const describedByIds =
			existingDescribedBy ?
			existingDescribedBy.split(/\s+/) :
			[];

		if (
			!describedByIds.includes(
				errorId
			)
		) {
			describedByIds.push(
				errorId
			);
		}

		field.setAttribute(
			"aria-describedby",
			describedByIds.join(" ")
		);

		let errorElement =
			document.getElementById(
				errorId
			);

		if (!errorElement) {
			errorElement =
				document.createElement(
					"p"
				);

			errorElement.id =
				errorId;

			errorElement.className =
				"form-error";

			errorElement.setAttribute(
				"role",
				"alert"
			);

			field.insertAdjacentElement(
				"afterend",
				errorElement
			);
		}

		errorElement.textContent =
			errorMessage;
	}
}


/**
 * Clear an accessible error state.
 *
 * @param {HTMLElement|null} field
 */
export function clearFieldError(field) {
	if (!isFormControl(field)) {
		return;
	}

	const errorId =
		getErrorId(field);

	field.removeAttribute(
		"aria-invalid"
	);

	if (errorId) {
		const describedBy =
			field.getAttribute(
				"aria-describedby"
			);

		if (describedBy) {
			const remainingIds =
				describedBy
				.split(/\s+/)
				.filter(
					(id) =>
					id !== errorId
				);

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

		const errorElement =
			document.getElementById(
				errorId
			);

		if (errorElement) {
			errorElement.remove();
		}
	}
}


/* ============================================================
   16. FORM VALIDATION
   ============================================================ */

/**
 * Validate a form using a field-rules configuration.
 *
 * Example:
 *
 * validateForm(form, {
 *     name: [
 *         { type: "required" },
 *         { type: "minLength", minimum: 2 }
 *     ],
 *     email: [
 *         { type: "required" },
 *         { type: "email" }
 *     ]
 * });
 *
 * @param {HTMLFormElement|null} form
 * @param {Object} fieldRules
 * @returns {{
 *     valid: boolean,
 *     errors: Array<{
 *         field: HTMLElement,
 *         message: string
 *     }>
 * }}
 */
export function validateForm(
	form,
	fieldRules = {}
) {
	if (!(form instanceof HTMLFormElement)) {
		return {
			valid: false,
			errors: []
		};
	}

	const errors = [];

	for (
		const [
			fieldName,
			rules
		] of Object.entries(fieldRules)
	) {
		const selector =
			`[name="${CSS.escape(fieldName)}"]`;

		const field =
			form.querySelector(
				selector
			);

		if (!field) {
			continue;
		}

		const result =
			validateField(
				field,
				rules
			);

		if (result.valid) {
			clearFieldError(field);
		} else {
			setFieldError(
				field,
				result.message
			);

			errors.push({
				field,
				message: result.message
			});
		}
	}

	return {
		valid: errors.length === 0,
		errors
	};
}


/* ============================================================
   17. FIRST INVALID FIELD
   ============================================================ */

/**
 * Focus the first invalid field in a validation result.
 *
 * @param {Array} errors
 */
export function focusFirstError(
	errors = []
) {
	if (!Array.isArray(errors) || !errors.length) {
		return;
	}

	const firstError =
		errors[0];

	if (
		!firstError ||
		!(firstError.field instanceof HTMLElement)
	) {
		return;
	}

	firstError.field.focus();
}


/* ============================================================
   18. EXPORT DEFAULT
   ============================================================ */

export default {
	VALIDATION_MESSAGES,

	normalizeValue,
	isEmpty,
	isFormControl,

	validateRequired,
	validateCheckbox,

	validateEmail,
	validatePhone,

	validateMinLength,
	validateMaxLength,

	parseNumber,
	validateNumber,
	validateInteger,
	validatePositiveNumber,

	validateSelect,
	validateURL,
	validatePattern,
	validateMatch,

	validateRule,
	validateRules,

	getFieldValue,
	validateField,

	getErrorId,
	setFieldError,
	clearFieldError,

	validateForm,
	focusFirstError
};
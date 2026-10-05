import {
	$,
	addClass,
	removeClass,
	setExpanded,
	setAriaHidden,
	focusElement,
	getStorage,
	setStorage,
	removeStorage,
	escapeHTML,
	toNumber,
	formatNaira
} from "./helpers.js";
const STORAGE_KEY = "modeinfinity_cart";
const PRODUCT_DATA_URL = new URL("../data/shoes.json", import.meta.url).href;
const MAX_CART_ITEM_QUANTITY = 99;
const DEFAULT_HOME_PRODUCT_LIMIT = 4;
const SELECTORS = Object.freeze({
	cartButtons: "[data-cart-open]",
	cartCount: "#cart-count",
	cartDrawer: "#cart-drawer",
	cartDrawerPanel: ".cart-drawer__panel",
	cartBackdrop: "#cart-drawer-backdrop",
	cartClose: "#cart-drawer-close",
	cartStatus: "#cart-status",
	cartEmptyState: "#cart-empty-state",
	cartItemsSection: "#cart-items-section",
	cartItems: "#cart-items",
	cartFooter: "#cart-drawer-footer",
	cartSubtotal: "#cart-subtotal",
	productCards: "[data-product-id]",
	addToCart: "[data-add-to-cart]",
	quantityControl: "[data-cart-quantity]",
	increaseQuantity: "[data-cart-increase]",
	decreaseQuantity: "[data-cart-decrease]",
	removeFromCart: "[data-cart-remove]",
	homeProducts: "[data-home-products]"
});
const state = {
	initialized: false,
	cartOpen: false,
	cart: [],
	products: [],
	productsLoaded: false,
	previouslyFocusedElement: null
};
let elements = {
	cartButtons: [],
	cartCount: null,
	cartDrawer: null,
	cartDrawerPanel: null,
	cartBackdrop: null,
	cartClose: null,
	cartStatus: null,
	cartEmptyState: null,
	cartItemsSection: null,
	cartItems: null,
	cartFooter: null,
	cartSubtotal: null,
	homeProducts: null
};
let eventController = null;

function cacheElements() {
	elements.cartButtons = Array.from(document.querySelectorAll(SELECTORS.cartButtons));
	elements.cartCount = $(SELECTORS.cartCount);
	elements.cartDrawer = $(SELECTORS.cartDrawer);
	elements.cartDrawerPanel = $(SELECTORS.cartDrawerPanel);
	elements.cartBackdrop = $(SELECTORS.cartBackdrop);
	elements.cartClose = $(SELECTORS.cartClose);
	elements.cartStatus = $(SELECTORS.cartStatus);
	elements.cartEmptyState = $(SELECTORS.cartEmptyState);
	elements.cartItemsSection = $(SELECTORS.cartItemsSection);
	elements.cartItems = $(SELECTORS.cartItems);
	elements.cartFooter = $(SELECTORS.cartFooter);
	elements.cartSubtotal = $(SELECTORS.cartSubtotal);
	elements.homeProducts = $(SELECTORS.homeProducts);
}

function normalizeProductId(value) {
	if (value === null || value === undefined) {
		return "";
	}
	return String(value).trim();
}

function toBoolean(value, fallback = false) {
	if (value === undefined || value === null) {
		return fallback;
	}
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "number") {
		return value !== 0;
	}
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (
			["true", "yes", "1", "active", "available", "featured"].includes(normalized)) {
			return true;
		}
		if (
			["false", "no", "0", "inactive", "unavailable"].includes(normalized)) {
			return false;
		}
	}
	return fallback;
}

function normalizeString(value, fallback = "") {
	if (typeof value !== "string") {
		return fallback;
	}
	return value.trim();
}

function normalizeStringArray(value) {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.map(item => typeof item === "string" ? item.trim() : String(item ?? "").trim()).filter(Boolean);
}

function normalizeProductImages(product) {
	const images = product.images && typeof product.images === "object" && !Array.isArray(product.images) ? product.images : {};
	const image = normalizeString(product.image);
	const imageAvif = normalizeString(product.imageAvif ?? images.avif);
	const imageWebp = normalizeString(product.imageWebp ?? images.webp);
	const imageFallback = normalizeString(product.imageFallback ?? images.jpeg ?? images.jpg ?? images.fallback ?? image);
	return {
		image,
		imageAvif,
		imageWebp,
		imageFallback
	};
}

function normalizeVariant(variant, parentProduct) {
	if (!variant || typeof variant !== "object") {
		return null;
	}
	const id = normalizeProductId(variant.id ?? variant.variantId ?? variant.slug);
	if (!id) {
		return null;
	}
	const name = normalizeString(variant.name ?? variant.label) || id;
	const price = toNumber(variant.price, parentProduct.price);
	const images = normalizeProductImages(variant);
	return {
		id,
		name,
		label: normalizeString(variant.label) || name,
		price: Number.isFinite(price) && price >= 0 ? price : parentProduct.price,
		color: normalizeString(variant.color ?? variant.colour),
		colorName: normalizeString(variant.colorName ?? variant.colourName),
		sizes: normalizeStringArray(variant.sizes),
		...images,
		imageAlt: normalizeString(variant.imageAlt ?? variant.alt) || parentProduct.imageAlt,
		active: toBoolean(variant.active ?? variant.available, true)
	};
}

function normalizeVariants(variants, parentProduct) {
	if (!Array.isArray(variants)) {
		return [];
	}
	return variants.map(variant => normalizeVariant(variant, parentProduct)).filter(Boolean).filter(variant => variant.active);
}

function normalizeProduct(product) {
	if (!product || typeof product !== "object") {
		return null;
	}
	const id = normalizeProductId(product.id ?? product.productId);
	if (!id) {
		return null;
	}
	const name = normalizeString(product.name) || "ModeInfinity Product";
	const price = toNumber(product.price, 0);
	if (!Number.isFinite(price) || price < 0) {
		return null;
	}
	const images = normalizeProductImages(product);
	const imageAlt = normalizeString(product.imageAlt ?? product.alt) || name;
	const sortOrderValue = toNumber(product.sortOrder, 0);
	const sortOrder = Number.isFinite(sortOrderValue) ? sortOrderValue : 0;
	const hasExplicitActiveState = typeof product.active !== "undefined" || typeof product.isActive !== "undefined" || typeof product.available !== "undefined";
	const active = hasExplicitActiveState ? toBoolean(product.active ?? product.isActive ?? product.available, true) : true;
	const featured = toBoolean(product.featured ?? product.isFeatured, false);
	const normalizedProduct = {
		id,
		name,
		price,
		category: normalizeString(product.category),
		description: normalizeString(product.description),
		shortDescription: normalizeString(product.shortDescription),
		slug: normalizeString(product.slug) || id,
		badge: normalizeString(product.badge),
		featured,
		active,
		sortOrder,
		...images,
		imageAlt,
		materials: normalizeStringArray(product.materials),
		details: normalizeStringArray(product.details),
		sizes: normalizeStringArray(product.sizes),
		colours: normalizeStringArray(product.colours ?? product.colors),
		fit: normalizeString(product.fit),
		reviews: Array.isArray(product.reviews) ? product.reviews : [],
		rating: Number.isFinite(toNumber(product.rating, 0)) ? toNumber(product.rating, 0) : 0
	};
	normalizedProduct.variants = normalizeVariants(product.variants, normalizedProduct);
	return normalizedProduct;
}

function normalizeProductCollection(source) {
	let rawProducts = [];
	if (Array.isArray(source)) {
		rawProducts = source;
	} else if (source && typeof source === "object") {
		if (Array.isArray(source.products)) {
			rawProducts = source.products;
		} else if (Array.isArray(source.shoes)) {
			rawProducts = source.shoes;
		} else if (Array.isArray(source.items)) {
			rawProducts = source.items;
		}
	}
	return rawProducts.map(normalizeProduct).filter(Boolean).filter(product => product.active).sort(
		(a, b) => a.sortOrder - b.sortOrder);
}
export async function loadProducts() {
	try {
		const response = await fetch(PRODUCT_DATA_URL, {
			method: "GET",
			headers: {
				Accept: "application/json"
			},
			cache: "no-store"
		});
		if (!response.ok) {
			throw new Error(`Product data request failed with status ${response.status}.`);
		}
		const data = await response.json();
		state.products = normalizeProductCollection(data);
		state.productsLoaded = true;
		renderHomeProducts();
		return [...state.products];
	} catch (error) {
		state.products = [];
		state.productsLoaded = false;
		console.error("[ModeInfinity] Failed to load product data:", error);
		renderHomeProductsError();
		return [];
	}
}
export function getProducts() {
	return [...state.products];
}
export function findProduct(productId) {
	const normalizedId = normalizeProductId(productId);
	if (!normalizedId) {
		return null;
	}
	return (state.products.find(product => product.id === normalizedId) || null);
}
export function filterProducts(options = {}) {
	const {
		search = "",
			category = "",
			featured = null
	} = options;
	const normalizedSearch = String(search).trim().toLowerCase();
	const normalizedCategory = String(category).trim().toLowerCase();
	return state.products.filter(product => {
		if (normalizedCategory && product.category.toLowerCase() !== normalizedCategory) {
			return false;
		}
		if (featured !== null && product.featured !== Boolean(featured)) {
			return false;
		}
		if (!normalizedSearch) {
			return true;
		}
		const searchableText = [
			product.name,
			product.category,
			product.description,
			product.shortDescription,
			product.fit, ...product.materials, ...product.details, ...product.colours
		].join(" ").toLowerCase();
		return searchableText.includes(normalizedSearch);
	});
}

function getHomeProducts(limit = DEFAULT_HOME_PRODUCT_LIMIT) {
	const numericLimit = Math.floor(toNumber(limit, DEFAULT_HOME_PRODUCT_LIMIT));
	const normalizedLimit = Math.max(1, numericLimit);
	const featured = state.products.filter(product => product.featured);
	const remaining = state.products.filter(product => !product.featured);
	return [...featured, ...remaining].slice(0, normalizedLimit);
}

function getProductHref(product) {
	const id = encodeURIComponent(product.id);
	return `shop.html?product=${id}`;
}

function createProductImageMarkup(item, options = {}) {
	const {
		width = 900,
			height = 1125,
			loading = "lazy",
			decoding = "async"
	} = options;
	const avif = escapeHTML(item.imageAvif);
	const webp = escapeHTML(item.imageWebp);
	const fallback = escapeHTML(item.imageFallback || item.image);
	const alt = escapeHTML(item.imageAlt || item.name);
	const sourceAvif = avif ? `
                <source
                    srcset="${avif}"
                    type="image/avif"
                >
            ` : "";
	const sourceWebp = webp ? `
                <source
                    srcset="${webp}"
                    type="image/webp"
                >
            ` : "";
	return `
        <picture>

            ${sourceAvif}

            ${sourceWebp}

            <img
                src="${fallback}"
                alt="${alt}"
                width="${Number(width)}"
                height="${Number(height)}"
                loading="${escapeHTML(loading)}"
                decoding="${escapeHTML(decoding)}"
            >

        </picture>
    `;
}

function createHomeProductCard(product) {
	const id = escapeHTML(product.id);
	const name = escapeHTML(product.name);
	const price = formatNaira(product.price);
	const category = escapeHTML(product.category);
	const badge = escapeHTML(product.badge);
	const href = escapeHTML(getProductHref(product));
	const description = escapeHTML(product.shortDescription || product.description);
	const imageMarkup = createProductImageMarkup(product, {
		width: 900,
		height: 1125,
		loading: "lazy",
		decoding: "async"
	});
	return `
        <article
            class="product-card"
            data-product-id="${id}"
            data-product-name="${name}"
            data-product-price="${escapeHTML(String(product.price))}"
            data-product-category="${category}"
            data-product-image="${escapeHTML(product.image)}"
            data-image-avif="${escapeHTML(product.imageAvif)}"
            data-image-webp="${escapeHTML(product.imageWebp)}"
            data-image-fallback="${escapeHTML(product.imageFallback)}"
            data-image-alt="${escapeHTML(product.imageAlt)}"
        >

            <div class="product-card__media">

                ${
                    badge
                        ? `
<span
 class="product-card__badge"
 aria-label="${badge}"
>
 ${badge}
</span>
 `
                        : ""
                }

                <a
                    class="product-card__media-link"
                    href="${href}"
                    aria-label="View ${name}"
                >
                    ${imageMarkup}
                </a>

            </div>


            <div class="product-card__body">

                ${
                    category
                        ? `
<p class="product-card__category">
 ${category}
</p>
 `
                        : ""
                }

                <h3 class="product-card__title">
                    <a href="${href}">
                        ${name}
                    </a>
                </h3>

                <p class="product-card__price">
                    ${price}
                </p>

                ${
                    description
                        ? `
<p class="product-card__description">
 ${description}
</p>
 `
                        : ""
                }

            </div>

        </article>
    `;
}
export function renderHomeProducts() {
	const container = $(SELECTORS.homeProducts);
	if (!container) {
		return;
	}
	elements.homeProducts = container;
	const requestedLimit = container.dataset.homeProductsLimit || DEFAULT_HOME_PRODUCT_LIMIT;
	const products = getHomeProducts(requestedLimit);
	container.setAttribute("aria-busy", "false");
	if (!products.length) {
		renderHomeProductsError();
		return;
	}
	container.innerHTML = products.map(createHomeProductCard).join("");
}

function renderHomeProductsError() {
	const container = $(SELECTORS.homeProducts);
	if (!container) {
		return;
	}
	elements.homeProducts = container;
	container.setAttribute("aria-busy", "false");
	container.innerHTML = `
        <p
            class="home-collection__empty"
            role="status"
        >
            The collection is temporarily unavailable.
            Please visit the shop to explore ModeInfinity footwear.
        </p>
    `;
}

function normalizeCartItem(item) {
	const product = normalizeProduct(item);
	if (!product) {
		return null;
	}
	const quantity = Math.min(MAX_CART_ITEM_QUANTITY, Math.max(1, Math.floor(toNumber(item.quantity, 1))));
	return {
		...product,
		quantity
	};
}

function loadCart() {
	const storedCart = getStorage(STORAGE_KEY,
		[]);
	if (!Array.isArray(storedCart)) {
		state.cart = [];
		return;
	}
	state.cart = storedCart.map(normalizeCartItem).filter(Boolean);
}

function saveCart() {
	setStorage(STORAGE_KEY, state.cart);
}

function clearStoredCart() {
	removeStorage(STORAGE_KEY);
}
export function getCartCount() {
	return state.cart.reduce(
		(total, item) => total + item.quantity, 0);
}
export function getCartSubtotal() {
	return state.cart.reduce(
		(total, item) => total + item.price * item.quantity, 0);
}
export function isCartEmpty() {
	return state.cart.length === 0;
}

function updateCartCount() {
	const count = getCartCount();
	if (elements.cartCount) {
		elements.cartCount.textContent = String(count);
		elements.cartCount.hidden = count === 0;
	}
	elements.cartButtons.forEach(button => {
		button.setAttribute("aria-label", count > 0 ? `Open shopping cart, ${count} ${
                        count === 1
                            ? "item"
                            : "items"
                    }` : "Open shopping cart");
	});
}

function announceCartStatus(message) {
	if (!elements.cartStatus) {
		return;
	}
	elements.cartStatus.textContent = message;
}

function createCartItemMarkup(item) {
	const id = escapeHTML(item.id);
	const name = escapeHTML(item.name);
	const category = escapeHTML(item.category);
	const price = formatNaira(item.price);
	const total = formatNaira(item.price * item.quantity);
	const imageMarkup = createProductImageMarkup(item, {
		width: 88,
		height: 88,
		loading: "lazy",
		decoding: "async"
	});
	const quantityLabel = `Quantity for ${item.name}`;
	return `
        <article
            class="cart-item"
            data-cart-item-id="${id}"
        >

            <div class="cart-item__media">
                ${imageMarkup}
            </div>


            <div class="cart-item__content">

                <h4 class="cart-item__title">
                    ${name}
                </h4>

                ${
                    category
                        ? `
<p class="cart-item__meta">
 ${category}
</p>
 `
                        : ""
                }

                <p class="cart-item__price">
                    ${total}
                </p>


                <div
                    class="cart-item__quantity"
                    aria-label="${escapeHTML(quantityLabel)}"
                >

                    <button
                        class="cart-item__quantity-button"
                        type="button"
                        data-cart-decrease="${id}"
                        aria-label="Decrease quantity of ${name}"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path d="M5 12h14"></path>
                        </svg>
                    </button>


                    <span
                        class="cart-item__quantity-value"
                        data-cart-quantity="${id}"
                        aria-live="polite"
                    >
                        ${item.quantity}
                    </span>


                    <button
                        class="cart-item__quantity-button"
                        type="button"
                        data-cart-increase="${id}"
                        aria-label="Increase quantity of ${name}"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path d="M12 5v14"></path>
                            <path d="M5 12h14"></path>
                        </svg>
                    </button>

                </div>

            </div>


            <div class="cart-item__controls">

                <p class="cart-item__unit-price">
                    ${price}
                </p>

                <button
                    class="cart-item__remove"
                    type="button"
                    data-cart-remove="${id}"
                    aria-label="Remove ${name} from shopping cart"
                >
                    Remove
                </button>

            </div>

        </article>
    `;
}

function updateCartVisibility() {
	const empty = isCartEmpty();
	if (elements.cartEmptyState) {
		elements.cartEmptyState.hidden = !empty;
	}
	if (elements.cartItemsSection) {
		elements.cartItemsSection.hidden = empty;
	}
	if (elements.cartFooter) {
		elements.cartFooter.hidden = empty;
	}
}
export function renderCart() {
	updateCartCount();
	updateCartVisibility();
	if (elements.cartItems) {
		elements.cartItems.innerHTML = state.cart.map(createCartItemMarkup).join("");
	}
	if (elements.cartSubtotal) {
		elements.cartSubtotal.textContent = formatNaira(getCartSubtotal());
	}
	if (elements.cartStatus) {
		if (isCartEmpty()) {
			elements.cartStatus.textContent = "Your shopping cart is empty.";
		} else {
			const count = getCartCount();
			elements.cartStatus.textContent = `Your shopping cart contains ${count} ${
                    count === 1
                        ? "item"
                        : "items"
                }.`;
		}
	}
}

function findCartItem(productId) {
	const normalizedId = normalizeProductId(productId);
	if (!normalizedId) {
		return null;
	}
	return (state.cart.find(item => item.id === normalizedId) || null);
}
export function addToCart(product, quantity = 1) {
	const normalizedProduct = normalizeProduct(product);
	if (!normalizedProduct) {
		announceCartStatus("The selected product could not be added to the cart.");
		return false;
	}
	const requestedQuantity = Math.max(1, Math.floor(toNumber(quantity, 1)));
	const existingItem = findCartItem(normalizedProduct.id);
	if (existingItem) {
		existingItem.quantity = Math.min(MAX_CART_ITEM_QUANTITY, existingItem.quantity + requestedQuantity);
	} else {
		state.cart.push({
			...normalizedProduct,
			quantity: Math.min(MAX_CART_ITEM_QUANTITY, requestedQuantity)
		});
	}
	saveCart();
	renderCart();
	announceCartStatus(`${normalizedProduct.name} has been added to your shopping cart.`);
	return true;
}
export function removeFromCart(productId) {
	const normalizedId = normalizeProductId(productId);
	const existingItem = findCartItem(normalizedId);
	if (!existingItem) {
		return false;
	}
	state.cart = state.cart.filter(item => item.id !== normalizedId);
	saveCart();
	renderCart();
	announceCartStatus(`${existingItem.name} has been removed from your shopping cart.`);
	return true;
}
export function updateCartQuantity(productId, quantity) {
	const normalizedId = normalizeProductId(productId);
	const item = findCartItem(normalizedId);
	if (!item) {
		return false;
	}
	const numericQuantity = Math.floor(toNumber(quantity, 0));
	if (numericQuantity <= 0) {
		return removeFromCart(normalizedId);
	}
	item.quantity = Math.min(MAX_CART_ITEM_QUANTITY, numericQuantity);
	saveCart();
	renderCart();
	announceCartStatus(`${item.name} quantity updated to ${item.quantity}.`);
	return true;
}
export function increaseQuantity(productId) {
	const item = findCartItem(productId);
	if (!item) {
		return false;
	}
	if (item.quantity >= MAX_CART_ITEM_QUANTITY) {
		announceCartStatus(`Maximum quantity for ${item.name} is ${MAX_CART_ITEM_QUANTITY}.`);
		return false;
	}
	return updateCartQuantity(item.id, item.quantity + 1);
}
export function decreaseQuantity(productId) {
	const item = findCartItem(productId);
	if (!item) {
		return false;
	}
	return updateCartQuantity(item.id, item.quantity - 1);
}
export function clearCart() {
	state.cart = [];
	clearStoredCart();
	renderCart();
	announceCartStatus("Your shopping cart has been cleared.");
}

function updateCartDrawerState(open) {
	if (!elements.cartDrawer) {
		return;
	}
	setAriaHidden(elements.cartDrawer, !open);
	elements.cartButtons.forEach(button => {
		setExpanded(button, open);
	});
}
let previousBodyOverflow = "";

function lockBodyScroll() {
	previousBodyOverflow = document.body.style.overflow;
	document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
	document.body.style.overflow = previousBodyOverflow;
	previousBodyOverflow = "";
}
export function openCart(event = null) {
	if (event) {
		event.preventDefault();
	}
	if (!elements.cartDrawer || state.cartOpen) {
		return;
	}
	state.previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	state.cartOpen = true;
	addClass(elements.cartDrawer, "is-open");
	updateCartDrawerState(true);
	lockBodyScroll();
	window.requestAnimationFrame(
		() => {
			if (elements.cartClose) {
				focusElement(elements.cartClose);
			}
		});
}
export function closeCart(event = null, restoreFocus = true) {
	if (event) {
		event.preventDefault();
	}
	if (!elements.cartDrawer || !state.cartOpen) {
		return;
	}
	state.cartOpen = false;
	removeClass(elements.cartDrawer, "is-open");
	updateCartDrawerState(false);
	unlockBodyScroll();
	if (restoreFocus && state.previouslyFocusedElement && document.contains(state.previouslyFocusedElement)) {
		window.requestAnimationFrame(
			() => {
				focusElement(state.previouslyFocusedElement);
			});
	}
	state.previouslyFocusedElement = null;
}
export function toggleCart(event = null) {
	if (state.cartOpen) {
		closeCart(event, true);
		return;
	}
	openCart(event);
}

function handleFocusTrap(event) {
	if (!state.cartOpen || event.key !== "Tab" || !elements.cartDrawerPanel) {
		return;
	}
	const focusable = elements.cartDrawerPanel.querySelectorAll(
		["a[href]", "button:not([disabled])", "input:not([disabled])", "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])"].join(","));
	const focusableElements = Array.from(focusable).filter(element => element instanceof HTMLElement && !element.hidden && element.getAttribute("aria-hidden") !== "true");
	if (!focusableElements.length) {
		event.preventDefault();
		return;
	}
	const first = focusableElements[0];
	const last = focusableElements[focusableElements.length - 1];
	if (event.shiftKey) {
		if (document.activeElement === first) {
			event.preventDefault();
			focusElement(last);
		}
		return;
	}
	if (document.activeElement === last) {
		event.preventDefault();
		focusElement(first);
	}
}

function handleEscape(event) {
	if (event.key === "Escape" && state.cartOpen) {
		closeCart(null, true);
	}
}

function handleCartAction(event) {
	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}
	const increaseButton = target.closest(SELECTORS.increaseQuantity);
	if (increaseButton) {
		event.preventDefault();
		increaseQuantity(increaseButton.dataset.cartIncrease);
		return;
	}
	const decreaseButton = target.closest(SELECTORS.decreaseQuantity);
	if (decreaseButton) {
		event.preventDefault();
		decreaseQuantity(decreaseButton.dataset.cartDecrease);
		return;
	}
	const removeButton = target.closest(SELECTORS.removeFromCart);
	if (removeButton) {
		event.preventDefault();
		removeFromCart(removeButton.dataset.cartRemove);
	}
}

function getProductFromElement(element) {
	if (!(element instanceof HTMLElement)) {
		return null;
	}
	const source = element.closest(SELECTORS.productCards) || element;
	const dataset = source.dataset;
	const id = dataset.productId || element.dataset.productId;
	const name = dataset.productName || element.dataset.productName;
	const price = dataset.productPrice || element.dataset.productPrice;
	if (!id || !name) {
		return null;
	}
	return normalizeProduct({
		id,
		name,
		price,
		category: dataset.productCategory,
		image: dataset.productImage,
		imageAvif: dataset.imageAvif,
		imageWebp: dataset.imageWebp,
		imageFallback: dataset.imageFallback,
		imageAlt: dataset.imageAlt
	});
}

function handleAddToCart(event) {
	const target = event.target;
	if (!(target instanceof Element)) {
		return;
	}
	const button = target.closest(SELECTORS.addToCart);
	if (!button) {
		return;
	}
	event.preventDefault();
	const product = getProductFromElement(button);
	if (!product) {
		announceCartStatus("This product could not be added to the cart.");
		return;
	}
	const quantity = toNumber(button.dataset.quantity, 1);
	const added = addToCart(product, quantity);
	if (added && button.dataset.openCart === "true") {
		openCart();
	}
}

function bindEvents() {
	if (eventController) {
		eventController.abort();
	}
	eventController = new AbortController();
	const signal = eventController.signal;
	elements.cartButtons.forEach(button => {
		button.addEventListener("click", toggleCart, {
			signal
		});
	});
	if (elements.cartClose) {
		elements.cartClose.addEventListener("click", closeCart, {
			signal
		});
	}
	if (elements.cartBackdrop) {
		elements.cartBackdrop.addEventListener("click", closeCart, {
			signal
		});
	}
	if (elements.cartItems) {
		elements.cartItems.addEventListener("click", handleCartAction, {
			signal
		});
	}
	document.addEventListener("click", handleAddToCart, {
		signal
	});
	document.addEventListener("keydown", handleEscape, {
		signal
	});
	if (elements.cartDrawerPanel) {
		elements.cartDrawerPanel.addEventListener("keydown", handleFocusTrap, {
			signal
		});
	}
}
export async function initShop() {
	if (state.initialized) {
		return shop;
	}
	cacheElements();
	loadCart();
	renderCart();
	bindEvents();
	await loadProducts();
	if (elements.cartDrawer) {
		updateCartDrawerState(false);
	}
	state.initialized = true;
	console.info("[ModeInfinity] Shop initialized successfully.");
	return shop;
}
export function destroyShop() {
	if (state.cartOpen) {
		closeCart(null, false);
	}
	if (eventController) {
		eventController.abort();
		eventController = null;
	}
	state.initialized = false;
}
export const shop = Object.freeze({
	init: initShop,
	destroy: destroyShop,
	loadProducts,
	renderHomeProducts,
	getProducts,
	findProduct,
	filterProducts,
	openCart,
	closeCart,
	toggleCart,
	addToCart,
	removeFromCart,
	increaseQuantity,
	decreaseQuantity,
	updateCartQuantity,
	clearCart,
	renderCart,
	getCartCount,
	getCartSubtotal,
	isCartEmpty,
	get isOpen() {
		return state.cartOpen;
	},
	get items() {
		return [...state.cart];
	},
	get products() {
		return [...state.products];
	},
	get productsLoaded() {
		return state.productsLoaded;
	}
});
export default shop;
/* ==========================================================================
   MODEINFINITY — HOME TESTIMONIALS
   File: scripts/testimonials.js

   Loads data/testimonials.json, renders cards, and drives:

     - Tab filter (student | customer | partner)
     - Marquee loop when a tab has 4+ published entries
     - Pause/Resume button when the marquee runs
     - Skeleton → real card transition
     - Graceful hide when no entries exist for any tab

   Contract:
     [data-home-testimonials-section]   → <section>
     [data-home-testimonials]           → <div> that receives the cards
     [data-testimonials-viewport]       → scroll viewport
     [data-testimonials-toggle]         → Pause/Resume <button>
     [data-testimonials-tabs]           → tab bar wrapper
     [data-testimonials-tab="…"]        → individual tab buttons

   JSON: { "testimonials": [ … ] }
     Required per entry: name, quote, published: true
     Recommended:        type, role, location, classYear, programme,
                         rating, image, imageAlt
   ========================================================================== */

(() => {
	'use strict';

	/* ---------------------------------------------------------------
	   DOM references
	   --------------------------------------------------------------- */

	const section  = document.querySelector('[data-home-testimonials-section]');
	const list     = document.querySelector('[data-home-testimonials]');

	if (!section || !list) return;

	const viewport = section.querySelector('[data-testimonials-viewport]');
	const toggle   = section.querySelector('[data-testimonials-toggle]');
	const tabBar   = section.querySelector('[data-testimonials-tabs]');
	const tabBtns  = tabBar ? Array.from(
		tabBar.querySelectorAll('[data-testimonials-tab]')
	) : [];

	const source   = list.dataset.source || 'data/testimonials.json';
	const imageBase = 'assets/images/testimonial/';
	const limit    = Number(list.dataset.homeTestimonialsLimit) || 12;
	const loopFrom = 4;


	/* ---------------------------------------------------------------
	   State
	   --------------------------------------------------------------- */

	const state = {
		all: [],           // every published entry
		byType: {},        // { student: [...], customer: [...], partner: [...] }
		activeType: null,  // currently visible type
		paused: false
	};


	/* ---------------------------------------------------------------
	   Element factory
	   --------------------------------------------------------------- */

	function el(tag, className, text) {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined && text !== null) node.textContent = text;
		return node;
	}


	/* ---------------------------------------------------------------
	   Builders
	   --------------------------------------------------------------- */

	function buildRating(value) {
		const rating = Math.round(Number(value));
		if (!rating || rating < 1 || rating > 5) return null;

		const wrap = el('div', 'testimonial-card__rating');
		wrap.setAttribute('role', 'img');
		wrap.setAttribute('aria-label', `${rating} out of 5 stars`);

		const stars = el('span', null, '★'.repeat(rating) + '☆'.repeat(5 - rating));
		stars.setAttribute('aria-hidden', 'true');

		wrap.append(stars);
		return wrap;
	}


	function buildAvatar(item) {
		const avatar = el('div', 'testimonial-card__avatar');

		if (!item.image) {
			avatar.classList.add('testimonial-card__avatar--initials');
			const initials = String(item.name || '')
				.split(/\s+/).filter(Boolean).slice(0, 2)
				.map((part) => part[0].toUpperCase()).join('');
			avatar.append(el('span', null, initials || '•'));
			avatar.setAttribute('aria-hidden', 'true');
			return avatar;
		}

		const path = item.image.includes('/')
			? item.image
			: `${imageBase}${item.image}`;

		const picture = el('picture', 'testimonial-card__picture');

		[['avif', 'image/avif'], ['webp', 'image/webp']].forEach(([ext, type]) => {
			const sourceTag = document.createElement('source');
			sourceTag.srcset = `${path}.${ext}`;
			sourceTag.type = type;
			picture.append(sourceTag);
		});

		const img = el('img', 'testimonial-card__image');
		img.src = `${path}.jpg`;
		img.alt = item.imageAlt || `Photo of ${item.name}`;
		img.width = 64;
		img.height = 64;
		img.loading = 'lazy';
		img.decoding = 'async';
		picture.append(img);

		avatar.append(picture);
		return avatar;
	}


	function buildMeta(item) {
		const parts = [item.location, item.classYear].filter(Boolean);
		if (!parts.length) return null;

		const meta = el('p', 'testimonial-card__meta');
		meta.append(document.createTextNode(parts.join(' · ')));
		return meta;
	}


	function buildCard(item) {
		const card = el('article', 'testimonial-card');

		/* Content: rating + quote */
		const content = el('div', 'testimonial-card__content');

		const rating = buildRating(item.rating);
		if (rating) content.append(rating);

		const quote = el('blockquote', 'testimonial-card__quote');
		quote.append(el('p', null, item.quote));
		content.append(quote);

		/* Author */
		const author = el('footer', 'testimonial-card__author');
		author.append(buildAvatar(item));

		const info = el('div', 'testimonial-card__author-info');
		info.append(el('cite', 'testimonial-card__name', item.name));

		const role = [item.role, item.programme].filter(Boolean).join(' · ');
		if (role) info.append(el('span', 'testimonial-card__role', role));

		const meta = buildMeta(item);
		if (meta) info.append(meta);

		author.append(info);
		card.append(content, author);
		return card;
	}


	/* ---------------------------------------------------------------
	   Marquee control
	   --------------------------------------------------------------- */

	function stopLoop() {
		if (viewport) viewport.classList.remove('is-marquee', 'is-paused');
		if (toggle) {
			toggle.hidden = true;
			toggle.textContent = 'Pause scrolling';
			toggle.dataset.state = 'playing';
		}
		state.paused = false;
	}


	function startLoop(cards) {
		const clones = cards.map((card) => {
			const clone = card.cloneNode(true);
			clone.classList.add('is-clone');
			clone.setAttribute('aria-hidden', 'true');
			clone.inert = true;
			return clone;
		});

		list.append(...clones);
		list.style.setProperty('--tm-count', String(cards.length));

		viewport.classList.add('is-marquee');

		if (!toggle) return;

		toggle.hidden = false;
		toggle.textContent = 'Pause scrolling';
		toggle.dataset.state = 'playing';
		state.paused = false;

		// Remove any previous listener before adding (in case of re-render)
		toggle.replaceWith(toggle.cloneNode(true));
		const freshToggle = section.querySelector('[data-testimonials-toggle]');
		freshToggle.addEventListener('click', () => {
			state.paused = !state.paused;
			viewport.classList.toggle('is-paused', state.paused);
			freshToggle.textContent = state.paused
				? 'Resume scrolling'
				: 'Pause scrolling';
			freshToggle.dataset.state = state.paused ? 'paused' : 'playing';
		});
	}


	/* ---------------------------------------------------------------
	   Focusable viewport
	   --------------------------------------------------------------- */

	function updateFocusable() {
		if (!viewport) return;
		const scrolls =
			getComputedStyle(viewport).overflowX === 'auto' &&
			viewport.scrollWidth > viewport.clientWidth + 1;

		if (scrolls) {
			viewport.setAttribute('tabindex', '0');
		} else {
			viewport.removeAttribute('tabindex');
		}
	}


	/* ---------------------------------------------------------------
	   Render active tab
	   --------------------------------------------------------------- */

	function renderActive() {
		const items = state.byType[state.activeType] || [];

		// Stop and clear any running loop, then wipe the list
		stopLoop();
		list.replaceChildren();

		if (!items.length) {
			return;
		}

		const cards = items.slice(0, limit).map(buildCard);
		list.replaceChildren(...cards);

		const reducedMotion = window
			.matchMedia('(prefers-reduced-motion: reduce)').matches;

		if (viewport && cards.length >= loopFrom && !reducedMotion) {
			startLoop(cards);
		}

		if (viewport) {
			updateFocusable();
		}
	}


	/* ---------------------------------------------------------------
	   Tab setup
	   --------------------------------------------------------------- */

	function setupTabs() {
		if (!tabBar || !tabBtns.length) return;

		// Determine which types have at least one published entry
		const available = new Set(Object.keys(state.byType));

		// Hide tabs that have no entries, mark enabled ones
		tabBtns.forEach((btn) => {
			const type = btn.dataset.testimonialsTab;
			if (available.has(type)) {
				btn.hidden = false;
			} else {
				btn.hidden = true;
			}
		});

		// If no tab has data, hide the whole bar
		const anyVisible = tabBtns.some((btn) => !btn.hidden);
		if (!anyVisible) {
			tabBar.hidden = true;
			return;
		}

		tabBar.hidden = false;

		// Choose the first available type as active
		const firstAvailable = tabBtns.find((btn) => !btn.hidden);
		state.activeType = firstAvailable.dataset.testimonialsTab;

		// Reflect active state
		tabBtns.forEach((btn) => {
			const isActive = btn.dataset.testimonialsTab === state.activeType;
			// btn.setAttribute('aria-selected', String(isActive));
			btn.classList.toggle('is-active', isActive);
		});

		// Handle clicks
		tabBtns.forEach((btn) => {
			btn.addEventListener('click', () => {
				const type = btn.dataset.testimonialsTab;
				if (!type || type === state.activeType) return;

				state.activeType = type;

				tabBtns.forEach((other) => {
					const isActive = other === btn;
					other.setAttribute('aria-selected', String(isActive));
					other.classList.toggle('is-active', isActive);
				});

				renderActive();
			});
		});
	}


	/* ---------------------------------------------------------------
	   Load JSON
	   --------------------------------------------------------------- */

	async function load() {
		try {
			const response = await fetch(source, {
				headers: { Accept: 'application/json' }
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const data = await response.json();
			const all = Array.isArray(data) ? data : data.testimonials || [];

			const published = all.filter(
				(t) => t && t.published === true && t.quote && t.name
			);

			if (!published.length) {
				section.hidden = true;
				return;
			}

			state.all = published;

			// Group by type
			state.byType = {};
			published.forEach((entry) => {
				const type = entry.type || 'student';
				if (!state.byType[type]) state.byType[type] = [];
				state.byType[type].push(entry);
			});

			setupTabs();
			renderActive();

			if (viewport && 'ResizeObserver' in window) {
				new ResizeObserver(updateFocusable).observe(viewport);
			} else if (viewport) {
				window.addEventListener('resize', updateFocusable);
			}
		} catch (error) {
			console.warn('Testimonials could not be loaded:', error);
			section.hidden = true;
		} finally {
			list.setAttribute('aria-busy', 'false');
		}
	}

	load();
})();
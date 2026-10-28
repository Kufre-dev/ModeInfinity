/* ============================================================
   MODEINFINITY — THEME CONTROLLER
   File: scripts/theme.js

   Behaviour:
   - Default: site follows the OS (prefers-color-scheme).
   - Optional manual override: localStorage 'mi-theme' = 'light' | 'dark'
   - Theme switcher (if present) calls window.MITheme.set('light'|'dark'|'system')
   - Clears stale 'theme' key from any previous implementation.

   The site's CSS uses:
     :root { …light tokens… }
     @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { …dark tokens… } }
     :root[data-theme="light"] { …light tokens… }
     :root[data-theme="dark"]  { …dark tokens… }
   So this file only needs to add/remove data-theme; the CSS does the rest.
   ============================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var KEY = 'mi-theme';
  var LEGACY_KEYS = ['theme']; // keys from previous implementations

  /* Clean up stale legacy keys that could pin the theme */
  try {
    LEGACY_KEYS.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) { /* localStorage may be disabled */ }

  function get() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function apply(stored) {
    if (stored === 'light' || stored === 'dark') {
      root.setAttribute('data-theme', stored);
    } else {
      /* no override — follow OS via CSS media query */
      root.removeAttribute('data-theme');
    }
  }

  /* On load: apply stored preference (defaults to "follow OS") */
  apply(get());

  /* Public API — call from your theme switch UI */
  window.MITheme = {
    set: function (mode) {
      try {
        if (mode === 'system') {
          localStorage.removeItem(KEY);
          apply(null);
        } else if (mode === 'light' || mode === 'dark') {
          localStorage.setItem(KEY, mode);
          apply(mode);
        }
      } catch (e) { /* no-op */ }
    },
    get: function () {
      return get() || 'system';
    },
    /* Current *effective* theme (accounts for OS) */
    current: function () {
      if (root.getAttribute('data-theme')) return root.getAttribute('data-theme');
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  };

  /* If a theme switcher exists in the DOM, wire it up.
     Looks for elements with [data-theme-set] or .theme-toggle.
     Safe to leave this block even if no switcher exists. */
  document.addEventListener('DOMContentLoaded', function () {
    var switches = document.querySelectorAll('[data-theme-set]');
    switches.forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        window.MITheme.set(el.getAttribute('data-theme-set'));
      });
    });
  });
})();
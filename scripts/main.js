import { initializeComponents } from "./components.js";
import { initializeNavbar } from "./navbar.js";
import { initScrollAnimations } from "./scrollanimations.js";
import {
  initCarousels,
  initCraftCarousels
} from "./swiper.js";
import { initShop } from "./shop.js";
import { initFormHandler } from "./formhandler.js";

let applicationInitialized = false;

async function initializeApplication() {
  if (applicationInitialized) return;

  /*
   * ------------------------------------------------------------
   * 1. NAVBAR
   * ------------------------------------------------------------
   * The header is static in index.html, so initialize it
   * immediately and independently of optional components.
   */
  let navbar = null;

  try {
    navbar = initializeNavbar();

    /*
     * Explicitly synchronize the initial scroll state.
     * This guarantees that .is-scrolled reflects the current
     * scroll position even if the page was restored at a
     * non-zero scroll position.
     */
    if (navbar && typeof navbar.handleScroll === "function") {
      navbar.handleScroll();
    }
  } catch (error) {
    console.error(
      "[ModeInfinity] Navbar initialization failed:",
      error
    );
  }

  /*
   * ------------------------------------------------------------
   * 2. OPTIONAL COMPONENTS
   * ------------------------------------------------------------
   */
  let componentLoader = null;

  try {
    componentLoader = await initializeComponents();
  } catch (error) {
    console.error(
      "[ModeInfinity] Optional component initialization failed:",
      error
    );
  }

  /*
   * ------------------------------------------------------------
   * 3. SHOP
   * ------------------------------------------------------------
   */
  let shop = null;

  try {
    shop = await initShop();
  } catch (error) {
    console.error(
      "[ModeInfinity] Shop initialization failed:",
      error
    );
  }

  /*
   * ------------------------------------------------------------
   * 4. FORMS
   * ------------------------------------------------------------
   */
  try {
    initFormHandler();
  } catch (error) {
    console.error(
      "[ModeInfinity] Form initialization failed:",
      error
    );
  }

  /*
   * ------------------------------------------------------------
   * 5. SCROLL ANIMATIONS
   * ------------------------------------------------------------
   */
  try {
    initScrollAnimations();
  } catch (error) {
    console.error(
      "[ModeInfinity] Scroll animation initialization failed:",
      error
    );
  }

  /*
   * ------------------------------------------------------------
   * 6. CAROUSELS
   * ------------------------------------------------------------
   */
  try {
    initCarousels();
  } catch (error) {
    console.error(
      "[ModeInfinity] Carousel initialization failed:",
      error
    );
  }

  /*
   * ------------------------------------------------------------
   * 7. CRAFT CAROUSELS
   * ------------------------------------------------------------
   */
  try {
    initCraftCarousels();
  } catch (error) {
    console.error(
      "[ModeInfinity] Craft carousel initialization failed:",
      error
    );
  }

  applicationInitialized = true;

  document.dispatchEvent(
    new CustomEvent("modeinfinity:app-ready", {
      detail: {
        componentLoader,
        navbar,
        shop
      }
    })
  );

  console.info(
    "[ModeInfinity] Application initialized successfully."
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApplication,
    { once: true }
  );
} else {
  initializeApplication();
}

export default initializeApplication;
export { initializeApplication };
class ComponentLoader {
  constructor(options = {}) {
    this.options = {
      selector: "[data-component]",
      pathAttribute: "data-component-path",
      ...options
    };

    this.components = [];
    this.loadedComponents = new Map();
    this.failedComponents = new Map();
    this.isInitialized = false;
    this.isLoading = false;
  }

  discover() {
    this.components = Array.from(
      document.querySelectorAll(this.options.selector)
    );

    return this.components;
  }

  async loadAll() {
    if (this.isLoading) {
      return this;
    }

    this.isLoading = true;
    this.discover();

    try {
      const results = await Promise.allSettled(
        this.components.map((element) => this.loadComponent(element))
      );

      const successful = results.filter(
        (result) => result.status === "fulfilled"
      ).length;

      const failed = results.filter(
        (result) => result.status === "rejected"
      ).length;

      this.isInitialized = true;

      this.dispatchEvent("modeinfinity:components-ready", {
        loader: this,
        successful,
        failed,
        loaded: this.getLoadedComponents(),
        errors: this.getFailedComponents()
      });

      return this;
    } finally {
      this.isLoading = false;
    }
  }

  async loadComponent(element) {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const name = element.dataset.component;
    const path = element.getAttribute(this.options.pathAttribute);

    if (!name) {
      console.warn(
        "[ModeInfinity Components] Component placeholder is missing data-component.",
        element
      );

      return null;
    }

    if (!path) {
      const error = new Error("Component path is missing.");

      this.markFailed(name, element, error);

      return null;
    }

    if (this.loadedComponents.has(name)) {
      return this.loadedComponents.get(name);
    }

    try {
      const response = await fetch(path, {
        method: "GET",
        credentials: "same-origin",
        cache: "default",
        headers: {
          Accept: "text/html"
        }
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText}`
        );
      }

      const html = await response.text();

      if (!html.trim()) {
        throw new Error("Component returned empty HTML.");
      }

      const template = document.createElement("template");
      template.innerHTML = html.trim();

      const nodes = Array.from(template.content.childNodes);

      element.replaceWith(template.content);

      const component = {
        name,
        path,
        nodes
      };

      this.loadedComponents.set(name, component);

      this.dispatchEvent("modeinfinity:component-loaded", component);

      return component;
    } catch (error) {
      this.markFailed(name, element, error);

      console.error(
        `[ModeInfinity Components] Failed to load "${name}" from "${path}".`,
        error
      );

      return null;
    }
  }

  markFailed(name, element, error) {
    this.failedComponents.set(name, {
      name,
      error,
      element
    });

    element.setAttribute("data-component-error", "true");

    this.dispatchEvent("modeinfinity:component-error", {
      name,
      error,
      element
    });
  }

  getLoadedComponents() {
    return Array.from(this.loadedComponents.values());
  }

  getFailedComponents() {
    return Array.from(this.failedComponents.values());
  }

  getComponent(name) {
    return this.loadedComponents.get(name) || null;
  }

  dispatchEvent(name, detail = {}) {
    document.dispatchEvent(
      new CustomEvent(name, {
        detail
      })
    );
  }

  destroy() {
    this.components = [];
    this.loadedComponents.clear();
    this.failedComponents.clear();
    this.isInitialized = false;
    this.isLoading = false;
  }
}

let componentLoaderInstance = null;

async function initializeComponents() {
  if (!componentLoaderInstance) {
    componentLoaderInstance = new ComponentLoader();
  }

  return componentLoaderInstance.loadAll();
}

function getComponentLoader() {
  return componentLoaderInstance;
}

export default ComponentLoader;

export {
  ComponentLoader,
  initializeComponents,
  getComponentLoader
};
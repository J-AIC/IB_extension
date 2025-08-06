/**
 * architecture.js
 * 
 * This file defines the architectural patterns used in the InsightBuddy Chrome extension.
 * It provides base classes and interfaces for implementing the Model-View-Controller (MVC)
 * or Model-View-ViewModel (MVVM) patterns.
 */

(function(global) {
  'use strict';

// Base Model class
  class Model {
    constructor(data = {}) {
        this.data = data;
        this.listeners = [];
    }

    // Get a property value
    get(key) {
        return this.data[key];
    }

    // Set a property value and notify listeners
    set(key, value) {
        const oldValue = this.data[key];
        this.data[key] = value;
        
        // Notify listeners only if the value has changed
        if (oldValue !== value) {
            this.notifyListeners({ key, oldValue, newValue: value });
        }
        
        return this;
    }

    // Add a listener for data changes
    addListener(listener) {
        if (typeof listener === 'function' && !this.listeners.includes(listener)) {
            this.listeners.push(listener);
        }
        return this;
    }

    // Alias for addListener (for consistency with EventBus API)
    on(event, listener) {
        // For models, we ignore the event parameter and just add the listener
        return this.addListener(listener);
    }

    // Remove a listener
    removeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
        return this;
    }

    // Notify all listeners of a data change
    notifyListeners(change) {
        this.listeners.forEach(listener => {
            try {
                listener(change, this);
            } catch (error) {
                console.error('Error in model listener:', error);
            }
        });
    }

    // Update multiple properties at once
    update(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.set(key, value);
        });
        return this;
    }

    // Reset the model to its initial state or a new state
    reset(newData = {}) {
        const oldData = { ...this.data };
        this.data = newData;
        this.notifyListeners({ key: 'reset', oldValue: oldData, newValue: newData });
        return this;
    }

    // Convert the model to a plain object
    toJSON() {
        return { ...this.data };
    }
}

// Base View class
  class View {
    constructor(element, model = null, controller = null) {
        this.element = element instanceof HTMLElement ? element : document.querySelector(element);
        this.model = model;
        this.controller = controller;
        this.childViews = [];
        
        if (!this.element) {
            throw new Error(`View element not found: ${element}`);
        }
        
        if (this.model) {
            this.model.addListener(this.onModelChange.bind(this));
        }
        
        this.initialize();
    }

    // Initialize the view (to be overridden by subclasses)
    initialize() {
        // Override in subclasses
    }

    // Handle model changes (to be overridden by subclasses)
    onModelChange(change, model) {
        // Override in subclasses
        this.render();
    }

    // Render the view (to be overridden by subclasses)
    render() {
        // Override in subclasses
        return this;
    }

    // Add a child view
    addChildView(view) {
        if (view instanceof View && !this.childViews.includes(view)) {
            this.childViews.push(view);
        }
        return this;
    }

    // Remove a child view
    removeChildView(view) {
        const index = this.childViews.indexOf(view);
        if (index !== -1) {
            this.childViews.splice(index, 1);
        }
        return this;
    }

    // Clean up the view
    dispose() {
        if (this.model) {
            this.model.removeListener(this.onModelChange.bind(this));
        }
        
        // Dispose child views
        this.childViews.forEach(view => view.dispose());
        this.childViews = [];
        
        // Remove event listeners (to be implemented by subclasses)
        
        return this;
    }
}

// Base Controller class
  class Controller {
    constructor(model = null, view = null) {
        this.model = model;
        this.view = view;
        this.listeners = new Map(); // For event handling
        
        if (this.view) {
            this.view.controller = this;
        }
        
        this.initialize();
    }

    // Initialize the controller (to be overridden by subclasses)
    initialize() {
        // Override in subclasses
    }

    // Handle user actions (to be overridden by subclasses)
    handleAction(action, data) {
        // Override in subclasses
    }

    // Event handling methods for controllers
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(listener);
        return this;
    }

    off(event, listener) {
        if (this.listeners.has(event)) {
            const eventListeners = this.listeners.get(event);
            const index = eventListeners.indexOf(listener);
            if (index !== -1) {
                eventListeners.splice(index, 1);
            }
        }
        return this;
    }

    trigger(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error(`Error in controller event listener for "${event}":`, error);
                }
            });
        }
        return this;
    }
}

// Base ViewModel class (for MVVM pattern)
  class ViewModel {
    constructor(model = null) {
        this.model = model;
        this.listeners = [];
        
        if (this.model) {
            this.model.addListener(this.onModelChange.bind(this));
        }
        
        this.initialize();
    }

    // Initialize the view model (to be overridden by subclasses)
    initialize() {
        // Override in subclasses
    }

    // Handle model changes (to be overridden by subclasses)
    onModelChange(change, model) {
        // Override in subclasses
        this.notifyListeners(change);
    }

    // Add a listener for view model changes
    addListener(listener) {
        if (typeof listener === 'function' && !this.listeners.includes(listener)) {
            this.listeners.push(listener);
        }
        return this;
    }

    // Remove a listener
    removeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
        return this;
    }

    // Notify all listeners of a view model change
    notifyListeners(change) {
        this.listeners.forEach(listener => {
            try {
                listener(change, this);
            } catch (error) {
                console.error('Error in view model listener:', error);
            }
        });
    }

    // Clean up the view model
    dispose() {
        if (this.model) {
            this.model.removeListener(this.onModelChange.bind(this));
        }
        
        this.listeners = [];
        
        return this;
    }
}

// Dependency Injection Container
  class DIContainer {
    constructor() {
        this.services = new Map();
        this.factories = new Map();
        this.singletons = new Map();
    }

    // Register a service factory
    register(name, factory, singleton = false) {
        if (typeof factory !== 'function') {
            throw new Error(`Service factory must be a function: ${name}`);
        }
        
        this.factories.set(name, factory);
        
        if (singleton) {
            // For singletons, create the instance immediately
            this.singletons.set(name, factory(this));
        }
        
        return this;
    }

    // Get a service instance
    get(name) {
        // Return singleton instance if available
        if (this.singletons.has(name)) {
            return this.singletons.get(name);
        }
        
        // Check if service is registered
        if (!this.factories.has(name)) {
            throw new Error(`Service not registered: ${name}`);
        }
        
        // Create a new instance using the factory
        const factory = this.factories.get(name);
        const instance = factory(this);
        
        // Cache the instance
        this.services.set(name, instance);
        
        return instance;
    }

    // Check if a service is registered
    has(name) {
        return this.factories.has(name);
    }

    // Remove a service
    remove(name) {
        this.factories.delete(name);
        this.services.delete(name);
        this.singletons.delete(name);
        
        return this;
    }

    // Clear all services
    clear() {
        this.factories.clear();
        this.services.clear();
        this.singletons.clear();
        
        return this;
    }
}

// Event Bus for cross-component communication
  class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    // Subscribe to an event
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        
        const eventListeners = this.listeners.get(event);
        
        if (typeof listener === 'function' && !eventListeners.includes(listener)) {
            eventListeners.push(listener);
        }
        
        return this;
    }

    // Unsubscribe from an event
    off(event, listener) {
        if (!this.listeners.has(event)) {
            return this;
        }
        
        const eventListeners = this.listeners.get(event);
        const index = eventListeners.indexOf(listener);
        
        if (index !== -1) {
            eventListeners.splice(index, 1);
        }
        
        return this;
    }

    // Emit an event
    emit(event, data) {
        if (!this.listeners.has(event)) {
            return this;
        }
        
        const eventListeners = this.listeners.get(event);
        
        eventListeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error(`Error in event listener for "${event}":`, error);
            }
        });
        
        return this;
    }

    // Clear all listeners for an event
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
        
        return this;
    }
}

// Create global instances
  const container = new DIContainer();
  const eventBus = new EventBus();

// Register core services
container.register('eventBus', () => eventBus, true);

  // Export for different environments
  const exports = {
    Model,
    View,
    Controller,
    ViewModel,
    DIContainer,
    EventBus,
    container,
    eventBus
  };

  // ES6 Module export (for modern environments)
  if (typeof module !== 'undefined' && module.exports) {
    // CommonJS
    module.exports = exports;
  } else if (typeof window !== 'undefined' && typeof window.define === 'function' && window.define.amd) {
    // AMD
    define([], function() { return exports; });
  }

  // Always expose to global scope for service worker compatibility
  Object.assign(global, exports);

  // Debug flag
  global.architectureLoaded = true;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);

// ES6 Module exports (these will be available after the IIFE runs)
export const Model = globalThis.Model;
export const View = globalThis.View;
export const Controller = globalThis.Controller;
export const ViewModel = globalThis.ViewModel;
export const DIContainer = globalThis.DIContainer;
export const EventBus = globalThis.EventBus;
export const container = globalThis.container;
export const eventBus = globalThis.eventBus;
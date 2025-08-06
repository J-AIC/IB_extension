/**
 * BackgroundController.js
 * 
 * This file defines the BackgroundController class, which represents the controller for the background service worker.
 * It extends the base Controller class from the architecture.js file.
 */

(function(global) {
  'use strict';

  // Get the Controller class (should be available from architecture.js)
  const Controller = global.Controller;
  
  if (!Controller) {
    throw new Error('Controller class not available. Make sure architecture.js is loaded first.');
  }

/**
 * BackgroundController class
 * 
 * Represents the controller for the background service worker.
 * Handles extension initialization, context menu management, and message handling.
 */
  class BackgroundController extends Controller {
  /**
   * Constructor
   * 
   * @param {Object} model - The background model
   * @param {Object} view - The background view (not used in this case)
   * @param {Object} [services={}] - Services used by the controller
   */
  constructor(model, view, services = {}) {
    super(model, view);

    this.services = {
      storage: null,
      ...services
    };

    // Initialize event listeners
    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Listen for extension installation or update
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleAction('onInstalled', details);
    });

    // Listen for extension icon clicks
    chrome.action.onClicked.addListener((tab) => {
      this.handleAction('onActionClicked', tab);
    });

    // Listen for context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleAction('onContextMenuClicked', { info, tab });
    });

    // Listen for messages from content scripts or popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action) {
        this.handleAction(request.action, { request, sender, sendResponse });
        return true; // Enable async response
      }
    });
  }

  /**
   * Handle user actions
   * 
   * @param {string} action - The action to handle
   * @param {Object} data - The data for the action
   */
  async handleAction(action, data) {
    switch (action) {
      case 'onInstalled':
        await this.handleInstalled(data);
        break;

      case 'onActionClicked':
        this.handleActionClicked(data);
        break;

      case 'onContextMenuClicked':
        this.handleContextMenuClicked(data.info, data.tab);
        break;

      default:
        secureLogger.warn(`Unknown action: ${action}`);
    }
  }

  /**
   * Handle extension installation or update
   * 
   * @param {Object} details - Installation details
   */
  async handleInstalled(details) {
    // Log extension installation/update
    secureLogger.log("Extension installed/updated", details);

    // Set installed state in model
    this.model.setInstalled(true);

    // Create context menus
    this.createContextMenus();
  }

  /**
   * Create context menus
   */
  createContextMenus() {
    // Clear existing context menus
    chrome.contextMenus.removeAll();
    this.model.clearContextMenus();

    // Create new context menu
    const menuItem = {
      id: "openHome",
      title: "InsightBuddyを開く",
      contexts: ["action"]
    };

    chrome.contextMenus.create(menuItem);
    this.model.addContextMenu(menuItem);
  }

  /**
   * Handle extension icon click
   * 
   * @param {Object} tab - The active tab
   */
  handleActionClicked(tab) {
    // Log icon click
    secureLogger.log("Extension icon clicked, opening home page");

    // Open home page
    chrome.tabs.create({ url: chrome.runtime.getURL("home.html") });
  }

  /**
   * Handle context menu click
   * 
   * @param {Object} info - Information about the context menu click
   * @param {Object} tab - The active tab
   */
  handleContextMenuClicked(info, tab) {
    if (info.menuItemId === "openHome") {
      // Log context menu click
      secureLogger.log("Context menu item clicked, opening home page");

      // Open home page
      chrome.tabs.create({ url: chrome.runtime.getURL("home.html") });
    }
  }
}

/**
 * Factory function for creating a BackgroundController instance
 * 
 * @param {Object} container - The dependency injection container
 * @returns {BackgroundController} - The BackgroundController instance
 */
  const createBackgroundController = (container) => {
  const backgroundModel = container.get('backgroundModel');
  const storage = container.get('storage');

  return new BackgroundController(backgroundModel, null, { storage });
};

  // Expose to global scope
  global.BackgroundController = BackgroundController;
  global.createBackgroundController = createBackgroundController;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);

// ES6 Module exports
export const BackgroundController = globalThis.BackgroundController;
export const createBackgroundController = globalThis.createBackgroundController;

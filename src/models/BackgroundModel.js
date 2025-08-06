/**
 * BackgroundModel.js
 * 
 * This file defines the BackgroundModel class, which represents the data model for the background service worker.
 * It extends the base Model class from the architecture.js file.
 */

(function(global) {
  'use strict';

  // Get the Model class (should be available from architecture.js)
  const Model = global.Model;
  
  if (!Model) {
    throw new Error('Model class not available. Make sure architecture.js is loaded first.');
  }

/**
 * BackgroundModel class
 * 
 * Represents the data model for the background service worker.
 * Manages extension state, context menus, and other background-related data.
 */
  class BackgroundModel extends Model {
  /**
   * Constructor
   * 
   * @param {Object} data - Initial data for the model
   */
  constructor(data = {}) {
    // Default data
    const defaultData = {
      isInstalled: false,
      contextMenus: [],
      settings: {
        apiProvider: null,
        apiKeys: {},
        customSettings: {}
      },
      ...data
    };

    super(defaultData);
  }

  /**
   * Set the installed state of the extension
   * 
   * @param {boolean} isInstalled - Whether the extension is installed
   * @returns {BackgroundModel} - The model instance for chaining
   */
  setInstalled(isInstalled) {
    this.set('isInstalled', isInstalled);
    return this;
  }

  /**
   * Add a context menu item
   * 
   * @param {Object} menuItem - The context menu item to add
   * @returns {BackgroundModel} - The model instance for chaining
   */
  addContextMenu(menuItem) {
    const contextMenus = [...this.get('contextMenus')];
    contextMenus.push(menuItem);
    this.set('contextMenus', contextMenus);
    return this;
  }

  /**
   * Remove a context menu item
   * 
   * @param {string} menuItemId - The ID of the context menu item to remove
   * @returns {BackgroundModel} - The model instance for chaining
   */
  removeContextMenu(menuItemId) {
    const contextMenus = this.get('contextMenus').filter(item => item.id !== menuItemId);
    this.set('contextMenus', contextMenus);
    return this;
  }

  /**
   * Clear all context menu items
   * 
   * @returns {BackgroundModel} - The model instance for chaining
   */
  clearContextMenus() {
    this.set('contextMenus', []);
    return this;
  }

  /**
   * Load settings from storage
   * 
   * @param {Object} storage - The storage service
   * @returns {Promise<BackgroundModel>} - The model instance for chaining
   */
  async loadSettings(storage) {
    try {
      const settings = await storage.get([
        'apiProvider',
        'apiKeys',
        'customSettings'
      ]);

      this.set('settings', {
        ...this.get('settings'),
        apiProvider: settings.apiProvider,
        apiKeys: settings.apiKeys || {},
        customSettings: settings.customSettings || {}
      });
    } catch (error) {
      secureLogger.error('Error loading settings:', error);
    }

    return this;
  }

  /**
   * Check if the user is authenticated
   * 
   * @returns {boolean} - Whether the user is authenticated
   */
  isAuthenticated() {
    const settings = this.get('settings');
    if (!settings.apiProvider) return false;

    if (settings.apiProvider === 'local') {
      return !!settings.apiKeys?.local && !!settings.customSettings?.local?.url;
    }

    return !!settings.apiKeys?.[settings.apiProvider];
  }
}

/**
 * Factory function for creating a BackgroundModel instance
 * 
 * @param {Object} container - The dependency injection container
 * @returns {BackgroundModel} - The BackgroundModel instance
 */
  const createBackgroundModel = (container) => {
  const storage = container.get('storage');
  const model = new BackgroundModel();

  // Load settings from storage
  model.loadSettings(storage);

  return model;
};

  // Expose to global scope
  global.BackgroundModel = BackgroundModel;
  global.createBackgroundModel = createBackgroundModel;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);

// ES6 Module exports
export const BackgroundModel = globalThis.BackgroundModel;
export const createBackgroundModel = globalThis.createBackgroundModel;

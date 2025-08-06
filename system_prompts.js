/**
 * System Prompts page entry point
 * Initializes the System Prompts MVC components
 */

import { container, eventBus } from './src/architecture.js';
import { createApiSettingsModel } from './src/models/ApiSettingsModel.js';
import { SystemPromptsView } from './src/views/SystemPromptsView.js';
import { SystemPromptsController } from './src/controllers/SystemPromptsController.js';
import { createStorageService } from './src/services/StorageService.js';
import { createStore, thunkMiddleware, loggerMiddleware } from './src/stateManagement.js';
import rootReducer from './src/state/index.js';
import { loadSettingsFromStorage } from './src/state/apiSettings.js';

/**
 * Initialize the System Prompts application
 */
async function initializeSystemPrompts() {
  try {
    console.log('Initializing System Prompts page...');

    // Create and register the store
    const store = createStore({
      rootReducer,
      middleware: [
        thunkMiddleware,
        typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production' ? loggerMiddleware : null
      ].filter(Boolean),
      debug: typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
    });

    // Register services in the container
    container.register('store', () => store, true);
    container.register('storage', createStorageService, true);
    container.register('apiSettingsModel', createApiSettingsModel, true);

    // Load initial data from storage
    await store.dispatch(loadSettingsFromStorage());

    // Get the model and storage
    const model = container.get('apiSettingsModel');
    const storage = container.get('storage');

    // Load data into the model from storage
    await model.loadFromStorage(storage);

    // Create the view and controller
    const element = document.querySelector('#system-prompts-container') || document.body;
    const view = new SystemPromptsView(element, model);
    const controller = new SystemPromptsController(model, view, { storage });

    // Set up the controller reference in the view
    view.controller = controller;

    // Register the created instances in the container
    container.register('systemPromptsView', () => view, true);
    container.register('systemPromptsController', () => controller, true);

    // Set up event listeners for cross-component communication
    setupEventListeners(controller, model, view, store);

    console.log('System Prompts page initialized successfully');

  } catch (error) {
    console.error('Error initializing System Prompts page:', error);
  }
}

/**
 * Set up event listeners for component communication
 * @param {Object} controller - Controller instance
 * @param {Object} model - Model instance
 * @param {Object} view - View instance
 * @param {Object} store - Store instance
 */
function setupEventListeners(controller, model, view, store) {
  // Listen for state changes
  store.subscribe((prevState) => {
    const state = store.getState();
    
    // Update view when API settings change
    if (prevState.apiSettings !== state.apiSettings) {
      view.render();
    }
  });

  // Listen for model changes
  model.on('change', (change) => {
    view.onModelChange(change, model);
  });

  // Listen for system prompt validation events
  eventBus.on('systemPrompts:validate', async (data) => {
    const isValid = data.prompt && data.prompt.trim().length > 0;
    eventBus.emit('systemPrompts:validated', { 
      provider: data.provider, 
      isValid,
      prompt: data.prompt 
    });
  });
}

/**
 * DOM ready initialization
 */
document.addEventListener('DOMContentLoaded', () => {
  initializeSystemPrompts().catch(error => {
    console.error('Failed to initialize System Prompts:', error);
  });
});

// Export for external access
window.initializeSystemPrompts = initializeSystemPrompts;
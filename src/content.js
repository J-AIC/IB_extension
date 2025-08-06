// content.js
// This file is the entry point for the content script.
// It initializes the ContentController and sets up the application.

import { container, eventBus } from './architecture.js';
import { createContentModel } from './models/ContentModel.js';
import { createContentController } from './controllers/ContentController.js';
import { createStorageService } from './services/StorageService.js';

// Initialize the content script
(async () => {
  'use strict';
  
  try {
    // Register services in the container
    container.register('storage', createStorageService, true);
    container.register('contentModel', createContentModel, true);
    container.register('contentController', createContentController, true);
    
    // Get the content controller
    const contentController = container.get('contentController');
    
    // Initialize the content script
    await contentController.handleAction('initialize');
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        const relevantKeys = ['apiProvider', 'apiKeys', 'customSettings'];
        const hasRelevantChanges = relevantKeys.some(key => changes[key]);
        
        if (hasRelevantChanges) {
          // Remove existing container and button
          const existingContainer = document.getElementById("my-extension-chat-container");
          if (existingContainer) {
            existingContainer.remove();
          }
          
          const existingButton = document.querySelector('.chat-toggle-button');
          if (existingButton) {
            existingButton.remove();
          }
          
          // Re-initialize
          contentController.handleAction('initialize');
        }
      }
    });
  } catch (error) {
    console.error('Error initializing content script:', error);
  }
})();
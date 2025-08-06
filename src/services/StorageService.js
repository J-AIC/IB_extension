/**
 * StorageService.js
 * 
 * This file defines the StorageService class, which provides an interface for interacting with Chrome's storage API.
 * It abstracts the details of storage operations and provides a consistent interface.
 */

(function(global) {
  'use strict';

  /**
   * StorageService class
   * 
   * Provides an interface for interacting with Chrome's storage API.
   */
  class StorageService {
      /**
       * Constructor
       * 
       * @param {Object} [options={}] - Options for the service
       */
      constructor(options = {}) {
          this.options = {
              storageArea: 'local', // 'local' or 'sync'
              conversationHistoryKey: 'chatHistory',
              maxConversations: 50,
              ...options
          };
          
          // Get the appropriate storage area
          this.storage = chrome.storage[this.options.storageArea];
          
          // Fallback storage for when extension context is invalidated
          this.fallbackStorage = {};
      }
      
      /**
       * Check if extension context is still valid
       */
      isExtensionContextValid() {
          try {
              // Check if chrome APIs are available and context is valid
              if (!chrome || !chrome.runtime) {
                  return false;
              }
              
              // Try to access runtime.id - this will throw if context is invalidated
              const id = chrome.runtime.id;
              return !!id;
          } catch (error) {
              // Context invalidated or chrome APIs not available
              return false;
          }
      }
      
      /**
       * Get fallback storage values when extension context is invalidated
       * 
       * @param {string|Array<string>} keys - The key(s) to get
       * @returns {Object} - The fallback values
       */
      getFallbackStorage(keys) {
          if (typeof keys === 'string') {
              return { [keys]: this.fallbackStorage[keys] || null };
          } else if (Array.isArray(keys)) {
              const result = {};
              keys.forEach(key => {
                  result[key] = this.fallbackStorage[key] || null;
              });
              return result;
          } else {
              return { ...this.fallbackStorage };
          }
      }
      
      /**
       * Get values from storage
       * 
       * @param {string|Array<string>} keys - The key(s) to get
       * @returns {Promise<Object>} - The values from storage
       */
      async get(keys) {
          return new Promise((resolve, reject) => {
              try {
                  // Check if extension context is still valid
                  if (!this.isExtensionContextValid()) {
                      console.warn('Extension context invalidated, using fallback storage');
                      resolve(this.getFallbackStorage(keys));
                      return;
                  }
                  
                  this.storage.get(keys, (result) => {
                      if (chrome.runtime.lastError) {
                          const error = chrome.runtime.lastError.message;
                          if (error.includes('Extension context invalidated')) {
                              console.warn('Extension context invalidated, using fallback storage');
                              resolve(this.getFallbackStorage(keys));
                          } else {
                              reject(new Error(error));
                          }
                      } else {
                          resolve(result);
                      }
                  });
              } catch (error) {
                  console.warn('Storage access failed, using fallback:', error);
                  resolve(this.getFallbackStorage(keys));
              }
          });
      }
      
      /**
       * Set values in storage
       * 
       * @param {Object} items - The items to set
       * @returns {Promise<void>} - A promise that resolves when the operation is complete
       */
      async set(items) {
          return new Promise((resolve, reject) => {
              try {
                  // Check if extension context is still valid
                  if (!this.isExtensionContextValid()) {
                      console.warn('Extension context invalidated, using fallback storage');
                      Object.assign(this.fallbackStorage, items);
                      resolve();
                      return;
                  }
                  
                  this.storage.set(items, () => {
                      if (chrome.runtime.lastError) {
                          const error = chrome.runtime.lastError.message;
                          if (error.includes('Extension context invalidated')) {
                              console.warn('Extension context invalidated, using fallback storage');
                              Object.assign(this.fallbackStorage, items);
                              resolve();
                          } else {
                              reject(new Error(error));
                          }
                      } else {
                          // Also update fallback storage for consistency
                          Object.assign(this.fallbackStorage, items);
                          resolve();
                      }
                  });
              } catch (error) {
                  console.warn('Storage set failed, using fallback:', error);
                  Object.assign(this.fallbackStorage, items);
                  resolve();
              }
          });
      }
      
      /**
       * Remove keys from storage
       * 
       * @param {string|Array<string>} keys - The key(s) to remove
       * @returns {Promise<void>} - A promise that resolves when the operation is complete
       */
      async remove(keys) {
          return new Promise((resolve, reject) => {
              this.storage.remove(keys, () => {
                  if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message));
                  } else {
                      resolve();
                  }
              });
          });
      }
      
      /**
       * Clear all storage
       * 
       * @returns {Promise<void>} - A promise that resolves when the operation is complete
       */
      async clear() {
          return new Promise((resolve, reject) => {
              this.storage.clear(() => {
                  if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message));
                  } else {
                      resolve();
                  }
              });
          });
      }
      
      /**
       * Save a conversation to history
       * 
       * @param {Object} conversation - The conversation to save
       * @returns {Promise<void>} - A promise that resolves when the operation is complete
       */
      async saveConversation(conversation) {
          try {
              // Get existing history
              const result = await this.get(this.options.conversationHistoryKey);
              let history = result[this.options.conversationHistoryKey] || [];
              
              // Ensure history is an array
              if (!Array.isArray(history)) {
                  history = [];
              }
              
              // Add the new conversation
              history.unshift(conversation);
              
              // Limit the number of conversations
              if (history.length > this.options.maxConversations) {
                  history = history.slice(0, this.options.maxConversations);
              }
              
              // Save the updated history
              await this.set({ [this.options.conversationHistoryKey]: history });
          } catch (error) {
              console.error('Error saving conversation:', error);
              throw error;
          }
      }
      
      /**
       * Get conversation history
       * 
       * @returns {Promise<Array>} - The conversation history
       */
      async getConversationHistory() {
          try {
              const result = await this.get(this.options.conversationHistoryKey);
              return result[this.options.conversationHistoryKey] || [];
          } catch (error) {
              console.error('Error getting conversation history:', error);
              return [];
          }
      }
      
      /**
       * Clear conversation history
       * 
       * @returns {Promise<void>} - A promise that resolves when the operation is complete
       */
      async clearConversationHistory() {
          try {
              await this.set({ [this.options.conversationHistoryKey]: [] });
          } catch (error) {
              console.error('Error clearing conversation history:', error);
              throw error;
          }
      }
  }

  /**
   * Create a mock storage service for testing
   * 
   * @returns {StorageService} - A mock storage service
   */
  const createMockStorageService = () => {
      const service = new StorageService();
      
      // Mock storage
      const mockStorage = {};
      
      // Override methods with mock implementations
      service.get = async (keys) => {
          if (typeof keys === 'string') {
              return { [keys]: mockStorage[keys] };
          } else if (Array.isArray(keys)) {
              const result = {};
              keys.forEach(key => {
                  result[key] = mockStorage[key];
              });
              return result;
          } else {
              return { ...mockStorage };
          }
      };
      
      service.set = async (items) => {
          Object.assign(mockStorage, items);
      };
      
      service.remove = async (keys) => {
          if (typeof keys === 'string') {
              delete mockStorage[keys];
          } else if (Array.isArray(keys)) {
              keys.forEach(key => {
                  delete mockStorage[key];
              });
          }
      };
      
      service.clear = async () => {
          Object.keys(mockStorage).forEach(key => {
              delete mockStorage[key];
          });
      };
      
      return service;
  };

  // Export a factory function for dependency injection
  const createStorageService = (container) => {
      // For testing in non-extension environments, use the mock service
      if (typeof chrome === 'undefined' || !chrome.storage) {
          console.warn('Chrome storage API not available, using mock storage service');
          return createMockStorageService();
      }
      
      return new StorageService();
  };

  // Expose to global scope
  global.StorageService = StorageService;
  global.createMockStorageService = createMockStorageService;
  global.createStorageService = createStorageService;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);

// ES6 Module exports
export const StorageService = globalThis.StorageService;
export const createMockStorageService = globalThis.createMockStorageService;
export const createStorageService = globalThis.createStorageService;
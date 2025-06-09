/**
 * preloadLogger.js
 * 
 * Purpose: Preload the secureLogger in different environments and ensure it's globally available
 * 
 * This script should be included before any scripts that need to use the secureLogger.
 * It handles three scenarios:
 * 1. Extension context (content script, popup, background)
 * 2. Web pages with script tags
 * 3. Module-based web applications
 */

(function() {
  // Check if secureLogger has already been defined
  if (typeof window !== 'undefined' && window.secureLogger) {
    return;
  }
  
  // A minimal fallback implementation to use until the real logger is loaded
  const fallbackLogger = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    debug: function(DEBUG, ...args) { if (DEBUG) console.log(...args); },
    group: console.group.bind(console),
    groupEnd: console.groupEnd.bind(console),
    redactSensitiveData: data => data,
    getStoredLogs: () => [],
    exportLogs: () => '[]',
    downloadLogs: () => console.warn('Download logs not available in fallback'),
    clearLogs: () => {}
  };
  
  // Try to make the fallback available globally
  try {
    if (typeof window !== 'undefined') {
      window.secureLogger = fallbackLogger;
    }
    if (typeof self !== 'undefined') {
      self.secureLogger = fallbackLogger;
    }
    if (typeof globalThis !== 'undefined') {
      globalThis.secureLogger = fallbackLogger;
    }
  } catch (e) {
    console.error('Failed to initialize fallback logger:', e);
  }
  
  // Function to load the secureLogger
  function loadSecureLogger() {
    // For Chrome extension context
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        // Either load the script with fetch or inject it with a script tag
        fetch(chrome.runtime.getURL('utils/secureLogger.js'))
          .then(response => response.text())
          .then(scriptContent => {
            // Execute the script in the global context
            const script = document.createElement('script');
            script.textContent = scriptContent;
            document.head.appendChild(script);
            document.head.removeChild(script); // Clean up
            console.log('SecureLogger loaded in extension context');
          })
          .catch(error => {
            console.error('Error loading secureLogger in extension context:', error);
          });
      } catch (e) {
        console.error('Failed to load secureLogger in extension context:', e);
      }
    }
    // For web page context (script tags)
    else if (typeof document !== 'undefined') {
      try {
        // Inject the script tag
        const script = document.createElement('script');
        script.src = './utils/secureLogger.js';  // Adjust path as needed
        script.async = false;  // Load synchronously to ensure it's available before dependent scripts
        script.onload = function() {
          console.log('SecureLogger loaded via script tag');
        };
        script.onerror = function() {
          console.error('Failed to load secureLogger via script tag');
        };
        // Add to head if it exists, otherwise to the document
        (document.head || document).appendChild(script);
      } catch (e) {
        console.error('Failed to inject secureLogger script tag:', e);
      }
    }
  }
  
  // Try to load the secureLogger
  loadSecureLogger();
  
  // Export a helper function to get the secureLogger
  function getSecureLogger() {
    if (typeof window !== 'undefined' && window.secureLogger) {
      return window.secureLogger;
    }
    if (typeof self !== 'undefined' && self.secureLogger) {
      return self.secureLogger;
    }
    if (typeof globalThis !== 'undefined' && globalThis.secureLogger) {
      return globalThis.secureLogger;
    }
    return fallbackLogger;
  }
  
  // Make the helper function available globally
  if (typeof window !== 'undefined') {
    window.getSecureLogger = getSecureLogger;
  }
  if (typeof self !== 'undefined') {
    self.getSecureLogger = getSecureLogger;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.getSecureLogger = getSecureLogger;
  }
  
  // Also support module environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getSecureLogger };
  }
})(); 
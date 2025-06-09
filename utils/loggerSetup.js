/**
 * loggerSetup.js
 * 
 * Global initialization for secureLogger to ensure consistent access across the extension.
 * This file should be loaded before any other scripts that need secureLogger.
 */

// Initialize the secureLogger if not already present
(function() {
  // If secureLogger is not already defined in any global scope, load it from utils/secureLogger.js
  if (typeof secureLogger === 'undefined' && 
      (typeof window === 'undefined' || !window.secureLogger) && 
      (typeof self === 'undefined' || !self.secureLogger) && 
      (typeof globalThis === 'undefined' || !globalThis.secureLogger)) {
    
    try {
      // For background/content scripts in Chrome extensions
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // Import secureLogger.js programmatically for Chrome extensions
        importScripts(chrome.runtime.getURL('utils/secureLogger.js'));
        console.log('secureLogger loaded successfully via importScripts');
      }
      // For normal web pages - this won't execute in extension contexts but is here for completeness
      else if (typeof document !== 'undefined') {
        console.log('secureLogger should be loaded via script tag before this file');
      }
    } catch (e) {
      console.error('Failed to load secureLogger.js:', e);
    }
  }

  // Get secureLogger from wherever it might be defined
  const logger = 
    (typeof secureLogger !== 'undefined') ? secureLogger :
    (typeof window !== 'undefined' && window.secureLogger) ? window.secureLogger :
    (typeof self !== 'undefined' && self.secureLogger) ? self.secureLogger :
    (typeof globalThis !== 'undefined' && globalThis.secureLogger) ? globalThis.secureLogger : null;

  // If we found secureLogger, make sure it's available everywhere
  if (logger) {
    // Make available in all global contexts to ensure consistent access
    if (typeof window !== 'undefined') window.secureLogger = logger;
    if (typeof self !== 'undefined') self.secureLogger = logger;
    if (typeof globalThis !== 'undefined') globalThis.secureLogger = logger;
    
    // Make secureLogger available for module contexts
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = logger;
    } else if (typeof exports !== 'undefined') {
      exports.secureLogger = logger;
    }
    
    logger.log('secureLogger initialized and globally accessible');
  } else {
    // If we still don't have secureLogger, create a placeholder that won't break anything
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
    
    // Make available in all global contexts
    if (typeof window !== 'undefined') window.secureLogger = fallbackLogger;
    if (typeof self !== 'undefined') self.secureLogger = fallbackLogger;
    if (typeof globalThis !== 'undefined') globalThis.secureLogger = fallbackLogger;
    
    // Make available for module contexts
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = fallbackLogger;
    } else if (typeof exports !== 'undefined') {
      exports.secureLogger = fallbackLogger;
    }
    
    console.warn('Using temporary secureLogger fallback - this should be replaced with proper implementation');
  }
})(); 
/**
 * loggerImport.js
 * 
 * Legacy helper script maintained for backward compatibility.
 * In modern code, you should use utils/loggerSetup.js instead.
 * 
 * This script uses the global secureLogger initialized by loggerSetup.js
 * and provides backward compatibility for older parts of the codebase.
 * 
 * Usage:
 * 1. In manifest.json, include this script after loggerSetup.js:
 *    "content_scripts": [
 *      {
 *        "matches": ["<all_urls>"],
 *        "js": ["utils/secureLogger.js", "utils/loggerSetup.js", "js/loggerImport.js", "your-script.js"]
 *      }
 *    ]
 * 
 * 2. Or within HTML:
 *    <script src="utils/secureLogger.js"></script>
 *    <script src="utils/loggerSetup.js"></script>
 *    <script src="js/loggerImport.js"></script>
 *    <script src="your-script.js"></script>
 */

// This is now just a wrapper that ensures backward compatibility
// It doesn't need to do much since loggerSetup.js does all the heavy lifting
(function() {
  // Check if secureLogger has been properly initialized
  if (typeof secureLogger !== 'undefined') {
    secureLogger.log('Legacy loggerImport.js executed - secureLogger is available');
  } else {
    console.error('secureLogger not initialized - please ensure utils/secureLogger.js and utils/loggerSetup.js are loaded first');
  }
})();

// Example usage of the secure logger
// secureLogger.log('Logger import script executed'); 
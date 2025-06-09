# Secure Logger Usage Guide

## Overview

The `secureLogger` is a centralized logging utility designed to ensure consistent and secure logging across the extension. It automatically redacts sensitive information like API keys and credentials to prevent security issues.

## How to Access secureLogger

The `secureLogger` is now globally available throughout the extension without the need for fallback implementations. This is accomplished through:

1. `utils/secureLogger.js` - The core implementation with redaction logic
2. `utils/loggerSetup.js` - Ensures secureLogger is properly initialized and globally accessible
3. `js/loggerImport.js` - Legacy compatibility script (optional)

## Using secureLogger in Your Code

### In JavaScript Files

Simply use the global `secureLogger` object directly:

```javascript
// At the top of your file (optional comment for clarity)
// secureLogger is globally available via utils/loggerSetup.js

function myFunction() {
  secureLogger.log('This is a log message');
  secureLogger.error('This is an error message');
  
  // With object data (automatically redacted)
  secureLogger.log('User data:', { 
    name: 'Test User', 
    apiKey: 'sk-123456789' // This will be redacted automatically
  });
  
  // Debug logging (only shown when DEBUG is true)
  const DEBUG = true;
  secureLogger.debug(DEBUG, 'Debug message');
}
```

### In HTML Files

Include the logger scripts in your HTML files in the following order:

```html
<head>
  <!-- Include logger scripts -->
  <script src="../utils/secureLogger.js"></script>
  <script src="../utils/loggerSetup.js"></script>
  
  <!-- Rest of your scripts -->
  <script src="your-script.js"></script>
</head>
```

Or use the template include:

```html
<head>
  <!-- Include from template -->
  <include src="html_templates/logger_include.html"></include>
  
  <!-- Rest of your scripts -->
  <script src="your-script.js"></script>
</head>
```

## Available Methods

The `secureLogger` provides the following methods:

- `log(...args)`: General purpose logging with automatic redaction
- `error(...args)`: Error logging with automatic redaction
- `debug(DEBUG, ...args)`: Debug logging that only outputs when the first parameter is true
- `group(label)`: Starts a console group (for organizing logs)
- `groupEnd()`: Ends a console group
- `redactSensitiveData(data)`: Explicitly redact sensitive data in an object or string
- `exportLogs()`: Export logs as JSON string
- `downloadLogs()`: Download logs as a JSON file
- `clearLogs()`: Clear stored logs
- `getStoredLogs()`: Get all stored logs as an array

## Best Practices

1. **Always use secureLogger instead of console.log/error for sensitive operations**
2. **Don't create fallback implementations** - instead ensure the proper scripts are loaded
3. **Include logger scripts at the beginning** of your HTML or before any scripts that need logging
4. Use `debug()` for development-only logging
5. Remember secureLogger includes storage for logs which can be retrieved using `getStoredLogs()`

## Troubleshooting

If you see "secureLogger not found" errors:

1. Make sure `utils/secureLogger.js` and `utils/loggerSetup.js` are included in the correct order
2. Check that the paths to the scripts are correct
3. For Chrome extensions, ensure the scripts are properly registered in `manifest.json`
4. Verify the scripts are included in the `web_accessible_resources` section of manifest.json 
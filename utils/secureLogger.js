/**
 * secureLogger.js
 * Centralized secure logging utility to prevent exposure of sensitive information
 * Compatible with both module and non-module environments
 */

// Sensitive data patterns to redact
const SENSITIVE_PATTERNS = [
  // API Keys/Tokens
  { pattern: /(["']?(?:api[_-]?key|token|authorization)["']?\s*[:=]\s*["'])(.*?)(["'])/gi, replacement: '$1[REDACTED]$3' },
  { pattern: /([Bb]earer\s+)([\w\-\.=]+)/g, replacement: '$1[REDACTED]' },
  { pattern: /(Authorization['"]?\s*:\s*['"]?Bearer\s+)([\w\-\.=]+)/gi, replacement: '$1[REDACTED]' },
  { pattern: /([Aa]uthorization['"]?\s*:\s*['"]?)([^'"{})\s,]+)/gi, replacement: '$1[REDACTED]' },
  { pattern: /(x-api-key['"]?\s*:\s*['"]?)([^'"}\s,]+)/gi, replacement: '$1[REDACTED]' },
  { pattern: /sk-\w{20,}/g, replacement: '[REDACTED-API-KEY]' },
  
  // AWS Credentials
  { pattern: /(accessKey|secretKey|sessionToken)["']?\s*:\s*["']([^"']+)["']/gi, replacement: '$1: "[REDACTED]"' },
  { pattern: /(Credential=)([^\/]+)/g, replacement: '$1[REDACTED]' },
  
  // General sensitive data  
  { pattern: /(password|secret|credential|api_?key)["']?\s*:\s*["']([^"']+)["']/gi, replacement: '$1: "[REDACTED]"' }
];

// Store logs for analytics - limited to last 100 entries to avoid excessive storage
let logStorage = {
  logs: [],
  maxEntries: 100
};

/**
 * Redacts sensitive information from log messages
 * @param {*} data - Data to be sanitized
 * @returns {*} - Sanitized data with sensitive information redacted
 */
function redactSensitiveData(data) {
  if (typeof data === 'string') {
    let result = data;
    SENSITIVE_PATTERNS.forEach(({pattern, replacement}) => {
      result = result.replace(pattern, replacement);
    });
    return result;
  }
  
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'object') {
    // Handle objects (including arrays)
    const isArray = Array.isArray(data);
    const result = isArray ? [...data] : {...data};
    
    // List of fields that should be redacted completely
    const sensitiveKeys = [
      'apiKey', 'api_key', 'api-key', 'token', 'password', 'secret', 
      'credential', 'authorization', 'accessKey', 'secretKey', 'sessionToken'
    ];
    
    for (const key in result) {
      // If the key is in the sensitive list, redact the value completely
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
        result[key] = '[REDACTED]';
      }
      // Otherwise recursively redact sensitive data within nested objects
      else if (typeof result[key] === 'object' && result[key] !== null) {
        result[key] = redactSensitiveData(result[key]);
      }
      // For string values, apply regex patterns
      else if (typeof result[key] === 'string') {
        result[key] = redactSensitiveData(result[key]);
      }
    }
    return result;
  }
  
  // Return primitive values as is
  return data;
}

/**
 * Store a log entry in memory and localStorage if available
 * @param {string} level - Log level (log, debug, error)
 * @param {Array} args - Log arguments
 */
function storeLogEntry(level, args) {
  try {
    // Create log entry with timestamp
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      content: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '),
    };

    // Store in memory
    logStorage.logs.push(logEntry);
    
    // Keep only the last N entries
    if (logStorage.logs.length > logStorage.maxEntries) {
      logStorage.logs = logStorage.logs.slice(-logStorage.maxEntries);
    }

    // If localStorage is available, also store there
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('secureLogger_logs', JSON.stringify(logStorage.logs));
      } catch (storageError) {
        // Silent fail if localStorage isn't available or quota exceeded
      }
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      // For Chrome extensions, use chrome.storage.local
      chrome.storage.local.set({ 'secureLogger_logs': logStorage.logs });
    }
  } catch (e) {
    // Fail silently - we don't want logging to break functionality
  }
}

/**
 * Secure console log that automatically redacts sensitive information
 * @param {...any} args - Arguments to log
 */
function log(...args) {
  const sanitizedArgs = args.map(arg => redactSensitiveData(arg));
  console.log(...sanitizedArgs);
  storeLogEntry('log', sanitizedArgs);
}

/**
 * Secure console debug that automatically redacts sensitive information
 * Only logs when DEBUG is true
 * @param {boolean} DEBUG - Debug flag
 * @param {...any} args - Arguments to log
 */
function debug(DEBUG, ...args) {
  if (!DEBUG) return;
  const sanitizedArgs = args.map(arg => redactSensitiveData(arg));
  console.log(...sanitizedArgs);
  storeLogEntry('debug', sanitizedArgs);
}

/**
 * Secure console error that automatically redacts sensitive information
 * @param {...any} args - Arguments to log
 */
function error(...args) {
  const sanitizedArgs = args.map(arg => redactSensitiveData(arg));
  console.error(...sanitizedArgs);
  storeLogEntry('error', sanitizedArgs);
}

/**
 * Secure console group with automatic redaction
 * @param {string} label - Group label
 */
function group(label) {
  console.group(redactSensitiveData(label));
}

/**
 * End the current console group
 */
function groupEnd() {
  console.groupEnd();
}

/**
 * Export stored logs as JSON
 * @returns {string} - JSON string of logs
 */
function exportLogs() {
  return JSON.stringify(logStorage.logs, null, 2);
}

/**
 * Save logs to a file in the browser
 */
function downloadLogs() {
  try {
    const json = exportLogs();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `logs_${new Date().toISOString().replace(/:/g, '-')}.json`;
    
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (e) {
    console.error('Failed to download logs:', e);
  }
}

/**
 * Clear stored logs
 */
function clearLogs() {
  logStorage.logs = [];
  
  // Clear from localStorage if available
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('secureLogger_logs');
  } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.remove('secureLogger_logs');
  }
  
  return true;
}

// Define the logger object
const secureLogger = {
  log,
  debug,
  error,
  group,
  groupEnd,
  redactSensitiveData,
  exportLogs,
  downloadLogs,
  clearLogs,
  getStoredLogs: () => [...logStorage.logs]
};

// Make secureLogger available globally for browser and extension contexts
if (typeof window !== 'undefined') {
  window.secureLogger = secureLogger;
}

// Special handling for Chrome extensions
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Make available in the global context for Chrome extensions
  self.secureLogger = secureLogger;
  
  // Support CommonJS if needed
  try {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = secureLogger;
    }
  } catch (e) {
    // Ignore module errors in extension context
  }
}
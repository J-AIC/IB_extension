/**
 * エクステンション全体で一貫したsecureLoggerへのアクセスを保証するためのグローバル初期化
 * このファイルはsecureLoggerを必要とする他のスクリプトよりも前に読み込まれる必要があります
 */

(function() {
  const logger = 
    (typeof secureLogger !== 'undefined') ? secureLogger :
    (typeof window !== 'undefined' && window.secureLogger) ? window.secureLogger :
    (typeof self !== 'undefined' && self.secureLogger) ? self.secureLogger :
    (typeof globalThis !== 'undefined' && globalThis.secureLogger) ? globalThis.secureLogger : null;

  if (logger) {
    if (typeof window !== 'undefined') window.secureLogger = logger;
    if (typeof self !== 'undefined') self.secureLogger = logger;
    if (typeof globalThis !== 'undefined') globalThis.secureLogger = logger;
    
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = logger;
    } else if (typeof exports !== 'undefined') {
      exports.secureLogger = logger;
    }
    
    logger.log('secureLogger initialized and globally accessible');
  } else {
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
    
    if (typeof window !== 'undefined') window.secureLogger = fallbackLogger;
    if (typeof self !== 'undefined') self.secureLogger = fallbackLogger;
    if (typeof globalThis !== 'undefined') globalThis.secureLogger = fallbackLogger;
    
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = fallbackLogger;
    } else if (typeof exports !== 'undefined') {
      exports.secureLogger = fallbackLogger;
    }
    
    console.warn('Using temporary secureLogger fallback - this should be replaced with proper implementation');
  }
})(); 
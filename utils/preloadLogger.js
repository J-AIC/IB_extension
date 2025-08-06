/**
 * 異なる環境でsecureLoggerをプリロードし、グローバルに利用可能にする
 * 
 * このスクリプトはsecureLoggerを使用する他のスクリプトよりも前にインクルードされる必要があります
 * 以下の3つのシナリオを処理します：
 * 1. エクステンションコンテキスト（コンテントスクリプト、ポップアップ、バックグラウンド）
 * 2. スクリプトタグ付きのWebページ
 * 3. モジュールベースのWebアプリケーション
 */

(function() {
  if (typeof window !== 'undefined' && window.secureLogger) {
    return;
  }
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
  
  /**
   * secureLoggerを読み込む関数
   */
  function loadSecureLogger() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        fetch(chrome.runtime.getURL('utils/secureLogger.js'))
          .then(response => response.text())
          .then(scriptContent => {
            const script = document.createElement('script');
            script.textContent = scriptContent;
            document.head.appendChild(script);
            document.head.removeChild(script);
            console.log('SecureLogger loaded in extension context');
          })
          .catch(error => {
            console.error('Error loading secureLogger in extension context:', error);
          });
      } catch (e) {
        console.error('Failed to load secureLogger in extension context:', e);
      }
    }
    else if (typeof document !== 'undefined') {
      try {
        const script = document.createElement('script');
        script.src = './utils/secureLogger.js';
        script.async = false;
        script.onload = function() {
          console.log('SecureLogger loaded via script tag');
        };
        script.onerror = function() {
          console.error('Failed to load secureLogger via script tag');
        };
        (document.head || document).appendChild(script);
      } catch (e) {
        console.error('Failed to inject secureLogger script tag:', e);
      }
    }
  }
  
  loadSecureLogger();
  
  /**
   * secureLoggerを取得するヘルパー関数
   * @returns {Object} secureLoggerインスタンス
   */
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
  
  if (typeof window !== 'undefined') {
    window.getSecureLogger = getSecureLogger;
  }
  if (typeof self !== 'undefined') {
    self.getSecureLogger = getSecureLogger;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.getSecureLogger = getSecureLogger;
  }
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getSecureLogger };
  }
})(); 
/**
 * 機密情報の漏洩を防ぐ中央集中型セキュアログユーティリティ
 * モジュールおよび非モジュール環境の両方で使用可能
 */

const SENSITIVE_PATTERNS = [
  { pattern: /(["']?(?:api[_-]?key|token|authorization)["']?\s*[:=]\s*["'])(.*?)(["'])/gi, replacement: '$1[REDACTED]$3' },
  { pattern: /([Bb]earer\s+)([\w\-\.=]+)/g, replacement: '$1[REDACTED]' },
  { pattern: /(Authorization['"]?\s*:\s*['"]?Bearer\s+)([\w\-\.=]+)/gi, replacement: '$1[REDACTED]' },
  { pattern: /([Aa]uthorization['"]?\s*:\s*['"]?)([^'"{})\s,]+)/gi, replacement: '$1[REDACTED]' },
  { pattern: /(x-api-key['"]?\s*:\s*['"]?)([^'"}\s,]+)/gi, replacement: '$1[REDACTED]' },
  { pattern: /sk-\w{20,}/g, replacement: '[REDACTED-API-KEY]' },
  { pattern: /(accessKey|secretKey|sessionToken)["']?\s*:\s*["']([^"']+)["']/gi, replacement: '$1: "[REDACTED]"' },
  { pattern: /(Credential=)([^\/]+)/g, replacement: '$1[REDACTED]' },
  { pattern: /(password|secret|credential|api_?key)["']?\s*:\s*["']([^"']+)["']/gi, replacement: '$1: "[REDACTED]"' }
];

let logStorage = {
  logs: [],
  maxEntries: 100
};

/**
 * ログメッセージから機密情報を編集
 * @param {*} data - サニタイズするデータ
 * @returns {*} - 機密情報が編集されたサニタイズ済みデータ
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
  
  if (data instanceof Error) {
    return {
      name: data.name,
      message: redactSensitiveData(data.message),
      stack: data.stack ? redactSensitiveData(data.stack) : undefined,
      ...(data.cause && { cause: redactSensitiveData(data.cause) })
    };
  }
  
  if (typeof data === 'object') {
    const isArray = Array.isArray(data);
    const result = isArray ? [...data] : {...data};
    
    const sensitiveKeys = [
      'apiKey', 'api_key', 'api-key', 'token', 'password', 'secret', 
      'credential', 'authorization', 'accessKey', 'secretKey', 'sessionToken'
    ];
    
    for (const key in result) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
        result[key] = '[REDACTED]';
      }
      else if (typeof result[key] === 'object' && result[key] !== null) {
        result[key] = redactSensitiveData(result[key]);
      }
      else if (typeof result[key] === 'string') {
        result[key] = redactSensitiveData(result[key]);
      }
    }
    return result;
  }
  
  return data;
}

/**
 * ログエントリをメモリとlocalStorageに保存（利用可能な場合）
 * @param {string} level - ログレベル (log, debug, error)
 * @param {Array} args - ログ引数
 */
function storeLogEntry(level, args) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      content: args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          if (arg instanceof Error) {
            return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
          }
          try {
            return JSON.stringify(arg);
          } catch (jsonError) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' '),
    };

    logStorage.logs.push(logEntry);
    
    if (logStorage.logs.length > logStorage.maxEntries) {
      logStorage.logs = logStorage.logs.slice(-logStorage.maxEntries);
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('secureLogger_logs', JSON.stringify(logStorage.logs));
      } catch (storageError) {
        
      }
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ 'secureLogger_logs': logStorage.logs });
    }
  } catch (e) {
    
  }
}

/**
 * 機密情報を自動的に編集するセキュアコンソールログ
 * @param {...any} args - ログ出力する引数
 */
function log(...args) {
  const sanitizedArgs = args.map(arg => redactSensitiveData(arg));
  console.log(...sanitizedArgs);
  storeLogEntry('log', sanitizedArgs);
}

/**
 * 機密情報を自動的に編集するセキュアコンソールデバッグ
 * DEBUGがtrueの時のみログ出力
 * @param {boolean} DEBUG - デバッグフラグ
 * @param {...any} args - ログ出力する引数
 */
function debug(DEBUG, ...args) {
  if (!DEBUG) return;
  const sanitizedArgs = args.map(arg => redactSensitiveData(arg));
  console.log(...sanitizedArgs);
  storeLogEntry('debug', sanitizedArgs);
}

/**
 * 機密情報を自動的に編集するセキュアコンソールエラー
 * @param {...any} args - ログ出力する引数
 */
function error(...args) {
  const sanitizedArgs = args.map(arg => redactSensitiveData(arg));
  console.error(...sanitizedArgs);
  storeLogEntry('error', sanitizedArgs);
}

/**
 * 自動編集付きのセキュアコンソールグループ
 * @param {string} label - グループラベル
 */
function group(label) {
  console.group(redactSensitiveData(label));
}

/**
 * 現在のコンソールグループを終了
 */
function groupEnd() {
  console.groupEnd();
}

/**
 * 保存されたログをJSONとしてエクスポート
 * @returns {string} - ログのJSON文字列
 */
function exportLogs() {
  return JSON.stringify(logStorage.logs, null, 2);
}

/**
 * ブラウザでログをファイルに保存
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
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (e) {
    console.error('Failed to download logs:', e);
  }
}

/**
 * 保存されたログをクリア
 */
function clearLogs() {
  logStorage.logs = [];
  
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('secureLogger_logs');
  } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.remove('secureLogger_logs');
  }
  
  return true;
}

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

if (typeof window !== 'undefined') {
  window.secureLogger = secureLogger;
}

if (typeof chrome !== 'undefined' && chrome.runtime) {
  self.secureLogger = secureLogger;
  
  try {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = secureLogger;
    }
  } catch (e) {
    
  }
}
/**
 * secureLoggerによって収集されたログを表示し、ダウンロードするためのユーティリティ
 */
let secureLogger;
try {
  if (typeof window !== 'undefined' && window.secureLogger) {
    secureLogger = window.secureLogger;
  } 
  else if (typeof chrome !== 'undefined' && chrome.runtime) {
    secureLogger = self.secureLogger;
  }
} catch (e) {
  console.error('Failed to initialize logViewer:', e);
}

/**
 * ログビューワUI要素を作成し、DOMにアタッチ
 * @param {HTMLElement} targetElement - ログビューワをアタッチする要素
 * @param {Object} options - 設定オプション
 * @param {boolean} [options.expandable=true] - ログビューワが展開/折りたたみ可能かどうか
 * @param {boolean} [options.startCollapsed=true] - 最初に折りたたんだ状態で開始するかどうか
 * @param {number} [options.maxItems=50] - 表示するログアイテムの最大数
 * @param {string} [options.title='Log Viewer'] - ログビューワのタイトル
 * @returns {Object} - ログビューワとインタラクトするためのメソッド
 */
function createLogViewer(targetElement, options = {}) {
  const {
    expandable = true,
    startCollapsed = true,
    maxItems = 50,
    title = 'Log Viewer'
  } = options;

  if (!targetElement) {
    console.error('Target element is required for log viewer');
    return null;
  }

  const container = document.createElement('div');
  container.className = 'log-viewer-container';
  container.style.cssText = `
    border: 1px solid #ccc;
    border-radius: 4px;
    margin: 10px 0;
    max-height: ${startCollapsed ? '40px' : '300px'};
    overflow: hidden;
    transition: max-height 0.3s ease-in-out;
    background-color: #f9f9f9;
    font-family: monospace;
    font-size: 12px;
  `;

  const header = document.createElement('div');
  header.className = 'log-viewer-header';
  header.style.cssText = `
    padding: 8px 12px;
    background-color: #e9e9e9;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: ${expandable ? 'pointer' : 'default'};
    user-select: none;
  `;
  header.innerHTML = `
    <span>${title}</span>
    <div class="log-viewer-actions">
      <button class="refresh-btn" style="margin-right: 5px; padding: 2px 6px;">Refresh</button>
      <button class="download-btn" style="margin-right: 5px; padding: 2px 6px;">Download</button>
      <button class="clear-btn" style="margin-right: 5px; padding: 2px 6px;">Clear</button>
      ${expandable ? '<span class="toggle-btn">▼</span>' : ''}
    </div>
  `;

  const content = document.createElement('div');
  content.className = 'log-viewer-content';
  content.style.cssText = `
    max-height: 250px;
    overflow-y: auto;
    padding: 8px;
    display: ${startCollapsed ? 'none' : 'block'};
  `;

  container.appendChild(header);
  container.appendChild(content);
  targetElement.appendChild(container);

  if (expandable) {
    const toggleBtn = header.querySelector('.toggle-btn');
    toggleBtn.style.transition = 'transform 0.3s';
    
    if (startCollapsed) {
      toggleBtn.style.transform = 'rotate(-90deg)';
    }
    
    header.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      
      const isCollapsed = content.style.display === 'none';
      content.style.display = isCollapsed ? 'block' : 'none';
      container.style.maxHeight = isCollapsed ? '300px' : '40px';
      toggleBtn.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
      
      if (isCollapsed) {
        refreshLogs();
      }
    });
  }

  const refreshBtn = header.querySelector('.refresh-btn');
  refreshBtn.addEventListener('click', () => refreshLogs());

  const downloadBtn = header.querySelector('.download-btn');
  downloadBtn.addEventListener('click', () => {
    if (secureLogger) {
      secureLogger.downloadLogs();
    } else {
      alert('Logger not available. Cannot download logs.');
    }
  });

  const clearBtn = header.querySelector('.clear-btn');
  clearBtn.addEventListener('click', () => {
    if (secureLogger) {
      secureLogger.clearLogs();
      content.innerHTML = '<div class="log-entry">Logs cleared</div>';
    } else {
      alert('Logger not available. Cannot clear logs.');
    }
  });

  function renderLogs(logs) {
    if (!logs || !logs.length) {
      content.innerHTML = '<div class="log-entry">No logs to display</div>';
      return;
    }

    const logEntries = logs.slice(-maxItems);
    content.innerHTML = '';
    logEntries.forEach(entry => {
      const logItem = document.createElement('div');
      logItem.className = `log-entry log-${entry.level}`;
      logItem.style.cssText = `
        padding: 4px 8px;
        margin-bottom: 4px;
        border-left: 3px solid ${getColorForLevel(entry.level)};
        background-color: ${getBackgroundForLevel(entry.level)};
        word-break: break-all;
      `;
      
      logItem.innerHTML = `
        <span style="color: #666; font-size: 10px;">${formatTimestamp(entry.timestamp)}</span>
        <span style="font-weight: bold; margin-left: 8px; color: ${getColorForLevel(entry.level)};">
          ${entry.level.toUpperCase()}
        </span>
        <div style="margin-top: 2px;">${escapeHtml(entry.content)}</div>
      `;
      
      content.appendChild(logItem);
    });
    
    content.scrollTop = content.scrollHeight;
  }

  function getColorForLevel(level) {
    switch (level.toLowerCase()) {
      case 'error': return '#e74c3c';
      case 'debug': return '#3498db';
      default: return '#2ecc71';
    }
  }

  function getBackgroundForLevel(level) {
    switch (level.toLowerCase()) {
      case 'error': return '#ffebee';
      case 'debug': return '#e3f2fd';
      default: return '#ffffff';
    }
  }

  function formatTimestamp(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString() + '.' + 
             date.getMilliseconds().toString().padStart(3, '0');
    } catch (e) {
      return timestamp;
    }
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function refreshLogs() {
    if (secureLogger) {
      const logs = secureLogger.getStoredLogs();
      renderLogs(logs);
    } else {
      content.innerHTML = '<div class="log-entry">Logger not available</div>';
    }
  }

  if (!startCollapsed) {
    refreshLogs();
  }

  return {
    refresh: refreshLogs,
    render: (logs) => renderLogs(logs),
    getElement: () => container
  };
}

if (typeof window !== 'undefined') {
  window.createLogViewer = createLogViewer;
}

if (typeof chrome !== 'undefined' && chrome.runtime) {
  self.createLogViewer = createLogViewer;
  
  try {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = createLogViewer;
    }
  } catch (e) {
    
  }
} 
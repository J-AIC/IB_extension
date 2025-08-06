/**
 * コンテントスクリプト
 * InsightBuddy拡張機能のメインコンテントスクリプトで、MVCアーキテクチャでContentControllerを初期化します
 */

async function loadArchitectureComponents() {
  // Wait for architecture to be loaded globally
  return new Promise((resolve, reject) => {
    const checkArchitecture = () => {
      if (typeof globalThis !== 'undefined' && globalThis.container && globalThis.eventBus) {
        resolve();
      } else if (typeof window !== 'undefined' && window.container && window.eventBus) {
        resolve();
      } else {
        setTimeout(checkArchitecture, 10);
      }
    };
    checkArchitecture();
  });
}

/**
 * MVCアーキテクチャでコンテントスクリプトを初期化
 */
async function initializeContentScript() {
  try {
    console.log('Initializing Content Script with new architecture...');

    await loadArchitectureComponents();

    const container = globalThis.container || window.container;
    const eventBus = globalThis.eventBus || window.eventBus;
    const storageService = {
      async get(keys) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
      },
      async set(items) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.set(items, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
    };

    const contentModel = new (globalThis.Model || window.Model)({
      pageUrl: window.location.href,
      pageTitle: document.title,
      isInitialized: false
    });

    container.register('storage', () => storageService, true);
    container.register('contentModel', () => contentModel, true);

    await setupLegacyFeatures(contentModel, storageService);

    console.log('Content Script initialized successfully');

  } catch (error) {
    console.error('Error initializing Content Script:', error);
  }
}

/**
 * 後方互換性のためのレガシー機能設定
 * @param {Object} model - モデル
 * @param {Object} storage - ストレージサービス
 */
async function setupLegacyFeatures(model, storage) {
  const container = createContainer();
  initializeToggleButton(container);
  setupMessageHandlers(model, storage);
  await initializeBasedOnApiSettings(storage);
}

/**
 * チャットコンテナ要素を作成
 * @returns {HTMLElement} コンテナ要素
 */
function createContainer() {
  const container = document.createElement('div');
  container.id = "my-extension-chat-container";
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.right = "0";
  container.style.width = "0";
  container.style.height = "100vh";
  container.style.zIndex = "999999";
  container.style.border = "none";
  container.style.overflow = "hidden";
  container.style.transition = "width 0.3s ease";

  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("panel-chat.html");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";

  container.appendChild(iframe);
  document.body.appendChild(container);

  return container;
}

/**
 * チャットパネル用のトグルボタンを初期化
 * @param {HTMLElement} container - コンテナ要素
 */
function initializeToggleButton(container) {
  let isOpen = true; // Start with panel open
  
  // Initially show the chat panel
  container.style.width = "360px";
  document.body.style.marginRight = "360px";
  
  // Save initial state
  chrome.storage.local.set({ chatPanelOpen: true });

  // Function to toggle the chat panel
  const toggleChat = () => {
    isOpen = !isOpen;
    
    if (isOpen) {
      container.style.width = "360px";
      document.body.style.marginRight = "360px";
    } else {
      container.style.width = "0";
      document.body.style.marginRight = "0";
    }
    
    // Save state
    chrome.storage.local.set({ chatPanelOpen: isOpen });
  };

  // Listen for toggle messages from background script (extension icon click)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleChatPanel') {
      toggleChat();
      sendResponse({ success: true });
    }
  });
  
  // Export toggle function for external use
  window.toggleChatPanel = toggleChat;
}

/**
 * iframe通信用のメッセージハンドラー設定
 * @param {Object} model - モデル
 * @param {Object} storage - ストレージサービス
 */
function setupMessageHandlers(model, storage) {
  window.addEventListener('message', async (event) => {
    try {
      switch (event.data.type) {
        case 'GET_PAGE_INFO':
          event.source.postMessage({
            type: 'PAGE_INFO',
            title: document.title,
            url: window.location.href
          }, '*');
          break;

        case 'GET_FORM_CONTENT':
          const element = document.evaluate(
            event.data.xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;

          if (element) {
            event.source.postMessage({
              type: 'FORM_CONTENT',
              content: element.innerHTML,
              baseUrl: window.location.origin
            }, '*');
          }
          break;

        default:
          if (model.handleMessage) {
            model.handleMessage(event.data, event.source);
          }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
}

/**
 * API設定に基づいて初期化
 * @param {Object} storage - ストレージサービス
 */
async function initializeBasedOnApiSettings(storage) {
  try {
    const result = await storage.get(['apiProvider', 'apiKeys', 'customSettings']);
    
    if (result.apiProvider === 'local') {
      const isAuthenticated = await checkAuthentication(result);
      if (isAuthenticated) {
        await loadHomeContent(result);
      }
    }
  } catch (error) {
    console.error('Error initializing based on API settings:', error);
  }
}

/**
 * ローカルAPIの認証をチェック
 * @param {Object} settings - 設定
 * @returns {Promise<boolean>} 認証成功かどうか
 */
async function checkAuthentication(settings) {
        if (settings.apiProvider === 'local') {
            try {
                const customSettings = settings.customSettings?.local || {};
      if (!customSettings.url || !settings.apiKeys?.local) {
        return false;
      }

                const response = await fetch(`${customSettings.url}/check-display-url`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${settings.apiKeys.local}`
                    },
                    body: JSON.stringify({ current_url: window.location.href })
                });

                if (!response.ok) return false;
                const data = await response.json();
                return data.allowed;
            } catch (error) {
      console.error('Authentication check failed:', error);
                return false;
            }
        }
        return true;
    }

/**
 * ローカルAPI用のホームコンテンツをロード
 * @param {Object} settings - 設定
 */
async function loadHomeContent(settings) {
  try {
        const iframe = document.querySelector('#my-extension-chat-container iframe');
        if (!iframe) return;

    if (settings.apiProvider === 'local') {
      const customSettings = settings.customSettings?.local;
      if (!customSettings?.url || !settings.apiKeys?.local) return;

                const response = await fetch(`${customSettings.url}/widget/menu`, {
                    headers: {
          'Authorization': `Bearer ${settings.apiKeys.local}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

      if (response.ok) {
                const data = await response.json();
                if (data.content) {
                    iframe.contentWindow.postMessage({
                        type: 'LOAD_HOME_CONTENT',
                        content: data.content,
                        isLocal: true
                    }, '*');
                }
      }
    } else {
            iframe.contentWindow.postMessage({
                type: 'LOAD_HOME_CONTENT',
                isLocal: false
            }, '*');
        }
  } catch (error) {
    console.error('Failed to load home content:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

window.initializeContentScript = initializeContentScript;

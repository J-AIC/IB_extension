/**
 * チャットページのエントリーポイント
 * MVCアーキテクチャでChatControllerとChatViewを初期化します
 */

import { container, eventBus } from './src/architecture.js';
import { createChatModel } from './src/models/ChatModel.js';
import { ChatView } from './src/views/ChatView.js';
import { ChatController } from './src/controllers/ChatController.js';
import { createStorageService } from './src/services/StorageService.js';
import { createApiService } from './src/services/ApiService.js';
import { createChatHistoryService } from './src/services/ChatHistoryService.js';
import { autoMigrate } from './src/utils/historyMigration.js';
import { createStore, thunkMiddleware, loggerMiddleware } from './src/stateManagement.js';
import rootReducer from './src/state/index.js';
import { loadSettingsFromStorage } from './src/state/chat.js';
import { sendChatRequest } from './apiClient.js';
import { handleError, handleApiError, ErrorCategory, tryCatch } from './utils/errorHandler.js';
import './src/utils/containerUtils.js';

let pageTitle = '';
let pageUrl = '';
let hasClickedHtmlTabOnce = false;
let currentTabId = null;
let chatController = null;
let tabChatStates = new Map(); // Store chat state for each tab
let pageChatStates = new Map(); // Store chat state for each page (tab + URL)
let isOnline = navigator.onLine; // Track internet connectivity
let offlineOverlay = null; // Reference to offline overlay element
let reloadAttempts = 0; // Track reload attempts to prevent infinite loops
let isReloading = false; // Prevent multiple reload attempts

/**
 * Critical extension errors that require reload
 */
const CRITICAL_ERROR_PATTERNS = [
  /no.*sw/i, // Service worker issues
  /service.*worker/i, // Service worker related
  /sidebar.*setup.*error/i, // Sidebar setup errors
  /extension context invalidated/i, // Context invalidation
  /could not establish connection/i, // Connection issues
  /receiving end does not exist/i, // Message passing errors
  /runtime\.connect/i, // Runtime connection errors
  /runtime\.sendmessage/i, // Message sending errors
  /storage.*not.*available/i, // Storage errors
  /chrome\.runtime\.id.*undefined/i, // Runtime ID undefined
  /chrome\.runtime.*undefined/i, // Chrome runtime undefined
  /manifest.*not.*found/i, // Manifest errors
  /background.*script.*error/i, // Background script errors
  /script.*error.*loading/i, // Script loading errors
  /failed.*to.*fetch.*chrome/i, // Chrome resource loading
  /cannot.*access.*chrome/i, // Chrome access errors
  /extension.*disconnected/i, // Extension disconnection
  /invalidated.*context/i // Context invalidated variations
];

/**
 * Check if an error message indicates a critical extension loading issue
 * @param {string|Error} error - The error to check
 * @returns {boolean} - Whether this is a critical error requiring reload
 */
function isCriticalExtensionError(error) {
  const errorMessage = error?.message || error?.toString() || String(error);
  return CRITICAL_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage));
}

/**
 * Show reload notification with countdown
 * @param {string} reason - Reason for reload
 * @param {number} delay - Delay before auto-reload in seconds
 */
function showReloadNotification(reason, delay = 3) {
  if (isReloading) return;
  isReloading = true;
  
  const notification = document.createElement('div');
  notification.id = 'extensionReloadNotification';
  notification.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    backdrop-filter: blur(5px);
  `;
  
  notification.innerHTML = `
    <div style="
      background: white;
      padding: 2rem;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      max-width: 450px;
      margin: 1rem;
    ">
      <div style="
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #f59e0b, #f97316);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.5rem;
        animation: spin 2s linear infinite;
      ">
        <i class="bi bi-arrow-clockwise" style="font-size: 2rem; color: white;"></i>
      </div>
      <h3 style="
        margin: 0 0 0.5rem 0;
        color: #1e293b;
        font-size: 1.5rem;
        font-weight: 700;
      ">Extension Reload Required</h3>
      <p style="
        margin: 0 0 1rem 0;
        color: #64748b;
        font-size: 1rem;
        line-height: 1.5;
      ">${reason}</p>
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        margin-top: 1.5rem;
      ">
        <div style="
          color: #f59e0b;
          font-size: 0.875rem;
          font-weight: 500;
        ">
          Auto-reloading in <span id="reloadCountdown">${delay}</span> seconds...
        </div>
        <button id="reloadNowBtn" style="
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" 
           onmouseout="this.style.transform='scale(1)'">
          Reload Now
        </button>
      </div>
    </div>
  `;
  
  // Add spin animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // Countdown and auto-reload
  let countdown = delay;
  const countdownElement = document.getElementById('reloadCountdown');
  const reloadButton = document.getElementById('reloadNowBtn');
  
  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdownElement) {
      countdownElement.textContent = countdown;
    }
    
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      performReload();
    }
  }, 1000);
  
  // Manual reload button
  if (reloadButton) {
    reloadButton.addEventListener('click', () => {
      clearInterval(countdownInterval);
      performReload();
    });
  }
}

/**
 * Perform the actual reload operation
 */
function performReload() {
  console.log('Performing extension/browser reload...');
  reloadAttempts++;
  
  try {
    // First try to reload the extension if possible
    if (chrome?.runtime?.reload) {
      chrome.runtime.reload();
      return;
    }
    
    // Fallback to page reload
    window.location.reload();
  } catch (error) {
    console.error('Failed to reload:', error);
    // Last resort - force page reload
    window.location.href = window.location.href;
  }
}

/**
 * Set up global error handlers for critical extension errors
 */
function setupCriticalErrorHandlers() {
  // Global unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    console.error('Unhandled promise rejection:', error);
    
    if (isCriticalExtensionError(error) && reloadAttempts < 3) {
      console.log('Critical extension error detected in promise rejection:', error);
      event.preventDefault(); // Prevent default error handling
      showReloadNotification(`Critical extension error detected: ${error?.message || 'Promise rejection'}`);
    }
  });
  
  // Global error handler
  window.addEventListener('error', (event) => {
    const error = event.error || event.message;
    console.error('Global error:', error);
    
    if (isCriticalExtensionError(error) && reloadAttempts < 3) {
      console.log('Critical extension error detected in global handler:', error);
      event.preventDefault(); // Prevent default error handling
      showReloadNotification(`Critical extension error detected: ${error?.message || 'Script error'}`);
    }
  });
  
  // Console error interception
  const originalConsoleError = console.error;
  console.error = function(...args) {
    originalConsoleError.apply(console, args);
    
    const errorMessage = args.join(' ');
    if (isCriticalExtensionError(errorMessage) && reloadAttempts < 3) {
      console.log('Critical extension error detected in console:', errorMessage);
      showReloadNotification(`Extension initialization error: ${errorMessage}`);
    }
  };
  
  // Chrome runtime error handler
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'CRITICAL_ERROR' && reloadAttempts < 3) {
        console.log('Critical error message received:', message);
        showReloadNotification(`Extension error: ${message.error || 'Unknown error'}`);
      }
    });
  }
}

/**
 * Enhanced extension context validation with auto-reload
 * @returns {boolean} コンテキストが有効かどうか
 */
function isExtensionContextValid() {
  try {
    const isValid = !!(chrome && chrome.runtime && chrome.runtime.id);
    
    if (!isValid && reloadAttempts < 3) {
      console.warn('Extension context is invalid, triggering reload...');
      showReloadNotification('Extension context is not available. The extension may need to be reloaded.');
      return false;
    }
    
    return isValid;
  } catch (error) {
    if (reloadAttempts < 3) {
      console.error('Error checking extension context:', error);
      showReloadNotification(`Extension context error: ${error.message}`);
    }
    return false;
  }
}

/**
 * 拡張機能再読み込みプロンプトを表示
 */
function showExtensionReloadPrompt() {
  const existingPrompt = document.getElementById('extensionReloadPrompt');
  if (existingPrompt) return;
  
  const prompt = document.createElement('div');
  prompt.id = 'extensionReloadPrompt';
  prompt.className = 'alert alert-warning position-fixed';
  prompt.style.cssText = `
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    max-width: 400px;
    text-align: center;
  `;
    prompt.innerHTML = `
    <h6><i class="bi bi-exclamation-triangle"></i> Extension Reload Required</h6>
    <p class="mb-2">The extension has been updated. Please reload to continue.</p>
    <button class="btn btn-primary btn-sm" id="reloadPageButton">
      <i class="bi bi-arrow-clockwise"></i> Reload Page
                </button>
            `;
  
  // Add event listener instead of inline onclick
  const reloadButton = prompt.querySelector('#reloadPageButton');
  if (reloadButton) {
    reloadButton.addEventListener('click', () => {
      window.location.reload();
    });
  }
  document.body.appendChild(prompt);
}

/**
 * Generate a unique key for page-based chat state (tab + URL)
 * @param {number} tabId - The tab ID
 * @param {string} url - The page URL
 * @returns {string} - Unique key for the page
 */
function generatePageKey(tabId, url) {
  // Remove query parameters and fragments for better context grouping
  const cleanUrl = url ? url.split('?')[0].split('#')[0] : 'unknown';
  return `${tabId}-${cleanUrl}`;
}

/**
 * Save chat state for a specific page (tab + URL)
 * @param {number} tabId - The tab ID
 * @param {string} url - The page URL
 * @param {Object} controller - The chat controller
 * @param {Object} view - The chat view
 */
function saveChatStateForPage(tabId, url, controller, view) {
  if (!tabId || !controller) return;
  
  const messages = controller.model.get('messages') || [];
  const webContextEnabled = view ? view.webContextEnabled : false;
  const conversationId = controller.currentConversationId;
  
  const chatState = {
    messages: [...messages], // Deep copy
    webContextEnabled,
    conversationId,
    timestamp: Date.now(),
    url: url,
    tabId: tabId
  };
  
  const pageKey = generatePageKey(tabId, url);
  pageChatStates.set(pageKey, chatState);
  console.log(`Saved chat state for page ${pageKey}:`, { 
    messageCount: messages.length, 
    webContextEnabled,
    conversationId,
    url: url
  });
}

/**
 * Restore chat state for a specific page (tab + URL)
 * @param {number} tabId - The tab ID
 * @param {string} url - The page URL
 * @param {Object} controller - The chat controller
 * @param {Object} view - The chat view
 */
async function restoreChatStateForPage(tabId, url, controller, view) {
  if (!tabId || !controller) return;
  
  const pageKey = generatePageKey(tabId, url);
  const chatState = pageChatStates.get(pageKey);
  
  if (!chatState) {
    console.log(`No saved chat state for page ${pageKey}`);
    return;
  }
  
  console.log(`Restoring chat state for page ${pageKey}:`, {
    messageCount: chatState.messages.length,
    webContextEnabled: chatState.webContextEnabled,
    conversationId: chatState.conversationId,
    url: chatState.url
  });
  
  // Restore messages
  if (chatState.messages && chatState.messages.length > 0) {
    // Clear current messages first
    controller.model.set('messages', []);
    
    // Restore each message
    for (const message of chatState.messages) {
      controller.model.addMessage(message);
    }
  }
  
  // Restore conversation ID
  if (chatState.conversationId) {
    controller.currentConversationId = chatState.conversationId;
  }
  
  // Restore web context setting
  if (view && view.webContextBtnElement) {
    view.webContextEnabled = chatState.webContextEnabled || false;
    
    if (chatState.webContextEnabled) {
      view.webContextBtnElement.classList.add('active');
      view.webContextBtnElement.title = 'Web context enabled - page content will be included';
    } else {
      view.webContextBtnElement.classList.remove('active');
      view.webContextBtnElement.title = 'Add web page context';
    }
  }
  
  // Update model with web context setting
  if (controller.model) {
    controller.model.set('includePageContext', chatState.webContextEnabled);
  }
}

/**
 * Save current chat state for a specific tab
 * @param {number} tabId - The tab ID to save state for
 * @param {Object} controller - The chat controller
 * @param {Object} view - The chat view
 */
function saveChatStateForTab(tabId, controller, view) {
  if (!tabId || !controller) return;
  
  const messages = controller.model.get('messages') || [];
  const webContextEnabled = view ? view.webContextEnabled : false;
  const conversationId = controller.currentConversationId;
  
  const chatState = {
    messages: [...messages], // Deep copy
    webContextEnabled,
    conversationId,
    timestamp: Date.now()
  };
  
  tabChatStates.set(tabId, chatState);
  console.log(`Saved chat state for tab ${tabId}:`, { 
    messageCount: messages.length, 
    webContextEnabled,
    conversationId 
  });
}

/**
 * Restore chat state for a specific tab
 * @param {number} tabId - The tab ID to restore state for
 * @param {Object} controller - The chat controller
 * @param {Object} view - The chat view
 */
async function restoreChatStateForTab(tabId, controller, view) {
  if (!tabId || !controller) return;
  
  const chatState = tabChatStates.get(tabId);
  if (!chatState) {
    console.log(`No saved chat state for tab ${tabId}`);
    return;
  }
  
  console.log(`Restoring chat state for tab ${tabId}:`, {
    messageCount: chatState.messages.length,
    webContextEnabled: chatState.webContextEnabled,
    conversationId: chatState.conversationId
  });
  
  // Restore messages
  if (chatState.messages && chatState.messages.length > 0) {
    // Clear current messages first
    controller.model.set('messages', []);
    
    // Restore each message - the model will trigger UI updates automatically
    for (const message of chatState.messages) {
      controller.model.addMessage(message);
    }
    
    // Restore conversation ID
    if (chatState.conversationId) {
      controller.currentConversationId = chatState.conversationId;
    }
  }
  
  // Restore web context state
  if (view && chatState.webContextEnabled !== undefined) {
    view.webContextEnabled = chatState.webContextEnabled;
    
    // Update the web context button visual state
    if (view.webContextBtnElement) {
      if (chatState.webContextEnabled) {
        view.webContextBtnElement.classList.add('active');
        view.webContextBtnElement.title = 'Web context enabled - page content will be included';
      } else {
        view.webContextBtnElement.classList.remove('active');
        view.webContextBtnElement.title = 'Add web page context';
      }
    }
    
    // Update model with web context setting
    if (controller.model) {
      controller.model.set('includePageContext', chatState.webContextEnabled);
    }
  }
}

/**
 * Clean up chat state for closed tabs
 * @param {number} tabId - The tab ID that was closed
 */
function cleanupTabChatState(tabId) {
  if (tabChatStates.has(tabId)) {
    tabChatStates.delete(tabId);
    console.log(`Cleaned up chat state for closed tab ${tabId}`);
  }
  
  // Also clean up page-specific states for this tab
  const keysToDelete = [];
  for (const [key, value] of pageChatStates.entries()) {
    if (value.tabId === tabId) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => {
    pageChatStates.delete(key);
    console.log(`Cleaned up page chat state for key ${key}`);
  });
}

/**
 * Set up browser tab switching listener
 * @param {Object} controller - The chat controller
 * @param {Object} view - The chat view
 */
function setupTabSwitchingListener(controller, view) {
  if (!chrome?.tabs?.onActivated) {
    console.warn('Chrome tabs API not available');
    return;
  }

  // Get initial tab ID
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      currentTabId = tabs[0].id;
      console.log('Initial tab ID:', currentTabId);
    }
  });

  // Listen for tab switches
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    console.log('Tab switched from', currentTabId, 'to', activeInfo.tabId);
    
    // Only process if actually switching to a different tab
    if (currentTabId !== activeInfo.tabId) {
      const previousTabId = currentTabId;
      
      // Save current chat state before switching
      if (previousTabId) {
        saveChatStateForTab(previousTabId, controller, view);
      }
      
      // Update current tab ID
      currentTabId = activeInfo.tabId;
      
      // Clear current chat display
      controller.clearChat();
      
      // Restore chat state for the new tab
      await restoreChatStateForTab(activeInfo.tabId, controller, view);
      
      try {
        // Get the new tab's info and update page context
        const tab = await chrome.tabs.get(activeInfo.tabId);
        console.log('Switched to tab:', tab.title, tab.url);
        
        // Update page context for the new tab
        pageTitle = tab.title || '';
        pageUrl = tab.url || '';
        
        const model = container.get('chatModel');
        if (model) {
          model.setPageContext({
            title: pageTitle,
            url: pageUrl
          });
        }
      } catch (error) {
        console.error('Error getting tab info:', error);
      }
    }
  });
  
  // Also listen for window focus changes
  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    
    try {
      const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tabs && tabs.length > 0 && tabs[0].id !== currentTabId) {
        console.log('Window focus changed, active tab:', tabs[0].id);
        
        const previousTabId = currentTabId;
        
        // Save current chat state before switching
        if (previousTabId) {
          saveChatStateForTab(previousTabId, controller, view);
        }
        
        // Update current tab ID
        currentTabId = tabs[0].id;
        
        // Clear current chat display
        controller.clearChat();
        
        // Restore chat state for the new tab
        await restoreChatStateForTab(tabs[0].id, controller, view);
        
        // Update page context for the new tab
        pageTitle = tabs[0].title || '';
        pageUrl = tabs[0].url || '';
        
        const model = container.get('chatModel');
        if (model) {
          model.setPageContext({
            title: pageTitle,
            url: pageUrl
          });
        }
      }
    } catch (error) {
      console.error('Error handling window focus change:', error);
    }
  });
  
  // Listen for tab removal to clean up stored states
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    cleanupTabChatState(tabId);
  });
}

/**
 * Create and show the offline overlay
 */
function showOfflineOverlay() {
  if (offlineOverlay) return; // Already shown
  
  offlineOverlay = document.createElement('div');
  offlineOverlay.id = 'offlineOverlay';
  offlineOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
  `;
  
  offlineOverlay.innerHTML = `
    <div style="
      background: white;
      padding: 2rem;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      margin: 1rem;
    ">
      <div style="
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.5rem;
        animation: pulse 2s infinite;
      ">
        <i class="bi bi-wifi-off" style="font-size: 2rem; color: white;"></i>
      </div>
      <h3 style="
        margin: 0 0 0.5rem 0;
        color: #1e293b;
        font-size: 1.5rem;
        font-weight: 700;
      ">No Internet Connection</h3>
      <p style="
        margin: 0 0 1rem 0;
        color: #64748b;
        font-size: 1rem;
        line-height: 1.5;
      ">Chat is disabled while offline. Please check your internet connection and try again.</p>
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        color: #ef4444;
        font-size: 0.875rem;
        font-weight: 500;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          animation: blink 1.5s infinite;
        "></div>
        Attempting to reconnect...
      </div>
    </div>
  `;
  
  // Add animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(offlineOverlay);
  console.log('Offline overlay shown');
}

/**
 * Hide the offline overlay
 */
function hideOfflineOverlay() {
  if (offlineOverlay) {
    offlineOverlay.remove();
    offlineOverlay = null;
    console.log('Offline overlay hidden');
  }
}

/**
 * Disable chat functionality when offline
 * @param {Object} controller - The chat controller
 * @param {Object} view - The chat view
 */
function disableChatForOffline(controller, view) {
  console.log('Disabling chat due to offline status');
  
  // Disable input and send button
  if (view.inputElement) {
    view.inputElement.disabled = true;
    view.inputElement.placeholder = 'Chat is disabled while offline...';
  }
  
  if (view.sendButtonElement) {
    view.sendButtonElement.disabled = true;
    view.sendButtonElement.classList.add('disabled');
  }
  
  // Disable modern interface elements
  const modernInput = document.querySelector('#messageInput');
  const modernSendBtn = document.querySelector('#sendButton');
  const inputWrapper = document.querySelector('.input-wrapper');
  
  if (modernInput) {
    modernInput.disabled = true;
    modernInput.placeholder = 'Chat is disabled while offline...';
  }
  
  if (modernSendBtn) {
    modernSendBtn.disabled = true;
    modernSendBtn.classList.add('disabled');
  }
  
  if (inputWrapper) {
    inputWrapper.classList.add('disabled');
  }
  
  // Show offline overlay
  showOfflineOverlay();
}

/**
 * Enable chat functionality when back online
 * @param {Object} controller - The chat controller
 * @param {Object} view - The chat view
 */
function enableChatForOnline(controller, view) {
  console.log('Enabling chat due to online status');
  
  // Enable input and send button
  if (view.inputElement) {
    view.inputElement.disabled = false;
    view.inputElement.placeholder = 'Type your message...';
  }
  
  if (view.sendButtonElement) {
    view.sendButtonElement.disabled = false;
    view.sendButtonElement.classList.remove('disabled');
  }
  
  // Enable modern interface elements
  const modernInput = document.querySelector('#messageInput');
  const modernSendBtn = document.querySelector('#sendButton');
  const inputWrapper = document.querySelector('.input-wrapper');
  
  if (modernInput) {
    modernInput.disabled = false;
    modernInput.placeholder = 'Type your message...';
  }
  
  if (modernSendBtn) {
    modernSendBtn.disabled = false;
    modernSendBtn.classList.remove('disabled');
  }
  
  if (inputWrapper) {
    inputWrapper.classList.remove('disabled');
  }
  
  // Hide offline overlay
  hideOfflineOverlay();
}

/**
 * Set up internet connectivity listener
 * @param {Object} controller - The chat controller
 * @param {Object} view - The chat view
 */
function setupConnectivityListener(controller, view) {
  console.log('Setting up connectivity listener, current status:', isOnline ? 'online' : 'offline');
  
  // Check initial state
  if (!isOnline) {
    disableChatForOffline(controller, view);
  }
  
  // Listen for online/offline events
  window.addEventListener('online', () => {
    console.log('Connection restored - going online');
    isOnline = true;
    enableChatForOnline(controller, view);
    
    // Show a brief success message
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      z-index: 10001;
      font-weight: 500;
      animation: slideIn 0.3s ease;
    `;
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <i class="bi bi-wifi" style="font-size: 1.2rem;"></i>
        Connection restored!
      </div>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  });
  
  window.addEventListener('offline', () => {
    console.log('Connection lost - going offline');
    isOnline = false;
    disableChatForOffline(controller, view);
  });
  
  // Additional connectivity check using fetch (more reliable)
  const checkConnectivity = async () => {
    try {
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      const online = true; // If fetch doesn't throw, we're online
      
      if (online !== isOnline) {
        isOnline = online;
        if (online) {
          enableChatForOnline(controller, view);
        } else {
          disableChatForOffline(controller, view);
        }
      }
    } catch (error) {
      // Fetch failed, we're likely offline
      if (isOnline) {
        isOnline = false;
        disableChatForOffline(controller, view);
      }
    }
  };
  
  // Check connectivity every 10 seconds
  setInterval(checkConnectivity, 10000);
}

/**
 * Set up periodic saving of current tab's chat state
 * @param {Object} controller - The chat controller
 * @param {Object} view - The chat view
 */
function setupPeriodicStateSaving(controller, view) {
  // Save current tab state every 10 seconds if there are messages
  setInterval(() => {
    if (currentTabId && controller) {
      const messages = controller.model.get('messages') || [];
      if (messages.length > 0) {
        saveChatStateForTab(currentTabId, controller, view);
        // Also save per-page state
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs.length > 0) {
            saveChatStateForPage(currentTabId, tabs[0].url, controller, view);
          }
        });
      }
    }
  }, 10000); // 10 seconds
  
  // Also save on page unload
  window.addEventListener('beforeunload', () => {
    if (currentTabId && controller) {
      saveChatStateForTab(currentTabId, controller, view);
      // Also save per-page state
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          saveChatStateForPage(currentTabId, tabs[0].url, controller, view);
        }
      });
    }
  });
}

/**
 * Set up page navigation listener for per-page chat context
 * @param {Object} controller - The chat controller
 * @param {Object} view - The chat view
 */
function setupPageNavigationListener(controller, view) {
  if (!chrome?.tabs?.onUpdated) {
    console.warn('Chrome tabs API not available');
    return;
  }

  // Debounce timer for navigation events
  let navigationTimer = null;
  let lastUrl = null;

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only process if this is the active tab
    if (tabId !== currentTabId) return;

    if (changeInfo.status === 'loading' && changeInfo.url) {
      console.log('Page navigation detected:', changeInfo.url);
      
      // Clear any pending timer
      if (navigationTimer) {
        clearTimeout(navigationTimer);
        navigationTimer = null;
      }

      // Save current chat state for the previous page
      if (lastUrl && lastUrl !== changeInfo.url) {
        saveChatStateForPage(tabId, lastUrl, controller, view);
        console.log('Saved chat state for previous page:', lastUrl);
      }

      // Clear current chat display
      controller.clearChat();
      
      // Update last URL
      lastUrl = changeInfo.url;
    }
    else if (changeInfo.status === 'complete' && tab.url) {
      console.log('Page navigation complete:', tab.url);
      
      // Clear any existing timer
      if (navigationTimer) {
        clearTimeout(navigationTimer);
      }
      
      // Add a small delay to ensure the page is fully loaded
      navigationTimer = setTimeout(async () => {
        try {
          // Restore chat state for the new page
          await restoreChatStateForPage(tabId, tab.url, controller, view);
          console.log('Restored chat state for new page:', tab.url);
          
        } catch (error) {
          console.error('Error restoring chat state for page:', error);
        }
        navigationTimer = null;
      }, 300); // 300ms delay to ensure page is ready
    }
  });

  // Initialize with current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      lastUrl = tabs[0].url;
      console.log('Initial page URL:', lastUrl);
    }
  });
}


/**
 * チャットアプリケーションを初期化
 */
async function initializeChat() {
  try {
    // Set up critical error handlers first
    setupCriticalErrorHandlers();
    
    if (!isExtensionContextValid()) {
      showExtensionReloadPrompt();
      return;
    }
    
    console.log('Initializing Chat page with new architecture...');
    
    let store, storage, apiService, model, historyService;
    
    try {
      store = createStore({
        rootReducer,
        middleware: [
          thunkMiddleware,
          typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production' ? loggerMiddleware : null
        ].filter(Boolean),
        debug: typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
      });

      // Register services in the container
      container.register('store', () => store, true);
      container.register('storage', createStorageService, true);
      container.register('apiService', createApiService, true);
      container.register('chatModel', createChatModel, true);
      container.register('historyService', createChatHistoryService, true);
      
      // Get services
      storage = container.get('storage');
      apiService = container.get('apiService');
      model = container.get('chatModel');
      historyService = container.get('historyService');
      
    } catch (error) {
      console.error('Failed to initialize core services:', error);
      if (isCriticalExtensionError(error)) {
        showReloadNotification('Failed to initialize extension services. Extension reload required.');
        return;
      }
      throw error;
    }

    // Load initial data from storage
    try {
      await store.dispatch(loadSettingsFromStorage(storage));
    } catch (error) {
      console.error('Failed to load settings from storage:', error);
      if (isCriticalExtensionError(error)) {
        showReloadNotification('Failed to load extension settings. Extension reload required.');
        return;
      }
    }
    
    // Auto-migrate chat history if needed
    try {
      await autoMigrate(storage);
    } catch (error) {
      console.error('History migration failed:', error);
      // Continue initialization even if migration fails
    }

    // Create the view and controller manually to avoid circular dependency
    let view, controller;
    
    try {
      const element = document.querySelector('#chatTab') || document.body;
      view = new ChatView(element, model, {
        inputSelector: '#messageInput',
        sendButtonSelector: '#sendButton',
        messagesContainerSelector: '#chatMessages'
      });
      
      controller = new ChatController(model, view, { 
        storage, 
        historyService,
        apiClient: { sendChatRequest }
      });

      // Set up the controller reference in the view
      view.controller = controller;
      
      // Set up storage reference in view for edit permissions
      view.storage = storage;
      
    } catch (error) {
      console.error('Failed to create view/controller:', error);
      if (isCriticalExtensionError(error)) {
        showReloadNotification('Failed to initialize chat interface. Extension reload required.');
        return;
      }
      throw error;
    }

    // Register the created instances in the container
    container.register('chatView', () => view, true);
    container.register('chatController', () => controller, true);
    
    // Store controller reference globally for tab switching
    chatController = controller;

    // Set up event listeners for cross-component communication
    setupEventListeners(controller, model, view, store);
    
    // Set up browser tab switching listener
    setupTabSwitchingListener(controller, view);
    
    // Set up page navigation listener for per-page chat context
    setupPageNavigationListener(controller, view);
    
    // Set up periodic saving of current tab's chat state
    setupPeriodicStateSaving(controller, view);
    
    // Set up internet connectivity listener
    setupConnectivityListener(controller, view);
    
    // Initialize configuration status display
    setTimeout(() => {
      controller.updateCurrentProviderAndModel();
    }, 100);

    // Set up legacy compatibility and additional features
    await setupLegacyFeatures(controller, model, view);

    // Initialize page context and UI
    await initializePageContext();
    
    // Initialize the tab system and show chat tab by default
    initializeTabs();
    
    
    await updateApiStatus();
    
    // Listen for storage changes to update API status
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && (changes.apiProvider || changes.apiKeys)) {
        updateApiStatus();
      }
    });
    
    console.log('Chat page initialized successfully');

            } catch (error) {
    console.error('Error initializing Chat page:', error);
    
    // Check if it's a critical extension error that requires reload
    if (isCriticalExtensionError(error)) {
      showReloadNotification(`Chat initialization failed: ${error.message || 'Unknown error'}`);
      return;
    }
    
    // Check if it's an extension context invalidation error (legacy)
    if (error.message && error.message.includes('Extension context invalidated')) {
      showExtensionReloadPrompt();
      return;
    }
    
    // For other errors, show a fallback error message
    const fallbackError = document.createElement('div');
    fallbackError.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fee;
      border: 1px solid #fcc;
      color: #c00;
      padding: 1rem;
      border-radius: 8px;
      max-width: 400px;
      text-align: center;
      z-index: 9999;
    `;
    fallbackError.innerHTML = `
      <h4>Chat Initialization Error</h4>
      <p>There was an error starting the chat. Please try refreshing the page.</p>
      <button onclick="window.location.reload()" style="
        background: #dc3545;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 0.5rem;
      ">Refresh Page</button>
    `;
    document.body.appendChild(fallbackError);
  }
}

/**
 * コンポーネント間通信用のイベントリスナー設定
 * @param {Object} controller - コントローラー
 * @param {Object} model - モデル
 * @param {Object} view - ビュー
 * @param {Object} store - ストア
 */
function setupEventListeners(controller, model, view, store) {
  // Listen for state changes
  store.subscribe((prevState) => {
    const state = store.getState();
    
    // Update view when chat state changes
    if (prevState.chat !== state.chat) {
      view.render();
    }
  });

  // Listen for model changes
  model.on('change', (change) => {
    view.onModelChange(change, model);
  });

  // Listen for conversation load events
  window.addEventListener('loadConversation', (event) => {
    const conversation = event.detail;
    
    // Let the controller decide based on conversation ID comparison
    // Only force clearing for explicit 'newChat' source
    const options = {
      clearMessages: conversation.source === 'newChat'
    };
    
    controller.loadConversation(conversation, options);
  });
  
  // Listen for history service events
  eventBus.on('history:updated', () => {
    // Refresh history tab if it's currently active
    const historyTabContent = document.getElementById('historyTab');
    const historyTab = document.getElementById('history-tab');
    if (historyTab && historyTab.classList.contains('active') && historyTabContent) {
      loadConversationHistory().catch(error => {
        console.error('Error refreshing history:', error);
      });
    }
  });
  
  eventBus.on('conversation:saved', (data) => {
    console.log('Conversation saved:', data.id);
    // The history tab will refresh automatically via history:updated event
  });
  
  eventBus.on('conversation:deleted', (data) => {
    console.log('Conversation deleted:', data.id);
    // The history tab will refresh automatically via history:updated event
  });
}

/**
 * レガシー機能と互換性を設定
 * @param {Object} controller - コントローラー
 * @param {Object} model - モデル
 * @param {Object} view - ビュー
 */
async function setupLegacyFeatures(controller, model, view) {
  // Set up message input enhancements
  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    // Auto-resize textarea with smooth animation
    messageInput.addEventListener('input', function() {
      adjustTextareaHeight(this);
    });

    // Handle special key combinations
    messageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && e.shiftKey) {
        // Allow newline with Shift+Enter
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        view.handleSendClick(e);
      }
    });

    // Initial height adjustment
    adjustTextareaHeight(messageInput);
  }

  // Set up new chat button
  const newChatButton = document.getElementById('newChatButton');
  if (newChatButton) {
    newChatButton.addEventListener('click', () => {
      controller.clearChat();
      
      // Switch to chat tab
      const chatTabButton = document.getElementById('chat-tab');
      if (chatTabButton) {
        chatTabButton.click();
      }
    });
  }

  // Set up open in new tab button
  const openNewTabButton = document.getElementById('openNewTabButton');
  if (openNewTabButton) {
    openNewTabButton.addEventListener('click', () => {
      // Open the standalone chat in a new tab
      window.open('chat-standalone.html', '_blank');
    });
  }

  // Set up page context toggle
  const pageContextToggle = document.getElementById('pageContextToggle');
  if (pageContextToggle) {
    // Initialize page context toggle based on API provider
    const storage = container.get('storage');
    const result = await storage.get(['apiProvider']);
    pageContextToggle.checked = (result.apiProvider === 'local');
    
    pageContextToggle.addEventListener('change', async () => {
      if (pageContextToggle.checked) {
        await getParentPageInfo();
      }
      
      // Update model with page context setting
      model.set('includePageContext', pageContextToggle.checked);
    });
  }

  // Set up tab switching
  setupTabHandlers();
}

/**
 * タブ切り替えハンドラー設定
 */
function setupTabHandlers() {
  const historyTab = document.getElementById('history-tab');
  const historyTabContent = document.getElementById('historyTab');
  
  if (historyTab && historyTabContent) {
    historyTab.addEventListener('click', async () => {
      await loadConversationHistory();
    });
  }
}

/**
 * 会話履歴を読み込みしレンダリング
 */
async function loadConversationHistory() {
  const historyService = container.get('historyService');
  const historyTabContent = document.getElementById('historyTab');
  
  if (!historyService || !historyTabContent) return;
  
  try {
    const conversations = await historyService.getHistory();
    renderConversationHistory(conversations, historyTabContent);
            } catch (error) {
    console.error('Error loading conversation history:', error);
  }
}

/**
 * 会話履歴をレンダリング
 * @param {Array} conversations - 会話リスト
 * @param {HTMLElement} container - コンテナ要素
 */
function renderConversationHistory(conversations, container) {
  if (!conversations || conversations.length === 0) {
    container.innerHTML = '<div class="p-3 text-muted">No conversations found</div>';
    return;
  }

  const historyList = document.createElement('div');
  historyList.className = 'conversation-history';

  conversations.forEach((conversation) => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item p-3 border-bottom position-relative';
    const timestamp = new Date(conversation.timestamp).toLocaleString();
    const preview = conversation.messages[0]?.content?.slice(0, 50) + (conversation.messages[0]?.content?.length > 50 ? '...' : '');
    const title = conversation.title || preview || 'Untitled Conversation';

    // Format: PROVIDER - MODEL (clean display without duplicate models/)
    const provider = (conversation.provider || '').toUpperCase();
    let model = conversation.model || 'unknown';
    
    // Remove "models/" prefix if it already exists to avoid duplication
    if (model.startsWith('models/')) {
      model = model.substring(7); // Remove "models/" prefix
    }

    historyItem.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div class="history-title-container flex-grow-1">
          <input type="text" class="history-title-input form-control fw-bold" value="${title}" readonly>
        </div>
        <button class="delete-button btn btn-link p-0 ms-2" aria-label="削除">
          <i class="bi bi-x"></i>
        </button>
      </div>
      <div class="history-provider text-muted small">
        ${provider} - ${model}
      </div>
      <div class="history-timestamp text-muted small">
        ${timestamp}
      </div>
    `;

    const titleInput = historyItem.querySelector('.history-title-input');
    const deleteButton = historyItem.querySelector('.delete-button');

    // Make conversation clickable to load it
    historyItem.addEventListener('click', (e) => {
      if (!e.target.classList.contains('history-title-input') &&
          !e.target.classList.contains('delete-button') &&
          !e.target.classList.contains('bi-x')) {
        window.dispatchEvent(new CustomEvent('loadConversation', {
          detail: { ...conversation, source: 'historyTab' }
        }));

        // Switch to chat tab
        const chatTabButton = document.getElementById('chat-tab');
        if (chatTabButton) {
          chatTabButton.click();
        }
      }
    });

    // Delete button functionality
    if (deleteButton) {
      deleteButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          // Use the history service for deletion
          const historyService = window.container.get('historyService');
          if (historyService) {
            const deleted = await historyService.deleteConversation(conversation.id);
            if (deleted) {
              historyItem.remove();
              
              // Check if no conversations remain
              const remainingItems = container.querySelectorAll('.history-item');
              if (remainingItems.length === 0) {
                container.innerHTML = '<div class="p-3 text-muted">No conversations found</div>';
              }
            }
          }
        } catch (error) {
          console.error('Error deleting conversation:', error);
        }
      });
    }

    if (titleInput) {
      titleInput.addEventListener('focus', () => {
        titleInput.readOnly = false;
        titleInput.classList.add('editing');
      });
      titleInput.addEventListener('blur', async () => {
        titleInput.readOnly = true;
        titleInput.classList.remove('editing');
        try {
          // Use the history service for title updates
          const historyService = window.container.get('historyService');
          if (historyService) {
            await historyService.updateConversationTitle(conversation.id, titleInput.value.trim());
          }
        } catch (error) {
          console.error('Error updating conversation title:', error);
        }
      });
      titleInput.addEventListener('mousedown', (e) => {
        // Prevent parent click event when editing
        e.stopPropagation();
      });
      titleInput.addEventListener('click', (e) => {
        // Focus and enable editing
        titleInput.focus();
        e.stopPropagation();
      });
      titleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          titleInput.blur();
        }
      });
    }

    historyList.appendChild(historyItem);
  });

  container.innerHTML = '';
  container.appendChild(historyList);

  const style = document.createElement('style');
  style.textContent = `
    .conversation-history {
      max-height: calc(100vh - 200px);
      overflow-y: auto;
    }
    .history-item {
      cursor: pointer;
    }
    .history-item:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
    .history-title-input {
      background: #fff;
      border: 1px solid #dee2e6;
      width: 100%;
      padding: 0.375rem;
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .history-title-input.editing, .history-title-input:focus {
      border-color: #86b7fe;
      outline: 0;
      box-shadow: 0 0 0 0.2rem rgba(13,110,253,.25);
      cursor: text;
    }
    .history-title-input[readonly] {
      color: #212529;
      background: #fff;
      cursor: pointer;
    }
    .delete-button {
      color: #6c757d;
      opacity: 0.5;
      transition: opacity 0.2s;
    }
    .delete-button:hover {
      opacity: 1;
      color: #dc3545;
    }
  `;
  document.head.appendChild(style);
}

/**
 * タブシステムを初期化してチャットタブをデフォルト表示
 */
function initializeTabs() {
  console.log('Initializing tabs...');
  
  // Show the chat tab by default
  const chatTabContent = document.getElementById('chatTab');
  const chatTabButton = document.getElementById('chat-tab');
  
  if (chatTabContent) {
    // Remove d-none and add show/active classes
    chatTabContent.classList.remove('d-none');
    chatTabContent.classList.add('show', 'active');
    console.log('Chat tab content activated');
  }
  
  if (chatTabButton) {
    // Make sure the chat tab button is active
    chatTabButton.classList.add('active');
    chatTabButton.setAttribute('aria-selected', 'true');
    console.log('Chat tab button activated');
  }
  
  // Hide other tab contents initially
  const otherTabs = ['historyTab', 'formTab', 'htmlTab'];
  otherTabs.forEach(tabId => {
    const tab = document.getElementById(tabId);
    if (tab) {
      tab.classList.add('d-none');
      tab.classList.remove('show', 'active');
    }
  });
  
  // Set up tab click handlers
  const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active from all tabs
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.add('d-none');
        pane.classList.remove('show', 'active');
      });
      
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        link.setAttribute('aria-selected', 'false');
      });
      
      // Activate clicked tab
      const targetId = button.getAttribute('data-bs-target');
      if (targetId) {
        const targetPane = document.querySelector(targetId);
        if (targetPane) {
            targetPane.classList.remove('d-none');
          targetPane.classList.add('show', 'active');
        }
      }
      
      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');
    });
  });
  
  console.log('Tab system initialized');
}

/**
 * ページコンテキストとHTMLタブ機能を初期化
 */
async function initializePageContext() {
  // Get parent page info for context
  await getParentPageInfo();
  
  // Set up HTML content display
  const pageContextToggle = document.getElementById('pageContextToggle');
  if (pageContextToggle) {
    const storage = container.get('storage');
    const result = await storage.get(['apiProvider']);
    pageContextToggle.checked = (result.apiProvider === 'local');
    
    // Set up HTML tab visibility
    const isMatched = await checkLocalApiUrlMatch(pageUrl);
    toggleHtmlTabVisibility(isMatched);
  }
}

/**
 * 親ページ情報を取得
 * @returns {Promise<Object>} ページ情報
 */
async function getParentPageInfo() {
  // First try to get from active tab if we're in a panel/extension context
  if (chrome?.tabs?.query) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        pageTitle = tabs[0].title || '';
        pageUrl = tabs[0].url || '';
        
        console.log('Got page info from active tab:', { title: pageTitle, url: pageUrl });
        
        // Update chat model with page context
        const model = container.get('chatModel');
        if (model) {
          model.setPageContext({
            title: pageTitle,
            url: pageUrl
          });
        }
        
        return { title: pageTitle, url: pageUrl };
      }
    } catch (error) {
      console.log('Could not get active tab, falling back to postMessage:', error);
    }
  }
  
  // Fallback to postMessage for iframe context
  return new Promise((resolve) => {
    window.parent.postMessage({ type: 'GET_PAGE_INFO' }, '*');
    
    const handlePageInfo = (event) => {
      if (event.data.type === 'PAGE_INFO') {
        pageTitle = event.data.title;
        pageUrl = event.data.url;
        
        // Update chat model with page context
        const model = container.get('chatModel');
        if (model) {
          model.setPageContext({
            title: pageTitle,
            url: pageUrl
          });
        }
        
        // Guide display is now handled in ChatView.js
        
        window.removeEventListener('message', handlePageInfo);
        resolve({ title: pageTitle, url: pageUrl });
      }
    };
    
    window.addEventListener('message', handlePageInfo);
    
    // Timeout after 2 seconds if no response
    setTimeout(() => {
      window.removeEventListener('message', handlePageInfo);
      resolve({ title: pageTitle || '', url: pageUrl || '' });
    }, 2000);
  });
}

/**
 * HTMLタブ用のローカルAPI URLマッチをチェック
 * @param {string} currentUrl - 現在のURL
 * @returns {Promise<boolean>} マッチするかどうか
 */
async function checkLocalApiUrlMatch(currentUrl) {
  try {
    const storage = container.get('storage');
    const { apiKeys, customSettings } = await storage.get(['apiKeys', 'customSettings']);
    
    if (!apiKeys?.local || !customSettings?.local?.url) {
      return false;
    }
    
    const baseUrl = customSettings.local.url.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/widget/html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeys.local}`
      },
      body: JSON.stringify({ url: currentUrl })
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.status === 'success' && Array.isArray(data.htmls) && data.htmls.length > 0;
  } catch (error) {
    console.error('Error checking local API URL match:', error);
    return false;
  }
}

/**
 * HTMLタブの表示/非表示を切り替え
 * @param {boolean} show - 表示するかどうか
 */
function toggleHtmlTabVisibility(show) {
  const htmlTabItem = document.getElementById('htmlTabItem');
  if (!htmlTabItem) return;

  if (show) {
    htmlTabItem.style.display = 'block';
    if (!hasClickedHtmlTabOnce) {
      const htmlTab = document.getElementById('html-tab');
      if (htmlTab) {
        htmlTab.click();
        hasClickedHtmlTabOnce = true;
      }
    }
            } else {
    htmlTabItem.style.display = 'none';
  }
}

// Guide URL checking moved to ChatView.js

// Guide storage and matching functions moved to ChatView.js

// Guide bubble functionality moved to ChatView.js

/**
 * Create individual guide element
 * @param {Object} guide - Guide data
 * @param {number} index - Guide index
 * @returns {HTMLElement} Guide element
 */
function createGuideElement(guide, index) {
  const element = document.createElement('div');
  element.className = 'guide-item';
  element.style.cssText = `
    padding: 12px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: background-color 0.2s;
  `;
  
  const typeLabel = guide.type === 'base' ? '📌 Base' : '🔗 URL';
  const memoText = guide.memo ? `<div class="guide-memo">${guide.memo}</div>` : '';
  
  element.innerHTML = `
    <div class="guide-header">
      <span class="guide-type">${typeLabel}</span>
      <span class="guide-title">${guide.title}</span>
    </div>
    ${memoText}
  `;
  
  // Add hover effect
  element.addEventListener('mouseenter', () => {
    element.style.backgroundColor = '#f8f9fa';
  });
  
  element.addEventListener('mouseleave', () => {
    element.style.backgroundColor = 'white';
  });
  
  // Add click handler
  element.addEventListener('click', () => {
    handleGuideClick(guide, index);
  });
  
  return element;
}

/**
 * Handle guide click
 * @param {Object} guide - Guide data
 * @param {number} index - Guide index
 */
function handleGuideClick(guide, index) {
  console.log('Guide clicked:', guide);
  
  // Send guide content to chat input
  const chatInput = document.getElementById('messageInput');
  if (chatInput) {
    let content = '';
    
    // Use memo if available, otherwise use title
    if (guide.memo && guide.memo.trim()) {
      content = guide.memo;
    } else {
      content = guide.title;
    }
    
    // If there's existing content, add the guide content on a new line
    if (chatInput.value.trim()) {
      chatInput.value += '\n\n' + content;
    } else {
      chatInput.value = content;
    }
    
    chatInput.focus();
    
    // Trigger input event to update UI
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Auto-resize textarea if needed
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
  }
  
  // Hide guides after selection
  hideGuidesUI();
}

/**
 * Set up event listeners for guides UI
 * @param {HTMLElement} container - Guides container
 */
function setupGuidesEventListeners(container) {
  // Hide guides button
  const hideButton = container.querySelector('#hideGuides');
  if (hideButton) {
    hideButton.addEventListener('click', hideGuidesUI);
  }
  
  // Click outside to hide (but not on guides button)
  document.addEventListener('click', (event) => {
    const guidesBtn = document.getElementById('guidesBtn');
    if (!container.contains(event.target) && event.target !== guidesBtn && !guidesBtn?.contains(event.target)) {
      hideGuidesUI();
    }
  });
}

// Guide UI functions moved to ChatView.js


// Guide testing functions removed - functionality moved to ChatView.js

/**
 * APIステータス表示を更新
 */
async function updateApiStatus() {
  try {
    const storage = container.get('storage');
    const result = await storage.get(['apiProvider', 'apiKeys', 'selectedModels']);

    console.log('API Status Check:', {
      apiProvider: result.apiProvider,
      hasApiKeys: !!result.apiKeys,
      apiKeysForProvider: result.apiKeys?.[result.apiProvider] ? 'Present' : 'Missing',
      selectedModel: result.selectedModels?.[result.apiProvider] || 'None'
    });

    const statusElement = document.getElementById('apiStatus');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const chatTab = document.getElementById('chat-tab');

    const isConfigured = result.apiProvider && result.apiKeys?.[result.apiProvider];

    console.log('API Configuration Status:', isConfigured);

    if (statusElement) {
      if (isConfigured) {
        let statusText = result.apiProvider.toUpperCase();
        if (result.apiProvider === 'local') {
          statusText = 'Local API';
        } else if (result.apiProvider === 'compatible') {
          const modelId = result.selectedModels?.compatible;
          if (modelId) {
            statusText += ` (${modelId})`;
          }
        } else if (result.selectedModels && result.selectedModels[result.apiProvider]) {
          statusText += ` (${result.selectedModels[result.apiProvider]})`;
        }
        statusElement.innerHTML = `<span class="header-subtitle">${statusText}</span>`;
      } else {
        statusElement.innerHTML = `<a href="api_settings.html" class="text-decoration-none" data-i18n="apiConfigRequired">Please configure API provider settings</a>`;
      }
    }

    // Enable/disable chat input based on API configuration
    if (messageInput) {
      messageInput.disabled = !isConfigured;
      messageInput.placeholder = isConfigured ?
        chrome.i18n.getMessage('chatMessage') || 'Enter message' :
        'Please configure API settings first';
    }

    if (sendButton) {
      sendButton.disabled = !isConfigured;
    }

    // Show chat tab if API is configured
    if (isConfigured) {
      // Activate the chat tab
      if (chatTab) {
        chatTab.click();
      }

      // Ensure the chat tab content is visible
      const chatTabContent = document.getElementById('chatTab');
      if (chatTabContent) {
        chatTabContent.classList.remove('d-none');
        chatTabContent.classList.add('show', 'active');
      }

      // Remove active class from other tabs
      const allTabContents = document.querySelectorAll('.tab-pane');
      allTabContents.forEach(tab => {
        if (tab.id !== 'chatTab') {
          tab.classList.remove('show', 'active');
          tab.classList.add('d-none');
        }
      });

      // Set the chat tab button as active
      const allTabButtons = document.querySelectorAll('.nav-link');
      allTabButtons.forEach(button => {
        button.classList.remove('active');
        button.setAttribute('aria-selected', 'false');
      });

      if (chatTab) {
        chatTab.classList.add('active');
        chatTab.setAttribute('aria-selected', 'true');
      }
    }

  } catch (error) {
    console.error('Error updating API status:', error);
        }
    }

    /**
 * コンテンツに基づいてテキストエリアの高さを調整
 * @param {HTMLElement} element - テキストエリア要素
 */
function adjustTextareaHeight(element) {
  element.style.height = 'auto';
  const newHeight = Math.min(element.scrollHeight, 120);
  element.style.height = newHeight + 'px';
  
  // Add smooth transition for height changes
  if (!element.style.transition) {
    element.style.transition = 'height 0.1s ease';
  }
}


/**
 * 拡張機能コンテキスト無効化用のグローバルエラーハンドラー
 */
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
    showExtensionReloadPrompt();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('Extension context invalidated')) {
    showExtensionReloadPrompt();
  }
});

/**
 * DOM読み込み完了時の初期化
 */
document.addEventListener('DOMContentLoaded', () => {
  initializeChat().catch(error => {
    console.error('Failed to initialize Chat:', error);

    // Check if it's an extension context invalidation error
    if (error.message && error.message.includes('Extension context invalidated')) {
      showExtensionReloadPrompt();
    }
  });
});

window.initializeChat = initializeChat;
window.container = container;
window.updateApiStatus = updateApiStatus;

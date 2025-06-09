//------------------------
// background.js
// Import secureLogger scripts for background context
self.importScripts('utils/secureLogger.js', 'utils/loggerSetup.js');

// Log extension initialization
secureLogger.log("Background service worker initialized");

chrome.runtime.onInstalled.addListener(() => {
  secureLogger.log("Extension installed/updated");
  chrome.contextMenus.create({
    id: "openHome",
    title: "InsightBuddyを開く",
    contexts: ["action"]
  });
});

// アイコンの右クリックイベントを処理
chrome.action.onClicked.addListener((tab) => {
  secureLogger.log("Extension icon clicked, opening home page");
  chrome.tabs.create({ url: chrome.runtime.getURL("home.html") });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openHome") {
    secureLogger.log("Context menu item clicked, opening home page");
    chrome.tabs.create({ url: chrome.runtime.getURL("home.html") });
  }
});

const loadedTabs = new Set();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'contentScriptLoaded' && sender.tab?.id) {
    console.log(`[Background] Content script loaded in tab ${sender.tab.id}`);
    loadedTabs.add(sender.tab.id);
    sendResponse({ received: true });
  }
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.url && tab.url.startsWith('http') && changeInfo.status === 'complete') {
    console.log(`[Background] URL changed for tab ${tabId}: ${changeInfo.url}`);
    if (loadedTabs.has(tabId)) {
      const maxRetries = 3;
      let retryCount = 0;

      const sendRefreshMessage = () => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'refreshForms' }, response => {
            if (chrome.runtime.lastError) {
              retryCount++;
              if (retryCount < maxRetries) {
                console.warn(`[Background] Retry ${retryCount}/${maxRetries} for refreshForms to tab ${tabId}:`, chrome.runtime.lastError.message);
                setTimeout(sendRefreshMessage, 500);
              } else {
                console.error(`[Background] Failed to send refreshForms to tab ${tabId} after ${maxRetries} retries:`, chrome.runtime.lastError.message);
              }
            } else {
              if (response?.success) {
                console.log(`[Background] refreshForms sent successfully to tab ${tabId}`);
              } else {
                console.warn(`[Background] refreshForms failed for tab ${tabId}`, response?.error);
              }
            }
          });
        }, 1000); // 1-second delay
      };

      sendRefreshMessage();
    } else {
      console.log(`[Background] Content script not loaded in tab ${tabId}, skipping refreshForms`);
    }
  } else if (changeInfo.url && (!tab.url.startsWith('http') || changeInfo.status !== 'complete')) {
    console.log(`[Background] Skipping refreshForms for tab ${tabId}: ${changeInfo.url} (status: ${changeInfo.status || 'unknown'})`);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  loadedTabs.delete(tabId);
});
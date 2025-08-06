/**
 * バックグラウンドサービスワーカー
 * 拡張機能の初期化、API認証管理、コンポーネント間通信を担当します
 */

self.importScripts(
    'utils/secureLogger.js',
    'utils/loggerSetup.js',
    'src/architecture-sw.js',
    'src/models/BackgroundModel-sw.js',
    'src/controllers/BackgroundController-sw.js',
    'src/services/StorageService-sw.js'
);

secureLogger.log("Background service worker starting...");

if (!self.container || !self.eventBus) {
    secureLogger.error("Architecture not properly loaded");
    throw new Error("Architecture dependencies not available");
}

secureLogger.log("Architecture loaded successfully");

const { container, eventBus } = self;
const { createStorageService, createBackgroundModel, createBackgroundController } = self;

secureLogger.log("Step 1: Registering services...");

try {
    container.register('storage', createStorageService, true);
    secureLogger.log("StorageService registered successfully");
    
    container.register('backgroundModel', createBackgroundModel, true);
    secureLogger.log("BackgroundModel registered successfully");
    
    container.register('backgroundController', createBackgroundController, true);
    secureLogger.log("BackgroundController registered successfully");
} catch (error) {
    secureLogger.error("Error registering services:", error);
    throw error;
}

secureLogger.log("Step 2: Initializing background controller...");

try {
    const backgroundController = container.get('backgroundController');
    secureLogger.log("Background controller initialized successfully");
    
    secureLogger.log("Background service worker initialized with full MVC architecture");
    
    // Initialize side panel behavior
    initializeSidePanel();
    
    const storage = container.get('storage');
    const model = container.get('backgroundModel');
    
    secureLogger.log("All services accessible:", {
        hasStorage: !!storage,
        hasModel: !!model,
        hasController: !!backgroundController
    });
    
  } catch (error) {
    secureLogger.error("Error initializing background controller:", error);
    throw error;
  }

secureLogger.log("Background service worker ready!");

/**
 * Initialize Chrome Side Panel behavior
 */
function initializeSidePanel() {
    try {
        // Set the default panel behavior - open on action click
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        secureLogger.log("Side panel behavior configured");
        
        // Handle side panel navigation messages
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'navigate-panel') {
                handlePanelNavigation(message.panel, sender.tab?.id)
                    .then(() => sendResponse({ success: true }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Indicates async response
            }
        });
        
        secureLogger.log("Side panel navigation handlers registered");
        
    } catch (error) {
        secureLogger.error("Error initializing side panel:", error);
    }
}

/**
 * Handle navigation between side panels
 * @param {string} panelName - Name of the panel to navigate to
 * @param {number} tabId - Tab ID (optional)
 */
async function handlePanelNavigation(panelName, tabId) {
    const panels = {
        chat: 'panel-chat.html',
        history: 'panel-history.html',
        forms: 'panel-forms.html',
        home: 'panel-home.html'
    };
    
    const panelPath = panels[panelName];
    if (!panelPath) {
        throw new Error(`Invalid panel name: ${panelName}`);
    }
    
    try {
        const options = {
            path: panelPath,
            enabled: true
        };
        
        if (tabId) {
            options.tabId = tabId;
        }
        
        await chrome.sidePanel.setOptions(options);
        secureLogger.log(`Navigated to ${panelName} panel`);
        
    } catch (error) {
        secureLogger.error(`Failed to navigate to ${panelName}:`, error);
        throw error;
    }
}

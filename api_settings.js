/**
 * API設定ページのエントリーポイント
 * MVCアーキテクチャでApiSettingsControllerとApiSettingsViewを初期化します
 */
import { container, eventBus } from './src/architecture.js';
import { createApiSettingsModel } from './src/models/ApiSettingsModel.js';
import { ApiSettingsView } from './src/views/ApiSettingsView.js';
import { ApiSettingsController } from './src/controllers/ApiSettingsController.js';
import { createStorageService } from './src/services/StorageService.js';
import { createStore, thunkMiddleware, loggerMiddleware } from './src/stateManagement.js';
import rootReducer from './src/state/index.js';
import { loadSettingsFromStorage } from './src/state/apiSettings.js';

/**
 * API設定アプリケーションを初期化
 */
async function initializeApiSettings() {
  try {
    console.log('Initializing API Settings page with new architecture...');

    // Create and register the store
    const store = createStore({
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
    container.register('apiSettingsModel', createApiSettingsModel, true);

    // Load initial data from storage
    await store.dispatch(loadSettingsFromStorage());

    // Get the model and storage
    const model = container.get('apiSettingsModel');
    const storage = container.get('storage');

    // Load data into the model from storage
    await model.loadFromStorage(storage);

    // Create the view and controller manually to avoid circular dependency
    const element = document.querySelector('#api-settings-container') || document.body;
    const view = new ApiSettingsView(element, model);
    const controller = new ApiSettingsController(model, view, { storage });

    // Set up the controller reference in the view
    view.controller = controller;

    // Register the created instances in the container
    container.register('apiSettingsView', () => view, true);
    container.register('apiSettingsController', () => controller, true);

    // Set up event listeners for cross-component communication
    setupEventListeners(controller, model, view, store);

    // Set up message handlers for iframe communication
    setupMessageHandlers(controller, model);

    console.log('API Settings page initialized successfully');

  } catch (error) {
    console.error('Error initializing API Settings page:', error);
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
    
    // Update view when API settings change
    if (prevState.apiSettings !== state.apiSettings) {
      view.render();
    }
    
    // Emit events for significant changes
    if (prevState.apiSettings.activeApi !== state.apiSettings.activeApi) {
      eventBus.emit('apiSettings:activeApiChanged', {
        previousApi: prevState.apiSettings.activeApi,
        currentApi: state.apiSettings.activeApi
      });
    }
  });

  // Listen for model changes
  model.on('change', (change) => {
    view.onModelChange(change, model);
  });

  // Listen for validation events
  eventBus.on('apiSettings:validate', async (data) => {
    const isValid = model.validateApiConfig(data.provider);
    eventBus.emit('apiSettings:validated', { provider: data.provider, isValid });
  });
}

/**
 * iframe/クロスフレーム通信用のメッセージハンドラー設定
 * @param {Object} controller - コントローラー
 * @param {Object} model - モデル
 */
function setupMessageHandlers(controller, model) {
  window.addEventListener('message', async (event) => {
    try {
      if (event.data.type === 'GET_API_CONFIG') {
        const activeApi = model.getActiveApi();
        
        if (!activeApi) {
          event.source.postMessage({ 
            type: 'API_CONFIG', 
            config: null,
            error: 'No active API provider configured'
          }, '*');
          return;
        }

        const config = controller.getApiConfig(activeApi);
        
        event.source.postMessage({ 
          type: 'API_CONFIG', 
          config: config 
        }, '*');
      }
    } catch (error) {
      console.error('Error handling message:', error);
      event.source.postMessage({ 
        type: 'API_CONFIG', 
        config: null,
        error: error.message 
      }, '*');
    }
  });
}

/**
 * DOM読み込み完了時の初期化
 */
document.addEventListener('DOMContentLoaded', () => {
  initializeApiSettings().catch(error => {
    console.error('Failed to initialize API Settings:', error);
  });
});

window.initializeApiSettings = initializeApiSettings;
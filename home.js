/**
 * ホームページのエントリーポイント
 * MVCアーキテクチャでHomeControllerとHomeViewを初期化します
 */

import { container, eventBus } from './src/architecture.js';
import { createHomeModel } from './src/models/HomeModel.js';
import { createHomeView } from './src/views/HomeView.js';
import { createHomeController } from './src/controllers/HomeController.js';
import { createStorageService } from './src/services/StorageService.js';
import { createStore, thunkMiddleware, loggerMiddleware } from './src/stateManagement.js';
import rootReducer from './src/state/index.js';
import { loadSettingsFromStorage } from './src/state/apiSettings.js';

/**
 * ホームアプリケーションを初期化
 */
async function initializeHome() {
  try {
    console.log('Initializing Home page with new architecture...');

    const store = createStore({
      rootReducer,
      middleware: [
        thunkMiddleware,
        typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production' ? loggerMiddleware : null
      ].filter(Boolean),
      debug: typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
    });

    container.register('store', () => store, true);
    container.register('storage', createStorageService, true);
    container.register('homeModel', createHomeModel, true);

    await store.dispatch(loadSettingsFromStorage());

    const model = container.get('homeModel');
    const storage = container.get('storage');

    const view = createHomeView(container);
    
    container.register('homeView', () => view, true);

    const controller = createHomeController(container);

    view.controller = controller;

    container.register('homeController', () => controller, true);

    setupEventListeners(controller, model, view, store);

    await controller.loadContent();

    console.log('Home page initialized successfully');

  } catch (error) {
    console.error('Error initializing Home page:', error);
    
    const homeContent = document.getElementById('homeContent');
    if (homeContent) {
      homeContent.innerHTML = `
        <div class="container">
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            Error loading home content: ${error.message}
          </div>
        </div>
      `;
    }
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
  store.subscribe((prevState) => {
    const state = store.getState();
    
    if (prevState.home !== state.home) {
      view.render();
    }
  });

  model.on('change', (change) => {
    view.onModelChange(change, model);
  });

  eventBus.on('apiSettings:activeApiChanged', (data) => {
    controller.loadContent();
  });
}

/**
 * DOM読み込み完了時の初期化
 */
document.addEventListener('DOMContentLoaded', () => {
  initializeHome().catch(error => {
    console.error('Failed to initialize Home:', error);
});
});

window.initializeHome = initializeHome;

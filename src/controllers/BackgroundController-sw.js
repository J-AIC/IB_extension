/**
 * BackgroundController-sw.js - Service Worker対応版BackgroundController
 */

(function(global) {
  'use strict';

  const Controller = global.Controller;
  
  if (!Controller) {
    throw new Error('Controller クラスが利用できません。architecture-sw.js を先に読み込んでください。');
  }

  /**
   * BackgroundController クラス
   * バックグラウンドサービスワーカー用のコントローラー
   */
  class BackgroundController extends Controller {
    /**
     * コンストラクタ
     * 
     * @param {Object} model - バックグラウンドモデル
     * @param {Object} view - バックグラウンドビュー（未使用）
     * @param {Object} [services={}] - コントローラーが使用するサービス
     */
    constructor(model, view, services = {}) {
      super(model, view);

      this.services = {
        storage: null,
        ...services
      };

      this.initializeEventListeners();
    }

    /**
     * イベントリスナーの初期化
     */
    initializeEventListeners() {
      chrome.runtime.onInstalled.addListener((details) => {
        this.handleAction('onInstalled', details);
      });

      // Side Panel API サポートの確認と設定
      this.setupSidePanelSupport();

      chrome.contextMenus.onClicked.addListener((info, tab) => {
        this.handleAction('onContextMenuClicked', { info, tab });
      });

      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action) {
          this.handleAction(request.action, { request, sender, sendResponse });
          return true;
        } else if (request.type === 'OPEN_P2P_RECEIVER') {
          this.handleOpenP2PReceiver();
          sendResponse({ success: true });
          return true;
        } else if (request.action === 'openSidePanel') {
          this.handleOpenSidePanel(request.tabId);
          sendResponse({ success: true });
          return true;
        }
      });
    }

    /**
     * Side Panel APIサポートの設定
     */
    async setupSidePanelSupport() {
      secureLogger.log('Setting up side panel support...');
      try {
        if (!chrome.sidePanel) {
          secureLogger.error('chrome.sidePanel API is not available');
          return;
        }
        
        // Side Panel APIのみを使用（フォールバックなし）
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        secureLogger.log('Side panel behavior set successfully - clicking extension icon should now open side panel');
      } catch (error) {
        secureLogger.error('Side panel setup error:', error);
      }
    }

    /**
     * ユーザーアクションの処理
     * 
     * @param {string} action - 処理するアクション
     * @param {Object} data - アクションのデータ
     */
    async handleAction(action, data) {
      switch (action) {
        case 'onInstalled':
          await this.handleInstalled(data);
          break;

        case 'onContextMenuClicked':
          this.handleContextMenuClicked(data.info, data.tab);
          break;

        default:
          secureLogger.warn(`Unknown action: ${action}`);
      }
    }

    /**
     * 拡張機能のインストールまたは更新の処理
     * 
     * @param {Object} details - インストール詳細
     */
    async handleInstalled(details) {
      secureLogger.log("Extension installed/updated", details);
      this.model.setInstalled(true);
      this.createContextMenus();
    }

    /**
     * コンテキストメニューの作成
     */
    createContextMenus() {
      chrome.contextMenus.removeAll();
      this.model.clearContextMenus();
      const menuItem = {
        id: "openHome",
        title: "InsightBuddyを開く",
        contexts: ["action"]
      };

      chrome.contextMenus.create(menuItem);
      this.model.addContextMenu(menuItem);
    }


    /**
     * コンテキストメニュークリックの処理
     * 
     * @param {Object} info - コンテキストメニュークリック情報
     * @param {Object} tab - アクティブなタブ
     */
    handleContextMenuClicked(info, tab) {
      if (info.menuItemId === "openHome") {
        secureLogger.log("Context menu item clicked, opening home page");
        chrome.tabs.create({ url: chrome.runtime.getURL("home.html") });
      }
    }

    /**
     * P2P Receiverを開く処理
     */
    handleOpenP2PReceiver() {
      secureLogger.log("Opening P2P Receiver");
      chrome.tabs.create({ 
        url: chrome.runtime.getURL("p2p_receiver.html"),
        active: true
      });
    }

    /**
     * Side Panelを開く処理
     * 
     * @param {number} tabId - 対象のタブID
     */
    async handleOpenSidePanel(tabId) {
      if (typeof chrome.sidePanel !== 'undefined') {
        try {
          secureLogger.log("Opening side panel for tab:", tabId);
          if (tabId) {
            await chrome.sidePanel.open({ tabId: tabId });
          } else {
            // 現在のアクティブなタブを取得
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
              await chrome.sidePanel.open({ tabId: tabs[0].id });
            }
          }
        } catch (error) {
          secureLogger.error("Error opening side panel:", error);
          // フォールバック: チャットページを新しいタブで開く
          chrome.tabs.create({ url: chrome.runtime.getURL("panel-chat.html") });
        }
      } else {
        // Side Panel APIが利用できない場合はチャットページを新しいタブで開く
        chrome.tabs.create({ url: chrome.runtime.getURL("panel-chat.html") });
      }
    }
  }

  /**
   * BackgroundController インスタンス作成用ファクトリ関数
   * 
   * @param {Object} container - 依存性注入コンテナ
   * @returns {BackgroundController} BackgroundController インスタンス
   */
  const createBackgroundController = (container) => {
    const backgroundModel = container.get('backgroundModel');
    const storage = container.get('storage');

    return new BackgroundController(backgroundModel, null, { storage });
  };

  global.BackgroundController = BackgroundController;
  global.createBackgroundController = createBackgroundController;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this); 
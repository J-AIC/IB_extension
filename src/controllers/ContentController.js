/**
 * ContentController.js - コンテントスクリプトのコントローラー
 */

import { Controller } from '../architecture.js';

/**
 * ContentController クラス
 * コンテントスクリプトのコントローラー
 */
export class ContentController extends Controller {
  /**
   * コンストラクタ
   * 
   * @param {Object} model - コンテントモデル
   * @param {Object} view - コンテントビュー（未使用）
   * @param {Object} [services={}] - コントローラーが使用するサービス
   */
  constructor(model, view, services = {}) {
    super(model, view);
    
    this.services = {
      storage: null,
      ...services
    };
    
    this.initializeMessageListeners();
  }
  
  /**
   * メッセージリスナーの初期化
   */
  initializeMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "getPageContent") {
        sendResponse({ content: document.body.innerHTML });
        return true;
      }
      
      if (request.action === "toggleChatPanel") {
        this.toggleChat();
        sendResponse({ success: true });
        return true;
      }
      
      const formActions = ['getForms', 'highlightForms', 'removeHighlight', 'applyValues', 'findFormsByLabel', 'findFormsByType', 'findRequiredForms', 'getFormValues'];
      if (formActions.includes(request.action)) {
        return false;
      }
      
      return false;
    });
    
    window.addEventListener('message', (event) => {
      const iframe = document.querySelector('#my-extension-chat-container iframe');
      if (!iframe) return;
      
      switch (event.data.type) {
        case 'GET_PAGE_INFO': {
          iframe.contentWindow.postMessage({
            type: 'PAGE_INFO',
            title: document.title,
            url: window.location.href
          }, '*');
          break;
        }
        case 'GET_FORM_CONTENT': {
          const xpath = event.data.xpath;
          const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          const element = result.singleNodeValue;
          const content = element ? element.outerHTML : '';
          
          iframe.contentWindow.postMessage({
            type: 'FORM_CONTENT',
            content: content,
            baseUrl: window.location.origin
          }, '*');
          break;
        }
      }
    });
  }
  
  /**
   * ユーザーアクションの処理
   * 
   * @param {string} action - 処理するアクション
   * @param {Object} data - アクションのデータ
   */
  async handleAction(action, data) {
    switch (action) {
      case 'initialize':
        await this.initialize();
        break;
        
      case 'toggleChat':
        this.toggleChat();
        break;
        
      case 'loadHomeContent':
        await this.loadHomeContent();
        break;
        
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }
  
  /**
   * コンテントスクリプトの初期化
   */
  async initialize() {
    if (document.getElementById("my-extension-chat-container")) return;
    
    if (!this.model.isAuthenticated()) return;
    
    const isAllowed = await this.model.checkUrlPermission(window.location.href);
    if (!isAllowed) return;
    
    this.createContainer();
    this.initializeToggleButton();
    
    // Always show the chat panel since there's no toggle button
    this.model.setOpen(true);
    const container = document.getElementById("my-extension-chat-container");
    
    if (container) {
      container.style.width = "360px";
      document.body.style.marginRight = "360px";
    }
    
    await this.loadHomeContent();
  }
  
  /**
   * チャットコンテナの作成
   */
  createContainer() {
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
    
    this.model.setContainer(container);
  }
  
  /**
   * トグルボタンの初期化
   */
  initializeToggleButton() {
    // Toggle button removed - no longer needed
  }
  
  /**
   * チャットコンテナのトグル
   */
  toggleChat() {
    this.model.toggleOpen();
    const isOpen = this.model.get('isOpen');
    const container = document.getElementById("my-extension-chat-container");
    
    if (isOpen) {
      container.style.width = "360px";
      document.body.style.marginRight = "360px";
    } else {
      container.style.width = "0";
      document.body.style.marginRight = "0";
    }
  }
  
  /**
   * チャットコンテナ用ホームコンテンツの読み込み
   */
  async loadHomeContent() {
    const iframe = document.querySelector('#my-extension-chat-container iframe');
    if (!iframe) return;
    
    try {
      const content = await this.model.loadHomeContent();
      
      iframe.contentWindow.postMessage({
        type: 'LOAD_HOME_CONTENT',
        content: content.content,
        isLocal: content.isLocal
      }, '*');
    } catch (error) {
      console.error('Failed to load home content:', error);
      
      iframe.contentWindow.postMessage({
        type: 'LOAD_ERROR',
        error: 'Failed to load content'
      }, '*');
    }
  }
}

/**
 * ContentController インスタンス作成用ファクトリ関数
 * 
 * @param {Object} container - 依存性注入コンテナ
 * @returns {ContentController} ContentController インスタンス
 */
export const createContentController = (container) => {
  const contentModel = container.get('contentModel');
  const storage = container.get('storage');
  
  return new ContentController(contentModel, null, { storage });
};
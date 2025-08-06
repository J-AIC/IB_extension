/**
 * HomeController.js - ホームページのコントローラー
 */

import { Controller } from '../architecture.js';

/**
 * HomeController クラス
 * ホームページのコントローラー
 */
export class HomeController extends Controller {
  /**
   * コンストラクタ
   * 
   * @param {Object} model - ホームモデル
   * @param {Object} view - ホームビュー
   * @param {Object} [services={}] - コントローラーが使用するサービス
   */
  constructor(model, view, services = {}) {
    super(model, view);
    
    this.services = {
      storage: null,
      ...services
    };
  }
  
  /**
   * ユーザーアクションの処理
   * 
   * @param {string} action - 処理するアクション
   * @param {Object} data - アクションのデータ
   */
  async handleAction(action, data) {
    switch (action) {
      case 'loadContent':
        await this.loadContent();
        break;
        
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }
  
  /**
   * ホームページ用コンテンツの読み込み
   */
  async loadContent() {
    try {
      this.model.setLoading(true);
      
      const currentUrl = await this.getParentURL();
      
      if (this.model.isLocalApiConfigured()) {
        const isAllowed = await this.model.checkDisplayAccess(currentUrl);
        
        if (isAllowed) {
          try {
            const content = await this.model.fetchLocalApiContent();
            
            if (content) {
              this.model.setContent(content);
              return;
            }
          } catch (error) {
            console.error('Error fetching Local API content:', error);
          }
        }
      }
      
      const language = chrome.i18n.getUILanguage();
      const defaultContent = await this.model.loadDefaultContent(language);
      this.model.setContent(defaultContent);
    } catch (error) {
      console.error('Error loading content:', error);
      this.model.setError(error.message || 'Failed to load content');
    }
  }
  
  /**
   * 親ウィンドウのURLを取得
   * 
   * @returns {Promise<string>} 親ウィンドウのURL
   */
  async getParentURL() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(tabs[0]?.url || window.location.href);
        });
      });
    }
    return window.location.href;
  }
}

/**
 * HomeController インスタンス作成用ファクトリ関数
 * 
 * @param {Object} container - 依存性注入コンテナ
 * @returns {HomeController} HomeController インスタンス
 */
export const createHomeController = (container) => {
  const homeModel = container.get('homeModel');
  const homeView = container.get('homeView');
  const storage = container.get('storage');
  
  return new HomeController(homeModel, homeView, { storage });
};
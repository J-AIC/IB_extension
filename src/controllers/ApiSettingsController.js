/**
 * API設定を管理するコントローラクラス
 * ベースControllerクラスを拡張し、API設定のユーザーアクションとビジネスロジックを処理
 */

import { Controller } from '../architecture.js';
import { apiEndpoints } from '../models/ApiSettingsModel.js';

/**
 * API設定のユーザーアクションとビジネスロジックを処理するコントローラクラス
 */
export class ApiSettingsController extends Controller {
  /**
   * コンストラクタ
   * 
   * @param {Object} model - API設定モデル
   * @param {Object} view - API設定ビュー
   * @param {Object} [services={}] - コントローラで使用するサービス
   */
  constructor(model, view, services = {}) {
    super(model, view);
    
    this.services = {
      storage: null,
      ...services
    };
  }
  
  /**
   * ユーザーアクションを処理
   * 
   * @param {string} action - 処理するアクション
   * @param {Object} data - アクションのデータ
   */
  async handleAction(action, data) {
    switch (action) {
      case 'setActiveApi':
        await this.setActiveApi(data.provider);
        break;
        
      case 'setApiKey':
        await this.setApiKey(data.provider, data.key);
        break;
        
      case 'deleteApiKey':
        await this.deleteApiKey(data.provider);
        break;
        
      case 'setSelectedModel':
        await this.setSelectedModel(data.provider, data.model);
        break;
        
      case 'setCustomSettings':
        await this.setCustomSettings(data.provider, data.settings);
        break;
        
      case 'fetchModels':
        await this.fetchModels(data.provider, data.element);
        break;
        
        
      case 'saveSettings':
        await this.saveSettings();
        break;
        
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }
  
  /**
   * アクティブなAPIプロバイダーを設定
   * 
   * @param {string} provider - APIプロバイダーID
   */
  async setActiveApi(provider) {
    this.model.setActiveApi(provider);
    await this.saveSettings();
  }
  
  /**
   * APIキーを設定
   * 
   * @param {string} provider - APIプロバイダーID
   * @param {string} key - APIキー
   */
  async setApiKey(provider, key) {
    this.model.setApiKey(provider, key);
  }
  
  /**
   * APIキーを削除
   * 
   * @param {string} provider - APIプロバイダーID
   */
  async deleteApiKey(provider) {
    try {
      if (!provider) {
        throw new Error('Provider is required');
      }
      
      const hasKey = this.model.getApiKey(provider);
      if (!hasKey) {
        throw new Error('No API key found for this provider');
      }
      
      this.model.deleteApiKey(provider);
      
      // If this was the active API, deactivate it
      if (this.model.getActiveApi() === provider) {
        this.model.setActiveApi(null);
      }
      
      await this.saveSettings();
      
      console.log(`Successfully deleted API key for provider: ${provider}`);
      
    } catch (error) {
      console.error(`Failed to delete API key for provider ${provider}:`, error);
      throw error; // Re-throw so the view can handle it
    }
  }
  
  /**
   * 選択されたモデルを設定
   * 
   * @param {string} provider - APIプロバイダーID
   * @param {string} model - モデルID
   */
  async setSelectedModel(provider, model) {
    this.model.setSelectedModel(provider, model);
    await this.saveSettings();
  }
  
  /**
   * プロバイダーのカスタム設定を更新
   * 
   * @param {string} provider - APIプロバイダーID
   * @param {Object} settings - カスタム設定
   */
  async setCustomSettings(provider, settings) {
    this.model.setCustomSettings(provider, settings);
  }
  
  
  /**
   * プロバイダーのモデル一覧を取得
   * 
   * @param {string} provider - APIプロバイダーID
   * @param {HTMLElement} element - カード要素
   * @throws {Error} APIキーが設定されていない場合
   */
  async fetchModels(provider, element) {
    const endpoint = apiEndpoints[provider];
    if (!endpoint) return;
    
    this.view.showModelsLoading(provider, element);
    
    try {
      const apiKey = this.model.getApiKey(provider);
      if (!apiKey) {
        throw new Error('API key not set');
      }
      
      const customSettings = this.model.getCustomSettings(provider);
      
      let modelsUrl = endpoint.modelsUrl;
      if (typeof modelsUrl === 'function') {
        modelsUrl = modelsUrl(customSettings);
      } else if (provider === 'compatible') {
        const baseUrl = customSettings.url.trim();
        modelsUrl = baseUrl.endsWith('/')
          ? `${baseUrl}v1/models`
          : `${baseUrl}/v1/models`;
      }
      
      let headers;
      if (typeof endpoint.headers === 'function') {
        if (endpoint.headers.length > 1) {
          headers = await endpoint.headers(apiKey, customSettings);
        } else {
          headers = endpoint.headers(apiKey);
        }
      } else {
        headers = endpoint.headers;
      }
      
      const response = await fetch(modelsUrl, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const models = endpoint.processResponse(data);
      
      this.model.setModelsList(provider, models);
      
      this.view.updateModelsList(provider, models, element);
    } catch (error) {
      console.error('Error fetching models:', error);
      this.view.showModelsError(provider, error, element);
    }
  }
  
  /**
   * 設定をストレージに保存
   */
  async saveSettings() {
    if (!this.services.storage) {
      console.warn('Storage service not available');
      return;
    }
    
    await this.model.saveToStorage(this.services.storage);
  }
  
  /**
   * プロバイダーのAPI設定を取得
   * 
   * @param {string} provider - APIプロバイダーID
   * @returns {Object} API設定
   */
  getApiConfig(provider) {
    return this.model.getApiConfig(provider);
  }
}

/**
 * ApiSettingsControllerインスタンスを作成するファクトリ関数
 * 
 * @param {Object} container - 依存性注入コンテナ
 * @returns {ApiSettingsController} ApiSettingsControllerインスタンス
 */
export const createApiSettingsController = (container) => {
  const apiSettingsModel = container.get('apiSettingsModel');
  const apiSettingsView = container.get('apiSettingsView');
  const storage = container.get('storage');
  
  return new ApiSettingsController(apiSettingsModel, apiSettingsView, { storage });
};
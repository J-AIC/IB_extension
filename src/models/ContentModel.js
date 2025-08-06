import { Model } from '../architecture.js';

/**
 * コンテンツスクリプト用データモデルクラス
 * 
 * コンテンツスクリプトのデータモデルを表します。
 * チャットコンテナーの状態、URLアクセス許可、コンテンツ読み込みを管理します。
 */
export class ContentModel extends Model {
  /**
   * コンストラクタ
   * 
   * @param {Object} data - モデルの初期データ
   */
  constructor(data = {}) {
    const defaultData = {
      isOpen: false,
      container: null,
      settings: {
        apiProvider: null,
        apiKeys: {},
        customSettings: {}
      },
      ...data
    };
    
    super(defaultData);
  }
  
  /**
   * チャットコンテナーの開閉状態を設定
   * 
   * @param {boolean} isOpen - チャットコンテナーが開いているかどうか
   * @returns {ContentModel} - チェーンメソッド用のモデルインスタンス
   */
  setOpen(isOpen) {
    this.set('isOpen', isOpen);
    return this;
  }
  
  /**
   * チャットコンテナーの開閉状態を切り替え
   * 
   * @returns {ContentModel} - チェーンメソッド用のモデルインスタンス
   */
  toggleOpen() {
    this.set('isOpen', !this.get('isOpen'));
    return this;
  }
  
  /**
   * コンテナー要素を設定
   * 
   * @param {HTMLElement} container - コンテナー要素
   * @returns {ContentModel} - チェーンメソッド用のモデルインスタンス
   */
  setContainer(container) {
    this.set('container', container);
    return this;
  }
  
  /**
   * ストレージから設定を読み込み
   * 
   * @param {Object} storage - ストレージサービス
   * @returns {Promise<ContentModel>} - チェーンメソッド用のモデルインスタンス
   */
  async loadSettings(storage) {
    try {
      const settings = await storage.get([
        'apiProvider',
        'apiKeys',
        'customSettings'
      ]);
      
      this.set('settings', {
        ...this.get('settings'),
        apiProvider: settings.apiProvider,
        apiKeys: settings.apiKeys || {},
        customSettings: settings.customSettings || {}
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
    
    return this;
  }
  
  /**
   * ユーザーが認証されているかチェック
   * 
   * @returns {boolean} - ユーザーが認証されているかどうか
   */
  isAuthenticated() {
    const settings = this.get('settings');
    if (!settings.apiProvider) return false;
    
    if (settings.apiProvider === 'local') {
      return !!settings.apiKeys?.local && !!settings.customSettings?.local?.url;
    }
    
    return !!settings.apiKeys?.[settings.apiProvider];
  }
  
  /**
   * 現在のURLがチャットコンテナーを表示できるかチェック
   * 
   * @param {string} currentUrl - 現在のURL
   * @returns {Promise<boolean>} - URLが許可されているかどうか
   */
  async checkUrlPermission(currentUrl) {
    const settings = this.get('settings');
    
    if (settings.apiProvider === 'local') {
      try {
        const customSettings = settings.customSettings?.local || {};
        const response = await fetch(`${customSettings.url}/check-display-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKeys.local}`
          },
          body: JSON.stringify({ current_url: currentUrl })
        });
        
        if (!response.ok) return false;
        
        const data = await response.json();
        return data.allowed;
      } catch (error) {
        console.error('URL check failed for Local API:', error);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * チャットコンテナー用のホームコンテンツを読み込み
   * 
   * @returns {Promise<Object>} - コンテンツデータ
   */
  async loadHomeContent() {
    const settings = this.get('settings');
    
    if (settings.apiProvider === 'local') {
      const customSettings = settings.customSettings?.local;
      if (!customSettings?.url || !settings.apiKeys?.local) {
        return { isLocal: false };
      }
      
      try {
        const response = await fetch(`${customSettings.url}/widget/menu`, {
          headers: {
            'Authorization': `Bearer ${settings.apiKeys.local}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.content) {
          return {
            content: data.content,
            isLocal: true
          };
        }
      } catch (error) {
        console.error('Failed to load home content:', error);
        return {
          error: 'Failed to load content',
          isLocal: true
        };
      }
    }
    
    return { isLocal: false };
  }
}

/**
 * ContentModelインスタンスを作成するファクトリ関数
 * 
 * @param {Object} container - 依存性注入コンテナ
 * @returns {ContentModel} - ContentModelインスタンス
 */
export const createContentModel = (container) => {
  const storage = container.get('storage');
  const model = new ContentModel();
  
  model.loadSettings(storage);
  
  return model;
};
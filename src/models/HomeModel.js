
import { Model } from '../architecture.js';

/**
 * ホームページ用データモデルクラス
 * 
 * ホームページのデータモデルを表します。
 * 設定、コンテンツ、APIインタラクションを管理します。
 */
export class HomeModel extends Model {
  /**
   * コンストラクタ
   * 
   * @param {Object} data - モデルの初期データ
   */
  constructor(data = {}) {
    const defaultData = {
      settings: {
        apiProvider: null,
        apiKeys: {},
        customSettings: {}
      },
      content: {
        html: '',
        isLoading: true,
        error: null
      },
      ...data
    };
    
    super(defaultData);
  }
  
  /**
   * ストレージから設定を読み込み
   * 
   * @param {Object} storage - ストレージサービス
   * @returns {Promise<HomeModel>} - チェーンメソッド用のモデルインスタンス
   */
  async loadSettings(storage) {
    try {
      const settings = await storage.get([
        'apiProvider',
        'apiKeys',
        'selectedModels',
        'customSettings'
      ]);
      
      this.set('settings', {
        ...this.get('settings'),
        apiProvider: settings.apiProvider,
        apiKeys: settings.apiKeys || {},
        selectedModels: settings.selectedModels || {},
        customSettings: settings.customSettings || {}
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      this.setError('Failed to load settings');
    }
    
    return this;
  }
  
  /**
   * 読み込み状態を設定
   * 
   * @param {boolean} isLoading - コンテンツが読み込み中かどうか
   * @returns {HomeModel} - チェーンメソッド用のモデルインスタンス
   */
  setLoading(isLoading) {
    const content = { ...this.get('content'), isLoading };
    this.set('content', content);
    return this;
  }
  
  /**
   * コンテンツHTMLを設定
   * 
   * @param {string} html - HTMLコンテンツ
   * @returns {HomeModel} - チェーンメソッド用のモデルインスタンス
   */
  setContent(html) {
    const content = { 
      ...this.get('content'), 
      html,
      isLoading: false,
      error: null
    };
    this.set('content', content);
    return this;
  }
  
  /**
   * エラー状態を設定
   * 
   * @param {string} error - エラーメッセージ
   * @returns {HomeModel} - チェーンメソッド用のモデルインスタンス
   */
  setError(error) {
    const content = { 
      ...this.get('content'), 
      error,
      isLoading: false
    };
    this.set('content', content);
    return this;
  }
  
  /**
   * ローカルAPIが設定されているかチェック
   * 
   * @returns {boolean} - ローカルAPIが設定されているかどうか
   */
  isLocalApiConfigured() {
    const settings = this.get('settings');
    return (
      settings.apiProvider === 'local' &&
      settings.apiKeys?.local &&
      settings.customSettings?.local?.url
    );
  }
  
  /**
   * ローカルAPI設定を取得
   * 
   * @returns {Object|null} - ローカルAPI設定または設定されていない場合はnull
   */
  getLocalApiSettings() {
    if (!this.isLocalApiConfigured()) {
      return null;
    }
    
    const settings = this.get('settings');
    return {
      url: settings.customSettings.local.url,
      token: settings.apiKeys.local
    };
  }
  
  /**
   * 現在のURLがローカルAPIからのコンテンツ表示を許可されているかチェック
   * 
   * @param {string} currentUrl - 現在のURL
   * @returns {Promise<boolean>} - URLが許可されているかどうか
   */
  async checkDisplayAccess(currentUrl) {
    const localApiSettings = this.getLocalApiSettings();
    if (!localApiSettings) {
      return false;
    }
    
    if (currentUrl.startsWith('file://')) {
      return true;
    }
    
    try {
      const { url, token } = localApiSettings;
      const response = await fetch(`${url}/check-display-url`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ current_url: currentUrl })
      });
      
      const data = await response.json();
      return data.allowed;
    } catch (error) {
      console.error('Display check error:', error);
      return false;
    }
  }
  
  /**
   * ローカルAPIからコンテンツを取得
   * 
   * @returns {Promise<string>} - HTMLコンテンツ
   */
  async fetchLocalApiContent() {
    const localApiSettings = this.getLocalApiSettings();
    if (!localApiSettings) {
      throw new Error('Local API not configured');
    }
    
    const { url, token } = localApiSettings;
    const response = await fetch(`${url}/widget/menu`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || 'Failed to fetch menu content');
    }
    
    return data.html_content || '';
  }
  
  /**
   * Markdownファイルからデフォルトコンテンツを読み込み
   * 
   * @param {string} language - 言語コード
   * @returns {Promise<string>} - HTMLコンテンツ
   */
  async loadDefaultContent(language = 'ja') {
    try {
      const lang = language.split('-')[0] || 'ja';
      
      const mdPath = chrome.runtime.getURL(`docs/${lang}/home.md`);
      
      const response = await fetch(mdPath);
      const mdContent = await response.text();
      
      const htmlContent = marked.parse(mdContent);
      
      return `
      <div class="container">
          ${htmlContent}
      </div>
      `;
    } catch (error) {
      console.error('Error loading default content:', error);
      
      try {
        const defaultMdPath = chrome.runtime.getURL('docs/ja/home.md');
        const response = await fetch(defaultMdPath);
        const defaultMdContent = await response.text();
        const htmlContent = marked.parse(defaultMdContent);
        
        return `
        <div class="container">
            ${htmlContent}
        </div>
        `;
      } catch (fallbackError) {
        return `
        <div class="container">
            <div class="alert alert-danger">
                ${chrome.i18n.getMessage('errorLoadingContent')}
            </div>
        </div>
        `;
      }
    }
  }
}

/**
 * HomeModelインスタンスを作成するファクトリ関数
 * 
 * @param {Object} container - 依存性注入コンテナ
 * @returns {HomeModel} - HomeModelインスタンス
 */
export const createHomeModel = (container) => {
  const storage = container.get('storage');
  const model = new HomeModel();
  
  model.loadSettings(storage);
  
  return model;
};
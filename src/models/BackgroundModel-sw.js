
(function(global) {
  'use strict';

  const Model = global.Model;
  
  if (!Model) {
    throw new Error('Model class not available. Make sure architecture-sw.js is loaded first.');
  }

  /**
   * バックグラウンドサービスワーカー用データモデルクラス
   * 
   * バックグラウンドサービスワーカーのデータモデルを表します。
   * 拡張機能の状態、コンテキストメニュー、その他のバックグラウンド関連データを管理します。
   */
  class BackgroundModel extends Model {
    /**
     * コンストラクタ
     * 
     * @param {Object} data - モデルの初期データ
     */
    constructor(data = {}) {
      const defaultData = {
        isInstalled: false,
        contextMenus: [],
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
     * 拡張機能のインストール状態を設定
     * 
     * @param {boolean} isInstalled - 拡張機能がインストールされているかどうか
     * @returns {BackgroundModel} - チェーンメソッド用のモデルインスタンス
     */
    setInstalled(isInstalled) {
      this.set('isInstalled', isInstalled);
      return this;
    }

    /**
     * コンテキストメニュー項目を追加
     * 
     * @param {Object} menuItem - 追加するコンテキストメニュー項目
     * @returns {BackgroundModel} - チェーンメソッド用のモデルインスタンス
     */
    addContextMenu(menuItem) {
      const contextMenus = [...this.get('contextMenus')];
      contextMenus.push(menuItem);
      this.set('contextMenus', contextMenus);
      return this;
    }

    /**
     * コンテキストメニュー項目を削除
     * 
     * @param {string} menuItemId - 削除するコンテキストメニュー項目のID
     * @returns {BackgroundModel} - チェーンメソッド用のモデルインスタンス
     */
    removeContextMenu(menuItemId) {
      const contextMenus = this.get('contextMenus').filter(item => item.id !== menuItemId);
      this.set('contextMenus', contextMenus);
      return this;
    }

    /**
     * すべてのコンテキストメニュー項目をクリア
     * 
     * @returns {BackgroundModel} - チェーンメソッド用のモデルインスタンス
     */
    clearContextMenus() {
      this.set('contextMenus', []);
      return this;
    }

    /**
     * ストレージから設定を読み込み
     * 
     * @param {Object} storage - ストレージサービス
     * @returns {Promise<BackgroundModel>} - チェーンメソッド用のモデルインスタンス
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
        secureLogger.error('Error loading settings:', error);
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
  }

  /**
   * BackgroundModelインスタンスを作成するファクトリ関数
   * 
   * @param {Object} container - 依存性注入コンテナ
   * @returns {BackgroundModel} - BackgroundModelインスタンス
   */
  const createBackgroundModel = (container) => {
    const storage = container.get('storage');
    const model = new BackgroundModel();

    model.loadSettings(storage);

    return model;
  };

  global.BackgroundModel = BackgroundModel;
  global.createBackgroundModel = createBackgroundModel;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this); 
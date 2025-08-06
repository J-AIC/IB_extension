
(function(global) {
  'use strict';

  /**
   * ChromeストレージAPIとのインターフェースを提供するサービスクラス
   */
  class StorageService {
      /**
       * コンストラクタ
       * 
       * @param {Object} [options={}] - サービスのオプション設定
       */
      constructor(options = {}) {
          this.options = {
              storageArea: 'local',
              conversationHistoryKey: 'chatHistory',
              maxConversations: 50,
              ...options
          };
          
          this.storage = chrome.storage[this.options.storageArea];
      }
      
      /**
       * ストレージから値を取得する
       * 
       * @param {string|Array<string>} keys - 取得するキー
       * @returns {Promise<Object>} ストレージからの値
       */
      async get(keys) {
          return new Promise((resolve, reject) => {
              this.storage.get(keys, (result) => {
                  if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message));
                  } else {
                      resolve(result);
                  }
              });
          });
      }
      
      /**
       * ストレージに値を設定する
       * 
       * @param {Object} items - 設定するアイテム
       * @returns {Promise<void>} 操作完了時に解決されるPromise
       */
      async set(items) {
          return new Promise((resolve, reject) => {
              this.storage.set(items, () => {
                  if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message));
                  } else {
                      resolve();
                  }
              });
          });
      }
      
      /**
       * ストレージからキーを削除する
       * 
       * @param {string|Array<string>} keys - 削除するキー
       * @returns {Promise<void>} 操作完了時に解決されるPromise
       */
      async remove(keys) {
          return new Promise((resolve, reject) => {
              this.storage.remove(keys, () => {
                  if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message));
                  } else {
                      resolve();
                  }
              });
          });
      }
      
      /**
       * ストレージを全てクリアする
       * 
       * @returns {Promise<void>} 操作完了時に解決されるPromise
       */
      async clear() {
          return new Promise((resolve, reject) => {
              this.storage.clear(() => {
                  if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message));
                  } else {
                      resolve();
                  }
              });
          });
      }
      
      /**
       * 会話を履歴に保存する
       * 
       * @param {Object} conversation - 保存する会話
       * @returns {Promise<void>} 操作完了時に解決されるPromise
       */
      async saveConversation(conversation) {
          try {
              const result = await this.get(this.options.conversationHistoryKey);
              let history = result[this.options.conversationHistoryKey] || [];
              
              if (!Array.isArray(history)) {
                  history = [];
              }
              
              history.unshift(conversation);
              
              if (history.length > this.options.maxConversations) {
                  history = history.slice(0, this.options.maxConversations);
              }
              
              await this.set({ [this.options.conversationHistoryKey]: history });
          } catch (error) {
              console.error('Error saving conversation:', error);
              throw error;
          }
      }
      
      /**
       * 会話履歴を取得する
       * 
       * @returns {Promise<Array>} 会話履歴
       */
      async getConversationHistory() {
          try {
              const result = await this.get(this.options.conversationHistoryKey);
              return result[this.options.conversationHistoryKey] || [];
          } catch (error) {
              console.error('Error getting conversation history:', error);
              return [];
          }
      }
      
      /**
       * 会話履歴をクリアする
       * 
       * @returns {Promise<void>} 操作完了時に解決されるPromise
       */
      async clearConversationHistory() {
          try {
              await this.set({ [this.options.conversationHistoryKey]: [] });
          } catch (error) {
              console.error('Error clearing conversation history:', error);
              throw error;
          }
      }
  }

  /**
   * テスト用のモックストレージサービスを作成する
   * 
   * @returns {StorageService} モックストレージサービス
   */
  const createMockStorageService = () => {
      const service = new StorageService();
      
      const mockStorage = {};
      
      service.get = async (keys) => {
          if (typeof keys === 'string') {
              return { [keys]: mockStorage[keys] };
          } else if (Array.isArray(keys)) {
              const result = {};
              keys.forEach(key => {
                  result[key] = mockStorage[key];
              });
              return result;
          } else {
              return { ...mockStorage };
          }
      };
      
      service.set = async (items) => {
          Object.assign(mockStorage, items);
      };
      
      service.remove = async (keys) => {
          if (typeof keys === 'string') {
              delete mockStorage[keys];
          } else if (Array.isArray(keys)) {
              keys.forEach(key => {
                  delete mockStorage[key];
              });
          }
      };
      
      service.clear = async () => {
          Object.keys(mockStorage).forEach(key => {
              delete mockStorage[key];
          });
      };
      
      return service;
  };

  /**
   * 依存性注入用のファクトリ関数
   * 
   * @param {Object} container - DIコンテナ
   * @returns {StorageService} ストレージサービスインスタンス
   */
  const createStorageService = (container) => {
      if (typeof chrome === 'undefined' || !chrome.storage) {
          console.warn('Chrome storage API not available, using mock storage service');
          return createMockStorageService();
      }
      
      return new StorageService();
  };

  global.StorageService = StorageService;
  global.createMockStorageService = createMockStorageService;
  global.createStorageService = createStorageService;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this); 
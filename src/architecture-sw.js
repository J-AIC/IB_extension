/**
 * Service Worker対応版のアーキテクチャ定義
 * InsightBuddy Chrome拡張機能で使用されるアーキテクチャパターンを定義
 * Model-View-Controller (MVC) または Model-View-ViewModel (MVVM) パターンの実装のための基底クラスとインターフェースを提供
 */

(function(global) {
  'use strict';

  /**
   * データの状態を管理し、変更を通知する基底モデルクラス
   */
  class Model {
    constructor(data = {}) {
        this.data = data;
        this.listeners = [];
    }

    /**
     * プロパティ値を取得
     * @param {string} key - プロパティキー
     * @returns {*} プロパティ値
     */
    get(key) {
        return this.data[key];
    }

    /**
     * プロパティ値を設定し、リスナーに通知
     * @param {string} key - プロパティキー
     * @param {*} value - 新しい値
     * @returns {Model} このインスタンス
     */
    set(key, value) {
        const oldValue = this.data[key];
        this.data[key] = value;
        
        if (oldValue !== value) {
            this.notifyListeners({ key, oldValue, newValue: value });
        }
        
        return this;
    }

    /**
     * データ変更のリスナーを追加
     * @param {Function} listener - リスナー関数
     * @returns {Model} このインスタンス
     */
    addListener(listener) {
        if (typeof listener === 'function' && !this.listeners.includes(listener)) {
            this.listeners.push(listener);
        }
        return this;
    }

    /**
     * EventBus APIとの一貫性のためのエイリアス
     * @param {string} event - イベント名（無視される）
     * @param {Function} listener - リスナー関数
     * @returns {Model} このインスタンス
     */
    on(event, listener) {
        return this.addListener(listener);
    }

    /**
     * リスナーを削除
     * @param {Function} listener - 削除するリスナー関数
     * @returns {Model} このインスタンス
     */
    removeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
        return this;
    }

    /**
     * すべてのリスナーにデータ変更を通知
     * @param {Object} change - 変更情報
     */
    notifyListeners(change) {
        this.listeners.forEach(listener => {
            try {
                listener(change, this);
            } catch (error) {
                console.error('Error in model listener:', error);
            }
        });
    }

    /**
     * 複数のプロパティを一度に更新
     * @param {Object} updates - 更新するプロパティのオブジェクト
     * @returns {Model} このインスタンス
     */
    update(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.set(key, value);
        });
        return this;
    }

    /**
     * モデルを初期状態または新しい状態にリセット
     * @param {Object} newData - 新しいデータ
     * @returns {Model} このインスタンス
     */
    reset(newData = {}) {
        const oldData = { ...this.data };
        this.data = newData;
        this.notifyListeners({ key: 'reset', oldValue: oldData, newValue: newData });
        return this;
    }

    /**
     * モデルをプレーンオブジェクトに変換
     * @returns {Object} データのコピー
     */
    toJSON() {
        return { ...this.data };
    }
  }

  /**
   * UIの表示とユーザーインタラクションを管理する基底ビュークラス
   */
  class View {
    constructor(element, model = null, controller = null) {
        this.element = element instanceof HTMLElement ? element : document.querySelector(element);
        this.model = model;
        this.controller = controller;
        this.childViews = [];
        
        if (!this.element) {
            throw new Error(`View element not found: ${element}`);
        }
        
        if (this.model) {
            this.model.addListener(this.onModelChange.bind(this));
        }
        
        this.initialize();
    }

    /**
     * ビューを初期化（サブクラスでオーバーライド）
     */
    initialize() {
    }

    /**
     * モデル変更を処理（サブクラスでオーバーライド）
     * @param {Object} change - 変更情報
     * @param {Model} model - モデルインスタンス
     */
    onModelChange(change, model) {
        this.render();
    }

    /**
     * ビューをレンダリング（サブクラスでオーバーライド）
     * @returns {View} このインスタンス
     */
    render() {
        return this;
    }

    /**
     * 子ビューを追加
     * @param {View} view - 追加する子ビュー
     * @returns {View} このインスタンス
     */
    addChildView(view) {
        if (view instanceof View && !this.childViews.includes(view)) {
            this.childViews.push(view);
        }
        return this;
    }

    /**
     * 子ビューを削除
     * @param {View} view - 削除する子ビュー
     * @returns {View} このインスタンス
     */
    removeChildView(view) {
        const index = this.childViews.indexOf(view);
        if (index !== -1) {
            this.childViews.splice(index, 1);
        }
        return this;
    }

    /**
     * ビューをクリーンアップ
     * @returns {View} このインスタンス
     */
    dispose() {
        if (this.model) {
            this.model.removeListener(this.onModelChange.bind(this));
        }
        
        this.childViews.forEach(view => view.dispose());
        this.childViews = [];
        
        return this;
    }
  }

  /**
   * ユーザーアクションを処理し、モデルとビューを協調させる基底コントローラクラス
   */
  class Controller {
    constructor(model = null, view = null) {
        this.model = model;
        this.view = view;
        
        if (this.view) {
            this.view.controller = this;
        }
        
        this.initialize();
    }

    /**
     * コントローラを初期化（サブクラスでオーバーライド）
     */
    initialize() {
    }

    /**
     * ユーザーアクションを処理（サブクラスでオーバーライド）
     * @param {string} action - アクション名
     * @param {*} data - アクションデータ
     */
    handleAction(action, data) {
    }
  }

  /**
   * MVVMパターン用の基底ビューモデルクラス
   */
  class ViewModel {
    constructor(model = null) {
        this.model = model;
        this.listeners = [];
        
        if (this.model) {
            this.model.addListener(this.onModelChange.bind(this));
        }
        
        this.initialize();
    }

    /**
     * ビューモデルを初期化（サブクラスでオーバーライド）
     */
    initialize() {
    }

    /**
     * モデル変更を処理（サブクラスでオーバーライド）
     * @param {Object} change - 変更情報
     * @param {Model} model - モデルインスタンス
     */
    onModelChange(change, model) {
        this.notifyListeners(change);
    }

    /**
     * ビューモデル変更のリスナーを追加
     * @param {Function} listener - リスナー関数
     * @returns {ViewModel} このインスタンス
     */
    addListener(listener) {
        if (typeof listener === 'function' && !this.listeners.includes(listener)) {
            this.listeners.push(listener);
        }
        return this;
    }

    /**
     * リスナーを削除
     * @param {Function} listener - 削除するリスナー関数
     * @returns {ViewModel} このインスタンス
     */
    removeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
        return this;
    }

    /**
     * すべてのリスナーにビューモデル変更を通知
     * @param {Object} change - 変更情報
     */
    notifyListeners(change) {
        this.listeners.forEach(listener => {
            try {
                listener(change, this);
            } catch (error) {
                console.error('Error in view model listener:', error);
            }
        });
    }

    /**
     * ビューモデルをクリーンアップ
     * @returns {ViewModel} このインスタンス
     */
    dispose() {
        if (this.model) {
            this.model.removeListener(this.onModelChange.bind(this));
        }
        
        this.listeners = [];
        
        return this;
    }
  }

  /**
   * 依存性注入コンテナ
   */
  class DIContainer {
    constructor() {
        this.services = new Map();
        this.factories = new Map();
        this.singletons = new Map();
    }

    /**
     * サービスファクトリを登録
     * @param {string} name - サービス名
     * @param {Function} factory - ファクトリ関数
     * @param {boolean} singleton - シングルトンとして登録するか
     * @returns {DIContainer} このインスタンス
     * @throws {Error} ファクトリが関数でない場合
     */
    register(name, factory, singleton = false) {
        if (typeof factory !== 'function') {
            throw new Error(`Service factory must be a function: ${name}`);
        }
        
        this.factories.set(name, factory);
        
        if (singleton) {
            this.singletons.set(name, factory(this));
        }
        
        return this;
    }

    /**
     * サービスインスタンスを取得
     * @param {string} name - サービス名
     * @returns {*} サービスインスタンス
     * @throws {Error} サービスが登録されていない場合
     */
    get(name) {
        if (this.singletons.has(name)) {
            return this.singletons.get(name);
        }
        
        if (!this.factories.has(name)) {
            throw new Error(`Service not registered: ${name}`);
        }
        
        const factory = this.factories.get(name);
        const instance = factory(this);
        
        this.services.set(name, instance);
        
        return instance;
    }

    /**
     * サービスが登録されているか確認
     * @param {string} name - サービス名
     * @returns {boolean} 登録されているか
     */
    has(name) {
        return this.factories.has(name);
    }

    /**
     * サービスを削除
     * @param {string} name - サービス名
     * @returns {DIContainer} このインスタンス
     */
    remove(name) {
        this.factories.delete(name);
        this.services.delete(name);
        this.singletons.delete(name);
        
        return this;
    }

    /**
     * すべてのサービスをクリア
     * @returns {DIContainer} このインスタンス
     */
    clear() {
        this.factories.clear();
        this.services.clear();
        this.singletons.clear();
        
        return this;
    }
  }

  /**
   * コンポーネント間通信のためのイベントバス
   */
  class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * イベントを購読
     * @param {string} event - イベント名
     * @param {Function} listener - リスナー関数
     * @returns {EventBus} このインスタンス
     */
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        
        const eventListeners = this.listeners.get(event);
        
        if (typeof listener === 'function' && !eventListeners.includes(listener)) {
            eventListeners.push(listener);
        }
        
        return this;
    }

    /**
     * イベントの購読を解除
     * @param {string} event - イベント名
     * @param {Function} listener - リスナー関数
     * @returns {EventBus} このインスタンス
     */
    off(event, listener) {
        if (!this.listeners.has(event)) {
            return this;
        }
        
        const eventListeners = this.listeners.get(event);
        const index = eventListeners.indexOf(listener);
        
        if (index !== -1) {
            eventListeners.splice(index, 1);
        }
        
        return this;
    }

    /**
     * イベントを発火
     * @param {string} event - イベント名
     * @param {*} data - イベントデータ
     * @returns {EventBus} このインスタンス
     */
    emit(event, data) {
        if (!this.listeners.has(event)) {
            return this;
        }
        
        const eventListeners = this.listeners.get(event);
        
        eventListeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error(`Error in event listener for "${event}":`, error);
            }
        });
        
        return this;
    }

    /**
     * イベントのすべてのリスナーをクリア
     * @param {string} [event] - イベント名（省略時はすべてクリア）
     * @returns {EventBus} このインスタンス
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
        
        return this;
    }
  }

  const container = new DIContainer();
  const eventBus = new EventBus();

  container.register('eventBus', () => eventBus, true);

  global.Model = Model;
  global.View = View;
  global.Controller = Controller;
  global.ViewModel = ViewModel;
  global.DIContainer = DIContainer;
  global.EventBus = EventBus;
  global.container = container;
  global.eventBus = eventBus;

  global.architectureLoaded = true;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
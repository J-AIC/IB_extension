/**
 * InsightBuddy Chrome拡張機能の集中状態管理システム
 * Redux/Vuexライクなパターンで予測可能な状態管理を実装
 */

import { eventBus } from './architecture.js';

/**
 * ストアにディスパッチできるアクションタイプの定義
 */
export const ActionTypes = {
    INIT: '@@state/INIT',
    RESET: '@@state/RESET',
    PERSIST: '@@state/PERSIST',
    HYDRATE: '@@state/HYDRATE',
};

/**
 * アクションクリエーター関数を生成するファクトリー関数
 * 
 * @param {string} type - アクションタイプ
 * @returns {Function} アクションクリエーター関数
 */
export const createAction = (type) => {
    return (payload = {}, meta = {}) => ({
        type,
        payload,
        meta,
        timestamp: Date.now()
    });
};

/**
 * リデューサー関数の型定義
 * 
 * @callback ReducerFunction
 * @param {Object} state - 現在の状態
 * @param {Object} action - アクションオブジェクト
 * @returns {Object} 新しい状態
 */

/**
 * ミドルウェア関数の型定義
 * 
 * @callback MiddlewareFunction
 * @param {Store} store - ストアインスタンス
 * @returns {Function} ミドルウェア関数
 */

/**
 * アプリケーション状態を管理し、状態操作のメソッドを提供するストアクラス
 */
export class Store {
    /**
     * ストアのコンストラクタ
     * 
     * @param {Object} options - ストアオプション
     * @param {Object} options.initialState - 初期状態
     * @param {ReducerFunction} options.rootReducer - ルートリデューサー関数
     * @param {Array<MiddlewareFunction>} options.middleware - ミドルウェア関数の配列
     * @param {boolean} options.debug - デバッグモードを有効にするかどうか
     */
    constructor(options = {}) {
        const {
            initialState = {},
            rootReducer = (state, action) => state,
            middleware = [],
            debug = false
        } = options;
        
        this.state = { ...initialState };
        this.rootReducer = rootReducer;
        this.middleware = middleware;
        this.debug = debug;
        this.listeners = new Set();
        this.middlewareChain = this.applyMiddleware();
        
        this.dispatch({ type: ActionTypes.INIT });
    }
    
    /**
     * 現在の状態を取得
     * 
     * @returns {Object} 現在の状態のコピー
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * アクションをディスパッチ
     * 
     * @param {Object} action - ディスパッチするアクション
     * @returns {Object} ディスパッチされたアクション
     */
    dispatch(action) {
        if (this.debug) {
            console.group(`%c Action: ${action.type}`, 'color: #9E9E9E; font-weight: bold');
            console.log('%c Previous State:', 'color: #9E9E9E', this.state);
            console.log('%c Action:', 'color: #03A9F4', action);
        }
        
        if (this.middlewareChain) {
            return this.middlewareChain(action);
        }
        
        const prevState = { ...this.state };
        this.state = this.rootReducer(this.state, action);
        
        if (this.debug) {
            console.log('%c Next State:', 'color: #4CAF50', this.state);
            console.groupEnd();
        }
        
        this.notifyListeners(prevState);
        
        eventBus.emit('state:change', {
            action,
            prevState,
            nextState: this.state
        });
        
        return action;
    }
    
    /**
     * 状態変更を購読
     * 
     * @param {Function} listener - リスナー関数
     * @returns {Function} 購読解除関数
     * @throws {Error} リスナーが関数でない場合
     */
    subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('Expected the listener to be a function.');
        }
        
        this.listeners.add(listener);
        
        return () => {
            this.listeners.delete(listener);
        };
    }
    
    /**
     * 特定の状態パスの変更を購読
     * 
     * @param {string|Array<string>} paths - 監視する状態パス
     * @param {Function} listener - リスナー関数
     * @returns {Function} 購読解除関数
     */
    subscribeToPath(paths, listener) {
        const pathArray = Array.isArray(paths) ? paths : [paths];
        
        const wrappedListener = (prevState) => {
            const hasChanged = pathArray.some(path => {
                const pathParts = path.split('.');
                let prevValue = prevState;
                let nextValue = this.state;
                
                for (const part of pathParts) {
                    prevValue = prevValue?.[part];
                    nextValue = nextValue?.[part];
                }
                
                return prevValue !== nextValue;
            });
            
            if (hasChanged) {
                listener(this.state, prevState);
            }
        };
        
        wrappedListener.originalListener = listener;
        
        return this.subscribe(wrappedListener);
    }
    
    /**
     * すべてのリスナーに状態変更を通知
     * 
     * @param {Object} prevState - 前の状態
     */
    notifyListeners(prevState) {
        this.listeners.forEach(listener => {
            try {
                listener(prevState);
            } catch (error) {
                console.error('Error in store listener:', error);
            }
        });
    }
    
    /**
     * ミドルウェアを適用
     * 
     * @returns {Function} ミドルウェアチェーン
     */
    applyMiddleware() {
        if (this.middleware.length === 0) {
            return null;
        }
        
        const middlewareAPI = {
            getState: this.getState.bind(this),
            dispatch: this.dispatch.bind(this)
        };
        
        const chain = this.middleware.map(middleware => middleware(middlewareAPI));
        
        return chain.reduce((a, b) => action => a(b(action)));
    }
    
    /**
     * ストアを初期状態にリセット
     * 
     * @param {Object} [state={}] - 新しい状態
     */
    reset(state = {}) {
        this.dispatch({
            type: ActionTypes.RESET,
            payload: state
        });
    }
    
    /**
     * 現在の状態を永続化
     * 
     * @param {Object} [options={}] - 永続化オプション
     * @param {string} [options.key='app_state'] - ストレージキー
     * @param {Storage} [options.storage=localStorage] - ストレージオブジェクト
     * @param {Function} [options.filter=null] - 状態フィルター関数
     * @returns {Promise<void>} 状態が永続化されたときに解決されるPromise
     * @throws {Error} ストレージタイプがサポートされていない場合
     */
    async persist(options = {}) {
        const {
            key = 'app_state',
            storage = localStorage,
            filter = null
        } = options;
        
        let stateToSave = this.state;
        
        if (typeof filter === 'function') {
            stateToSave = filter(stateToSave);
        }
        
        try {
            const serializedState = JSON.stringify(stateToSave);
            
            if (storage === localStorage || storage === sessionStorage) {
                storage.setItem(key, serializedState);
            } else if (typeof storage.set === 'function') {
                await new Promise((resolve, reject) => {
                    storage.set({ [key]: serializedState }, () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve();
                        }
                    });
                });
            } else {
                throw new Error('Unsupported storage type');
            }
            
            this.dispatch({
                type: ActionTypes.PERSIST,
                payload: { key, state: stateToSave }
            });
        } catch (error) {
            console.error('Error persisting state:', error);
            throw error;
        }
    }
    
    /**
     * 永続化された状態からストアを復元
     * 
     * @param {Object} [options={}] - ハイドレーションオプション
     * @param {string} [options.key='app_state'] - ストレージキー
     * @param {Storage} [options.storage=localStorage] - ストレージオブジェクト
     * @param {boolean} [options.merge=true] - 既存の状態とマージするかどうか
     * @returns {Promise<void>} 状態が復元されたときに解決されるPromise
     * @throws {Error} ストレージタイプがサポートされていない場合
     */
    async hydrate(options = {}) {
        const {
            key = 'app_state',
            storage = localStorage,
            merge = true
        } = options;
        
        try {
            let serializedState;
            
            if (storage === localStorage || storage === sessionStorage) {
                serializedState = storage.getItem(key);
            } else if (typeof storage.get === 'function') {
                serializedState = await new Promise((resolve, reject) => {
                    storage.get(key, (result) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(result[key]);
                        }
                    });
                });
            } else {
                throw new Error('Unsupported storage type');
            }
            
            if (!serializedState) {
                return;
            }
            
            const parsedState = JSON.parse(serializedState);
            
            const newState = merge
                ? { ...this.state, ...parsedState }
                : parsedState;
            
            this.dispatch({
                type: ActionTypes.HYDRATE,
                payload: { key, state: newState }
            });
        } catch (error) {
            console.error('Error hydrating state:', error);
            throw error;
        }
    }
}

/**
 * リデューサー関数を作成
 * 
 * @param {Object} initialState - 初期状態
 * @param {Object} handlers - アクションタイプハンドラー
 * @returns {ReducerFunction} リデューサー関数
 */
export function createReducer(initialState, handlers) {
    return (state = initialState, action) => {
        if (action.type === ActionTypes.RESET) {
            return { ...action.payload };
        }
        
        if (handlers.hasOwnProperty(action.type)) {
            return handlers[action.type](state, action);
        }
        
        return state;
    };
}

/**
 * 複数のリデューサーを単一のリデューサーに結合
 * 
 * @param {Object} reducers - リデューサー関数のオブジェクト
 * @returns {ReducerFunction} 結合されたリデューサー関数
 */
export function combineReducers(reducers) {
    return (state = {}, action) => {
        const nextState = {};
        let hasChanged = false;
        
        Object.entries(reducers).forEach(([key, reducer]) => {
            const previousStateForKey = state[key];
            const nextStateForKey = reducer(previousStateForKey, action);
            
            nextState[key] = nextStateForKey;
            hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
        });
        
        return hasChanged ? nextState : state;
    };
}

/**
 * ミドルウェア関数を作成
 * 
 * @param {Function} middleware - ミドルウェア関数
 * @returns {MiddlewareFunction} ミドルウェア関数
 */
export function createMiddleware(middleware) {
    return store => next => action => {
        return middleware(store, next, action);
    };
}

/**
 * アクションと状態変更をコンソールに記録するロガーミドルウェア
 * 
 * @returns {MiddlewareFunction} ロガーミドルウェア
 */
export const loggerMiddleware = createMiddleware((store, next, action) => {
    console.group(`%c Action: ${action.type}`, 'color: #9E9E9E; font-weight: bold');
    console.log('%c Previous State:', 'color: #9E9E9E', store.getState());
    console.log('%c Action:', 'color: #03A9F4', action);
    
    const result = next(action);
    
    console.log('%c Next State:', 'color: #4CAF50', store.getState());
    console.groupEnd();
    
    return result;
});

/**
 * 非同期操作を実行できる関数のディスパッチを可能にするサンクミドルウェア
 * 
 * @returns {MiddlewareFunction} サンクミドルウェア
 */
export const thunkMiddleware = createMiddleware((store, next, action) => {
    if (typeof action === 'function') {
        return action(store.dispatch, store.getState);
    }
    
    return next(action);
});

/**
 * ストアインスタンスを作成
 * 
 * @param {Object} options - ストアオプション
 * @returns {Store} ストアインスタンス
 */
export function createStore(options = {}) {
    return new Store(options);
}

/**
 * セレクター関数を作成
 * 
 * @param {Function} selector - セレクター関数
 * @returns {Function} メモ化されたセレクター関数
 */
export function createSelector(selector) {
    let lastState;
    let lastResult;
    
    return (state) => {
        if (state === lastState) {
            return lastResult;
        }
        
        lastState = state;
        lastResult = selector(state);
        
        return lastResult;
    };
}

export const store = createStore({
    debug: typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
});

import { container } from './architecture.js';
container.register('store', () => store, true);
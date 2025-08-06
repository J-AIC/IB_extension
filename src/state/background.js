/**
 * バックグラウンドサービスワーカーの状態管理モジュール
 * アクションタイプ、アクションクリエーター、リデューサー、セレクターを含む
 */

import { createAction, createReducer, createSelector } from '../stateManagement.js';

/**
 * アクションタイプ
 */
export const ActionTypes = {
    SET_INSTALLED: 'background/SET_INSTALLED',
    ADD_CONTEXT_MENU: 'background/ADD_CONTEXT_MENU',
    REMOVE_CONTEXT_MENU: 'background/REMOVE_CONTEXT_MENU',
    CLEAR_CONTEXT_MENUS: 'background/CLEAR_CONTEXT_MENUS',
    LOAD_SETTINGS: 'background/LOAD_SETTINGS'
};

/**
 * アクションクリエーター
 */
export const setInstalled = createAction(ActionTypes.SET_INSTALLED);
export const addContextMenu = createAction(ActionTypes.ADD_CONTEXT_MENU);
export const removeContextMenu = createAction(ActionTypes.REMOVE_CONTEXT_MENU);
export const clearContextMenus = createAction(ActionTypes.CLEAR_CONTEXT_MENUS);
export const loadSettings = createAction(ActionTypes.LOAD_SETTINGS);

/**
 * 初期状態
 */
const initialState = {
    isInstalled: false,
    contextMenus: [],
    settings: {
        apiProvider: null,
        apiKeys: {},
        customSettings: {}
    }
};

/**
 * リデューサー
 */
export const reducer = createReducer(initialState, {
    [ActionTypes.SET_INSTALLED]: (state, action) => ({
        ...state,
        isInstalled: action.payload
    }),
    [ActionTypes.ADD_CONTEXT_MENU]: (state, action) => ({
        ...state,
        contextMenus: [...state.contextMenus, action.payload]
    }),
    [ActionTypes.REMOVE_CONTEXT_MENU]: (state, action) => ({
        ...state,
        contextMenus: state.contextMenus.filter(item => item.id !== action.payload)
    }),
    [ActionTypes.CLEAR_CONTEXT_MENUS]: (state) => ({
        ...state,
        contextMenus: []
    }),
    [ActionTypes.LOAD_SETTINGS]: (state, action) => ({
        ...state,
        settings: {
            ...state.settings,
            ...action.payload
        }
    })
});

/**
 * セレクター
 */
export const selectIsInstalled = createSelector(state => state.background.isInstalled);
export const selectContextMenus = createSelector(state => state.background.contextMenus);
export const selectSettings = createSelector(state => state.background.settings);

export const selectIsAuthenticated = createSelector(state => {
    const { apiProvider, apiKeys, customSettings } = state.background.settings;
    if (!apiProvider) return false;
    
    if (apiProvider === 'local') {
        return !!apiKeys?.local && !!customSettings?.local?.url;
    }
    
    return !!apiKeys?.[apiProvider];
});

/**
 * サンクアクション
 */
export const loadSettingsFromStorage = (storage) => async (dispatch) => {
    try {
        const settings = await storage.get([
            'apiProvider',
            'apiKeys',
            'customSettings'
        ]);
        
        const payload = {};
        if (settings.apiProvider) payload.apiProvider = settings.apiProvider;
        if (settings.apiKeys) payload.apiKeys = settings.apiKeys;
        if (settings.customSettings) payload.customSettings = settings.customSettings;
        
        dispatch(loadSettings(payload));
    } catch (error) {
        console.error('Error loading background settings:', error);
    }
};

export const createContextMenus = () => async (dispatch, getState) => {
    try {
        chrome.contextMenus.removeAll();
        dispatch(clearContextMenus());
        
        const menuItem = {
            id: "openHome",
            title: "InsightBuddyを開く",
            contexts: ["action"]
        };
        
        chrome.contextMenus.create(menuItem);
        dispatch(addContextMenu(menuItem));
    } catch (error) {
        console.error('Error creating context menus:', error);
    }
};
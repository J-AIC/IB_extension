/**
 * コンテンツスクリプトの状態管理モジュール
 * アクションタイプ、アクションクリエーター、リデューサー、セレクターを含む
 */

import { createAction, createReducer, createSelector } from '../stateManagement.js';

/**
 * アクションタイプ
 */
export const ActionTypes = {
    SET_OPEN: 'content/SET_OPEN',
    TOGGLE_OPEN: 'content/TOGGLE_OPEN',
    SET_CONTAINER: 'content/SET_CONTAINER',
    LOAD_SETTINGS: 'content/LOAD_SETTINGS'
};

/**
 * アクションクリエーター
 */
export const setOpen = createAction(ActionTypes.SET_OPEN);
export const toggleOpen = createAction(ActionTypes.TOGGLE_OPEN);
export const setContainer = createAction(ActionTypes.SET_CONTAINER);
export const loadSettings = createAction(ActionTypes.LOAD_SETTINGS);

/**
 * 初期状態
 */
const initialState = {
    isOpen: false,
    container: null,
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
    [ActionTypes.SET_OPEN]: (state, action) => ({
        ...state,
        isOpen: action.payload
    }),
    [ActionTypes.TOGGLE_OPEN]: (state) => ({
        ...state,
        isOpen: !state.isOpen
    }),
    [ActionTypes.SET_CONTAINER]: (state, action) => ({
        ...state,
        container: action.payload
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
export const selectIsOpen = createSelector(state => state.content.isOpen);
export const selectContainer = createSelector(state => state.content.container);
export const selectSettings = createSelector(state => state.content.settings);

export const selectIsAuthenticated = createSelector(state => {
    const { apiProvider, apiKeys, customSettings } = state.content.settings;
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
        console.error('Error loading content settings:', error);
    }
};

export const checkUrlPermission = (url) => async (dispatch, getState) => {
    const state = getState();
    const { apiProvider, apiKeys, customSettings } = state.content.settings;
    
    if (apiProvider === 'local') {
        try {
            const localSettings = customSettings?.local || {};
            const response = await fetch(`${localSettings.url}/check-display-url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeys.local}`
                },
                body: JSON.stringify({ current_url: url })
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
};

export const loadHomeContent = () => async (dispatch, getState) => {
    const state = getState();
    const { apiProvider, apiKeys, customSettings } = state.content.settings;
    
    if (apiProvider === 'local') {
        const localSettings = customSettings?.local;
        if (!localSettings?.url || !apiKeys?.local) {
            return { isLocal: false };
        }
        
        try {
            const response = await fetch(`${localSettings.url}/widget/menu`, {
                headers: {
                    'Authorization': `Bearer ${apiKeys.local}`,
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
};
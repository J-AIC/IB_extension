/**
 * ホームページの状態管理モジュール
 * アクションタイプ、アクションクリエーター、リデューサー、セレクターを含む
 */

import { createAction, createReducer, createSelector } from '../stateManagement.js';

/**
 * アクションタイプ
 */
export const ActionTypes = {
    LOAD_SETTINGS: 'home/LOAD_SETTINGS',
    SET_LOADING: 'home/SET_LOADING',
    SET_CONTENT: 'home/SET_CONTENT',
    SET_ERROR: 'home/SET_ERROR'
};

/**
 * アクションクリエーター
 */
export const loadSettings = createAction(ActionTypes.LOAD_SETTINGS);
export const setLoading = createAction(ActionTypes.SET_LOADING);
export const setContent = createAction(ActionTypes.SET_CONTENT);
export const setError = createAction(ActionTypes.SET_ERROR);

/**
 * 初期状態
 */
const initialState = {
    settings: {
        apiProvider: null,
        apiKeys: {},
        selectedModels: {},
        customSettings: {}
    },
    content: {
        html: '',
        isLoading: true,
        error: null
    }
};

/**
 * リデューサー
 */
export const reducer = createReducer(initialState, {
    [ActionTypes.LOAD_SETTINGS]: (state, action) => ({
        ...state,
        settings: {
            ...state.settings,
            ...action.payload
        }
    }),
    [ActionTypes.SET_LOADING]: (state, action) => ({
        ...state,
        content: {
            ...state.content,
            isLoading: action.payload
        }
    }),
    [ActionTypes.SET_CONTENT]: (state, action) => ({
        ...state,
        content: {
            ...state.content,
            html: action.payload,
            isLoading: false,
            error: null
        }
    }),
    [ActionTypes.SET_ERROR]: (state, action) => ({
        ...state,
        content: {
            ...state.content,
            error: action.payload,
            isLoading: false
        }
    })
});

/**
 * セレクター
 */
export const selectSettings = createSelector(state => state.home.settings);
export const selectContent = createSelector(state => state.home.content);
export const selectIsLoading = createSelector(state => state.home.content.isLoading);
export const selectError = createSelector(state => state.home.content.error);
export const selectHtml = createSelector(state => state.home.content.html);

export const selectIsLocalApiConfigured = createSelector(state => {
    const { apiProvider, apiKeys, customSettings } = state.home.settings;
    return (
        apiProvider === 'local' &&
        apiKeys?.local &&
        customSettings?.local?.url
    );
});

export const selectLocalApiSettings = createSelector(state => {
    const { apiProvider, apiKeys, customSettings } = state.home.settings;
    
    if (
        apiProvider !== 'local' ||
        !apiKeys?.local ||
        !customSettings?.local?.url
    ) {
        return null;
    }
    
    return {
        url: customSettings.local.url,
        token: apiKeys.local
    };
});

/**
 * サンクアクション
 */
export const loadSettingsFromStorage = (storage) => async (dispatch) => {
    try {
        const settings = await storage.get([
            'apiProvider',
            'apiKeys',
            'selectedModels',
            'customSettings'
        ]);
        
        const payload = {};
        if (settings.apiProvider) payload.apiProvider = settings.apiProvider;
        if (settings.apiKeys) payload.apiKeys = settings.apiKeys;
        if (settings.selectedModels) payload.selectedModels = settings.selectedModels;
        if (settings.customSettings) payload.customSettings = settings.customSettings;
        
        dispatch(loadSettings(payload));
    } catch (error) {
        console.error('Error loading settings:', error);
        dispatch(setError('Failed to load settings'));
    }
};

export const checkDisplayAccess = (currentUrl) => async (dispatch, getState) => {
    const state = getState();
    const localApiSettings = selectLocalApiSettings(state);
    
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
};

export const fetchLocalApiContent = () => async (dispatch, getState) => {
    const state = getState();
    const localApiSettings = selectLocalApiSettings(state);
    
    if (!localApiSettings) {
        throw new Error('Local API not configured');
    }
    
    dispatch(setLoading(true));
    
    try {
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
        
        const htmlContent = data.html_content || '';
        dispatch(setContent(htmlContent));
        return htmlContent;
    } catch (error) {
        console.error('Error fetching local API content:', error);
        dispatch(setError(error.message));
        throw error;
    }
};

export const loadDefaultContent = (language = 'ja') => async (dispatch) => {
    dispatch(setLoading(true));
    
    try {
        const lang = language.split('-')[0] || 'ja';
        
        const mdPath = chrome.runtime.getURL(`docs/${lang}/home.md`);
        
        const response = await fetch(mdPath);
        const mdContent = await response.text();
        
        const htmlContent = marked.parse(mdContent);
        
        const content = `
        <div class="container">
            ${htmlContent}
        </div>
        `;
        
        dispatch(setContent(content));
        return content;
    } catch (error) {
        console.error('Error loading default content:', error);
        
        try {
            const defaultMdPath = chrome.runtime.getURL('docs/ja/home.md');
            const response = await fetch(defaultMdPath);
            const defaultMdContent = await response.text();
            const htmlContent = marked.parse(defaultMdContent);
            
            const content = `
            <div class="container">
                ${htmlContent}
            </div>
            `;
            
            dispatch(setContent(content));
            return content;
        } catch (fallbackError) {
            const errorContent = `
            <div class="container">
                <div class="alert alert-danger">
                    ${chrome.i18n.getMessage('errorLoadingContent')}
                </div>
            </div>
            `;
            
            dispatch(setError('Failed to load content'));
            dispatch(setContent(errorContent));
            return errorContent;
        }
    }
};

export const loadHomeContent = () => async (dispatch, getState) => {
    const state = getState();
    const isLocalApiConfigured = selectIsLocalApiConfigured(state);
    
    if (isLocalApiConfigured) {
        try {
            return await dispatch(fetchLocalApiContent());
        } catch (error) {
            console.error('Failed to load local API content, falling back to default:', error);
            return await dispatch(loadDefaultContent());
        }
    } else {
        return await dispatch(loadDefaultContent());
    }
};
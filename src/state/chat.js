/**
 * チャット機能の状態管理モジュール
 * アクションタイプ、アクションクリエーター、リデューサー、セレクターを含む
 */

import { createAction, createReducer, createSelector } from '../stateManagement.js';

/**
 * アクションタイプ
 */
export const ActionTypes = {
    ADD_MESSAGE: 'chat/ADD_MESSAGE',
    CLEAR_MESSAGES: 'chat/CLEAR_MESSAGES',
    SET_PROCESSING: 'chat/SET_PROCESSING',
    SET_PROVIDER_AND_MODEL: 'chat/SET_PROVIDER_AND_MODEL',
    SET_SYSTEM_PROMPT: 'chat/SET_SYSTEM_PROMPT',
    SET_PAGE_CONTEXT: 'chat/SET_PAGE_CONTEXT'
};

/**
 * アクションクリエーター
 */
export const addMessage = createAction(ActionTypes.ADD_MESSAGE);
export const clearMessages = createAction(ActionTypes.CLEAR_MESSAGES);
export const setProcessing = createAction(ActionTypes.SET_PROCESSING);
export const setProviderAndModel = createAction(ActionTypes.SET_PROVIDER_AND_MODEL);
export const setSystemPrompt = createAction(ActionTypes.SET_SYSTEM_PROMPT);
export const setPageContext = createAction(ActionTypes.SET_PAGE_CONTEXT);

/**
 * 初期状態
 */
const initialState = {
    messages: [],
    isProcessing: false,
    currentProvider: null,
    currentModel: null,
    systemPrompt: '',
    pageContext: {
        title: '',
        url: '',
        content: ''
    }
};

/**
 * リデューサー
 */
export const reducer = createReducer(initialState, {
    [ActionTypes.ADD_MESSAGE]: (state, action) => {
        const { role, content, timestamp = new Date().toISOString() } = action.payload;
        
        if (!role || !content) {
            return state;
        }
        
        const newMessage = {
            role,
            content,
            timestamp
        };
        
        return {
            ...state,
            messages: [...state.messages, newMessage]
        };
    },
    [ActionTypes.CLEAR_MESSAGES]: (state) => ({
        ...state,
        messages: []
    }),
    [ActionTypes.SET_PROCESSING]: (state, action) => ({
        ...state,
        isProcessing: action.payload
    }),
    [ActionTypes.SET_PROVIDER_AND_MODEL]: (state, action) => ({
        ...state,
        currentProvider: action.payload.provider,
        currentModel: action.payload.model
    }),
    [ActionTypes.SET_SYSTEM_PROMPT]: (state, action) => ({
        ...state,
        systemPrompt: action.payload
    }),
    [ActionTypes.SET_PAGE_CONTEXT]: (state, action) => ({
        ...state,
        pageContext: {
            ...state.pageContext,
            ...action.payload
        }
    })
});

/**
 * セレクター
 */
export const selectMessages = createSelector(state => state.chat.messages);
export const selectIsProcessing = createSelector(state => state.chat.isProcessing);
export const selectCurrentProvider = createSelector(state => state.chat.currentProvider);
export const selectCurrentModel = createSelector(state => state.chat.currentModel);
export const selectSystemPrompt = createSelector(state => state.chat.systemPrompt);
export const selectPageContext = createSelector(state => state.chat.pageContext);

export const selectMessagesForApi = createSelector(state => {
    const { systemPrompt, messages } = state.chat;
    
    if (systemPrompt) {
        return [
            { role: 'system', content: systemPrompt },
            ...messages
        ];
    }
    
    return [...messages];
});

export const selectFormattedHistory = createSelector(state => {
    const { messages } = state.chat;
    const maxTurns = 4;
    
    const turns = [];
    let currentTurn = { user: null, assistant: null };
    
    for (const message of messages) {
        if (message.role === 'user') {
            if (currentTurn.user !== null) {
                turns.push({ ...currentTurn });
                currentTurn = { user: null, assistant: null };
            }
            currentTurn.user = message;
        } else if (message.role === 'assistant') {
            currentTurn.assistant = message;
            if (currentTurn.user !== null) {
                turns.push({ ...currentTurn });
                currentTurn = { user: null, assistant: null };
            }
        }
    }
    
    if (currentTurn.user !== null || currentTurn.assistant !== null) {
        turns.push(currentTurn);
    }
    
    let markdown = '';
    
    if (turns.length > 0) {
        markdown += "# Recent dialogue\n\n";
        
        const recentTurns = turns.slice(-maxTurns);
        
        recentTurns.forEach((turn, index) => {
            markdown += `## Turn ${index + 1}\n\n`;
            
            if (turn.user) {
                markdown += `### User\n\n\`\`\`\n${turn.user.content}\n\`\`\`\n\n`;
            }
            
            if (turn.assistant) {
                markdown += `### Assistant\n\n\`\`\`\n${turn.assistant.content}\n\`\`\`\n\n`;
            }
        });
    }
    
    return markdown;
});

/**
 * サンクアクション
 */
export const sendMessage = (message, apiService) => async (dispatch, getState) => {
    const state = getState();
    
    dispatch(addMessage({
        role: 'user',
        content: message
    }));
    
    dispatch(setProcessing(true));
    
    try {
        const provider = state.chat.currentProvider;
        const model = state.chat.currentModel;
        
        const messages = selectMessagesForApi(state);
        
        const response = await apiService.sendChatMessage(provider, model, messages);
        
        dispatch(addMessage({
            role: 'assistant',
            content: response.content
        }));
    } catch (error) {
        console.error('Error sending message:', error);
        
        dispatch(addMessage({
            role: 'assistant',
            content: `Error: ${error.message}`
        }));
    } finally {
        dispatch(setProcessing(false));
    }
};

/**
 * ストレージから設定を読み込み、チャット状態を更新する
 * 
 * @param {Object} [storageService] - 使用するストレージサービス（オプション）
 * @returns {Function} - 設定を読み込むサンク関数
 */
export const loadSettingsFromStorage = (storageService = null) => async (dispatch) => {
    try {
        let result;
        
        if (storageService) {
            result = await storageService.get(['apiProvider', 'apiKeys', 'customSettings', 'systemPrompt']);
        } else {
            result = await new Promise((resolve, reject) => {
                if (globalThis.chrome?.storage?.local) {
                    globalThis.chrome.storage.local.get(['apiProvider', 'apiKeys', 'customSettings', 'systemPrompt'], (data) => {
                        if (globalThis.chrome.runtime.lastError) {
                            reject(new Error(globalThis.chrome.runtime.lastError.message));
                        } else {
                            resolve(data);
                        }
                    });
                } else {
                    resolve({
                        apiProvider: localStorage.getItem('apiProvider') ? JSON.parse(localStorage.getItem('apiProvider')) : 'openai',
                        apiKeys: localStorage.getItem('apiKeys') ? JSON.parse(localStorage.getItem('apiKeys')) : {},
                        customSettings: localStorage.getItem('customSettings') ? JSON.parse(localStorage.getItem('customSettings')) : {},
                        systemPrompt: localStorage.getItem('systemPrompt') ? JSON.parse(localStorage.getItem('systemPrompt')) : ''
                    });
                }
            });
        }

        if (result.apiProvider) {
            const customSettings = result.customSettings?.[result.apiProvider] || {};
            const model = customSettings.model || getDefaultModel(result.apiProvider);
            
            dispatch(setProviderAndModel({
                provider: result.apiProvider,
                model: model
            }));
        }

        const systemPrompt = result.systemPrompt || '';
        if (systemPrompt) {
            dispatch(setSystemPrompt(systemPrompt));
        }

    } catch (error) {
        console.error('Error loading settings from storage:', error);
    }
};

/**
 * 指定されたプロバイダーのデフォルトモデルを取得
 * 
 * @param {string} provider - APIプロバイダー
 * @returns {string} - プロバイダーのデフォルトモデル
 */
function getDefaultModel(provider) {
    const defaultModels = {
        'openai': 'gpt-4',
        'anthropic': 'claude-3-sonnet-20240229',
        'google': 'gemini-pro',
        'deepseek': 'deepseek-chat',
        'local': 'local-model'
    };
    
    return defaultModels[provider] || 'gpt-4';
}
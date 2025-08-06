/**
 * API設定の状態管理モジュール
 * アクションタイプ、アクションクリエーター、リデューサー、セレクター、サンクを含む
 */

import { createAction, createReducer, createSelector } from '../stateManagement.js';
import { apiConfigs, apiEndpoints } from '../models/ApiSettingsModel.js';
import { container } from '../architecture.js';

/**
 * アクションタイプ
 */
export const ActionTypes = {
  SET_ACTIVE_API: 'apiSettings/SET_ACTIVE_API',
  SET_API_KEY: 'apiSettings/SET_API_KEY',
  SET_SELECTED_MODEL: 'apiSettings/SET_SELECTED_MODEL',
  SET_MODELS_LIST: 'apiSettings/SET_MODELS_LIST',
  SET_CUSTOM_SETTINGS: 'apiSettings/SET_CUSTOM_SETTINGS',
  LOAD_SETTINGS: 'apiSettings/LOAD_SETTINGS',
  SAVE_SETTINGS: 'apiSettings/SAVE_SETTINGS',
  FETCH_MODELS_REQUEST: 'apiSettings/FETCH_MODELS_REQUEST',
  FETCH_MODELS_SUCCESS: 'apiSettings/FETCH_MODELS_SUCCESS',
  FETCH_MODELS_FAILURE: 'apiSettings/FETCH_MODELS_FAILURE'
};

/**
 * アクションクリエーター
 */
export const setActiveApi = createAction(ActionTypes.SET_ACTIVE_API);
export const setApiKey = createAction(ActionTypes.SET_API_KEY);
export const setSelectedModel = createAction(ActionTypes.SET_SELECTED_MODEL);
export const setModelsList = createAction(ActionTypes.SET_MODELS_LIST);
export const setCustomSettings = createAction(ActionTypes.SET_CUSTOM_SETTINGS);
export const loadSettings = createAction(ActionTypes.LOAD_SETTINGS);
export const saveSettings = createAction(ActionTypes.SAVE_SETTINGS);
export const fetchModelsRequest = createAction(ActionTypes.FETCH_MODELS_REQUEST);
export const fetchModelsSuccess = createAction(ActionTypes.FETCH_MODELS_SUCCESS);
export const fetchModelsFailure = createAction(ActionTypes.FETCH_MODELS_FAILURE);

/**
 * 初期状態
 */
const initialState = {
  activeApi: null,
  apiKeys: {},
  selectedModels: {},
  modelsList: {},
  customSettings: {
    compatible: { url: '', model: '' },
    local: { url: '' },
    bedrock: { region: '', secretKey: '', sessionToken: '', crossRegionInference: false },
    azureOpenai: { endpoint: '', deploymentName: '', apiVersion: '2024-02-15-preview' }
  },
  loading: {
    models: false
  },
  error: {
    models: null
  }
};

/**
 * リデューサー
 */
export const reducer = createReducer(initialState, {
  [ActionTypes.SET_ACTIVE_API]: (state, action) => ({
    ...state,
    activeApi: action.payload
  }),
  
  [ActionTypes.SET_API_KEY]: (state, action) => ({
    ...state,
    apiKeys: {
      ...state.apiKeys,
      [action.payload.provider]: action.payload.key
    }
  }),
  
  [ActionTypes.SET_SELECTED_MODEL]: (state, action) => ({
    ...state,
    selectedModels: {
      ...state.selectedModels,
      [action.payload.provider]: action.payload.model
    }
  }),
  
  [ActionTypes.SET_MODELS_LIST]: (state, action) => ({
    ...state,
    modelsList: {
      ...state.modelsList,
      [action.payload.provider]: action.payload.models
    }
  }),
  
  [ActionTypes.SET_CUSTOM_SETTINGS]: (state, action) => ({
    ...state,
    customSettings: {
      ...state.customSettings,
      [action.payload.provider]: {
        ...state.customSettings[action.payload.provider],
        ...action.payload.settings
      }
    }
  }),
  
  [ActionTypes.LOAD_SETTINGS]: (state, action) => ({
    ...state,
    ...action.payload
  }),
  
  [ActionTypes.FETCH_MODELS_REQUEST]: (state) => ({
    ...state,
    loading: {
      ...state.loading,
      models: true
    },
    error: {
      ...state.error,
      models: null
    }
  }),
  
  [ActionTypes.FETCH_MODELS_SUCCESS]: (state, action) => ({
    ...state,
    modelsList: {
      ...state.modelsList,
      [action.payload.provider]: action.payload.models
    },
    loading: {
      ...state.loading,
      models: false
    }
  }),
  
  [ActionTypes.FETCH_MODELS_FAILURE]: (state, action) => ({
    ...state,
    loading: {
      ...state.loading,
      models: false
    },
    error: {
      ...state.error,
      models: action.payload
    }
  })
});

/**
 * セレクター
 */
export const selectActiveApi = createSelector(state => state.apiSettings.activeApi);
export const selectApiKey = createSelector(state => provider => state.apiSettings.apiKeys[provider]);
export const selectSelectedModel = createSelector(state => provider => state.apiSettings.selectedModels[provider]);
export const selectModelsList = createSelector(state => provider => state.apiSettings.modelsList[provider] || []);
export const selectCustomSettings = createSelector(state => provider => state.apiSettings.customSettings[provider] || {});
export const selectIsLoadingModels = createSelector(state => state.apiSettings.loading.models);
export const selectModelsError = createSelector(state => state.apiSettings.error.models);

export const selectApiConfig = createSelector(state => {
  const activeApi = state.apiSettings.activeApi;
  if (!activeApi) return null;
  
  const config = {
    provider: activeApi,
    apiKey: state.apiSettings.apiKeys[activeApi],
    model: state.apiSettings.selectedModels[activeApi],
    customSettings: state.apiSettings.customSettings[activeApi] || {}
  };
  
  if (activeApi === 'compatible' || activeApi === 'local') {
    config.url = config.customSettings.url;
    if (activeApi === 'compatible') {
      config.model = config.customSettings.model;
    }
  } else if (activeApi === 'bedrock') {
    config.model = config.customSettings.model;
  }
  
  return config;
});

/**
 * サンクアクション
 */
export const loadSettingsFromStorage = () => async (dispatch) => {
  try {
    const storage = container.get('storage');
    const settings = await storage.get([
      'apiProvider',
      'apiKeys',
      'selectedModels',
      'customSettings'
    ]);
    
    dispatch(loadSettings({
      activeApi: settings.apiProvider,
      apiKeys: settings.apiKeys || {},
      selectedModels: settings.selectedModels || {},
      customSettings: {
        ...initialState.customSettings,
        ...(settings.customSettings || {})
      }
    }));
  } catch (error) {
    console.error('Error loading API settings:', error);
  }
};

export const saveSettingsToStorage = () => async (dispatch, getState) => {
  try {
    const storage = container.get('storage');
    const state = getState().apiSettings;
    
    await storage.set({
      apiProvider: state.activeApi,
      apiKeys: state.apiKeys,
      selectedModels: state.selectedModels,
      customSettings: state.customSettings
    });
    
    dispatch(saveSettings());
  } catch (error) {
    console.error('Error saving API settings:', error);
  }
};

export const fetchModels = (provider) => async (dispatch, getState) => {
  const state = getState();
  const apiKey = state.apiSettings.apiKeys[provider];
  const customSettings = state.apiSettings.customSettings[provider] || {};
  
  if (!apiKey) {
    dispatch(fetchModelsFailure('API key is required'));
    return;
  }
  
  const apiEndpoint = apiEndpoints[provider];
  if (!apiEndpoint) {
    dispatch(fetchModelsFailure(`Unsupported API provider: ${provider}`));
    return;
  }
  
  dispatch(fetchModelsRequest());
  
  try {
    let url = apiEndpoint.modelsUrl;
    if (typeof url === 'function') {
      url = url(customSettings);
    } else if (provider === 'compatible' && customSettings.url) {
      url = `${customSettings.url}/v1/models`;
    }
    
    let headers;
    if (typeof apiEndpoint.headers === 'function') {
      headers = await apiEndpoint.headers(apiKey, customSettings);
    } else {
      headers = apiEndpoint.headers(apiKey);
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const models = apiEndpoint.processResponse(data);
    
    dispatch(fetchModelsSuccess({
      provider,
      models
    }));
    
    const selectedModel = state.apiSettings.selectedModels[provider];
    if (!selectedModel && models.length > 0) {
      dispatch(setSelectedModel({
        provider,
        model: models[0].id
      }));
    }
  } catch (error) {
    dispatch(fetchModelsFailure(error.message));
  }
};

export const validateApiConfig = (provider) => (dispatch, getState) => {
  const state = getState().apiSettings;
  const config = apiConfigs[provider];
  if (!config) return false;
  
  if (!state.apiKeys[provider]) return false;
  
  if (config.requiresAdditionalConfig) {
    const settings = state.customSettings[provider] || {};
    
    for (const [fieldName, fieldConfig] of Object.entries(config.additionalFields)) {
      if (fieldConfig.required) {
        if (fieldConfig.type === 'checkbox') {
          if (settings[fieldName] === undefined) return false;
        } else {
          if (!settings[fieldName]) return false;
        }
      }
    }
  }
  
  if (config.hasModels && !state.selectedModels[provider]) {
    return false;
  }
  
  return true;
};

export default reducer;
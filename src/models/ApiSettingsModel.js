import { Model } from '../architecture.js';

/**
 * API設定の定義
 */
export const apiConfigs = {
  openai: {
    name: 'OpenAI',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
    hasModels: true
  },
  anthropic: {
    name: 'Anthropic',
    keyPrefix: 'sk-ant-api',
    keyPlaceholder: 'sk-ant-api01-xxxxxxxxxxxxxxxxxxxx',
    hasModels: true
  },
  gemini: {
    name: 'Google Gemini',
    keyPrefix: 'AIza',
    keyPlaceholder: 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX',
    hasModels: true
  },
  deepseek: {
    name: 'Deepseek',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    hasModels: true
  },
  compatible: {
    name: 'OpenAI Compatible',
    keyPrefix: '',
    keyPlaceholder: 'EMPTY',
    customUrl: true,
    hasModels: true
  },
  azureOpenai: {
    name: 'Azure OpenAI',
    keyPrefix: '',
    keyPlaceholder: 'Azure API Key',
    hasModels: false,
    requiresAdditionalConfig: true,
    additionalFields: {
      endpoint: {
        type: 'text',
        placeholder: 'https://your-resource.openai.azure.com/',
        required: true,
        label: 'Endpoint'
      },
      deploymentName: {
        type: 'text',
        placeholder: 'Deployment Name',
        required: true,
        label: 'Deployment Name'
      },
      apiVersion: {
        type: 'text',
        placeholder: '2024-02-15-preview',
        defaultValue: '2024-02-15-preview',
        required: true,
        label: 'API Version'
      }
    }
  },
  local: {
    name: 'Local API',
    keyPrefix: '',
    keyPlaceholder: 'xxxxxxxxxxxxx',
    customUrl: true
  }
};

/**
 * APIエンドポイントの定義
 */
export const apiEndpoints = {
  openai: {
    modelsUrl: 'https://api.openai.com/v1/models',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    processResponse: (data) => data.data.map(model => ({
      id: model.id,
      name: model.id
    }))
  },
  anthropic: {
    modelsUrl: 'https://api.anthropic.com/v1/models',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }),
    processResponse: (data) => {
      if (Array.isArray(data)) {
        return data.map(model => ({
          id: model.id,
          name: model.id
        }));
      }
      if (data && Array.isArray(data.models)) {
        return data.models.map(model => ({
          id: model.id,
          name: model.id
        }));
      }
      if (data && Array.isArray(data.data)) {
        return data.data.map(model => ({
          id: model.id,
          name: model.id
        }));
      }
      return [];
    }
  },
  gemini: {
    modelsUrl: 'https://generativelanguage.googleapis.com/v1/models',
    headers: (key) => ({
      'x-goog-api-key': key,
      'Content-Type': 'application/json'
    }),
    processResponse: (data) =>
      data.models.map(model => ({
        id: model.name,
        name: model.displayName
      }))
  },
  deepseek: {
    modelsUrl: 'https://api.deepseek.com/v1/models',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    processResponse: (data) =>
      data.data.map(model => ({
        id: model.id,
        name: model.id
      }))
  },
  compatible: {
    modelsUrl: '', // Dynamically set based on custom URL
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    processResponse: (data) => {
      return data.data.map(model => ({
        id: model.id.replace('models/', ''),
        name: model.id.replace('models/', '')
      }));
    }
  },
  bedrock: {
    modelsUrl: (config) => 
      `https://bedrock.${config.region}.amazonaws.com/foundation-models`,
    headers: async (key, config) => {
      const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
      const date = timestamp.slice(0, 8);

      const credentials = {
        accessKey: key,
        secretKey: config.secretKey,
        sessionToken: config.sessionToken
      };

      const signedHeaders = {
        'Authorization': `AWS4-HMAC-SHA256 Credential=${credentials.accessKey}/${date}/${config.region}/bedrock/aws4_request`,
        'X-Amz-Date': timestamp
      };

      if (credentials.sessionToken) {
        signedHeaders['X-Amz-Security-Token'] = credentials.sessionToken;
      }

      return {
        ...signedHeaders,
        'Content-Type': 'application/json'
      };
    },
    processResponse: (data) => data.models.map(model => ({
      id: model.modelId,
      name: `${model.modelName} (${model.provider})`
    }))
  },
  azureOpenai: {
    modelsUrl: (config) => 
      `${config.endpoint}/openai/deployments?api-version=${config.apiVersion}`,
    headers: (key) => ({
      'api-key': key,
      'Content-Type': 'application/json'
    }),
    processResponse: (data) => data.data.map(model => ({
      id: model.id,
      name: `${model.id} (${model.model})`
    }))
  }
};

/**
 * API設定データモデルクラス
 * 
 * API設定のデータモデルを表します。
 * APIプロバイダー、キー、モデル、カスタム設定を管理します。
 */
export class ApiSettingsModel extends Model {
  /**
   * コンストラクタ
   * 
   * @param {Object} data - モデルの初期データ
   */
  constructor(data = {}) {
    const defaultData = {
      activeApi: null,
      apiKeys: {},
      selectedModels: {},
      modelsList: {},
      systemPrompts: {},
      customSettings: {
        compatible: { url: '', model: '' },
        local: { url: '' },
        bedrock: { region: '', secretKey: '', sessionToken: '', crossRegionInference: false },
        azureOpenai: { endpoint: '', deploymentName: '', apiVersion: '' }
      },
      ...data
    };
    
    super(defaultData);
  }
  
  /**
   * アクティブなAPIプロバイダーを設定
   * 
   * @param {string} provider - APIプロバイダーID
   * @returns {ApiSettingsModel} - チェーンメソッド用のモデルインスタンス
   */
  setActiveApi(provider) {
    this.set('activeApi', provider);
    return this;
  }
  
  /**
   * APIキーを設定
   * 
   * @param {string} provider - APIプロバイダーID
   * @param {string} key - APIキー
   * @returns {ApiSettingsModel} - チェーンメソッド用のモデルインスタンス
   */
  setApiKey(provider, key) {
    const apiKeys = { ...this.get('apiKeys') };
    apiKeys[provider] = key;
    this.set('apiKeys', apiKeys);
    return this;
  }
  
  /**
   * APIキーを削除
   * 
   * @param {string} provider - APIプロバイダーID
   * @returns {ApiSettingsModel} - チェーンメソッド用のモデルインスタンス
   */
  deleteApiKey(provider) {
    const apiKeys = { ...this.get('apiKeys') };
    delete apiKeys[provider];
    this.set('apiKeys', apiKeys);
    
    // Also clear the selected model for this provider
    const selectedModels = { ...this.get('selectedModels') };
    delete selectedModels[provider];
    this.set('selectedModels', selectedModels);
    
    // Clear models list for this provider
    const modelsList = { ...this.get('modelsList') };
    delete modelsList[provider];
    this.set('modelsList', modelsList);
    
    return this;
  }
  
  /**
   * 選択されたモデルを設定
   * 
   * @param {string} provider - APIプロバイダーID
   * @param {string} model - モデルID
   * @returns {ApiSettingsModel} - チェーンメソッド用のモデルインスタンス
   */
  setSelectedModel(provider, model) {
    const selectedModels = { ...this.get('selectedModels') };
    selectedModels[provider] = model;
    this.set('selectedModels', selectedModels);
    return this;
  }
  
  /**
   * プロバイダーのモデルリストを設定
   * 
   * @param {string} provider - APIプロバイダーID
   * @param {Array} models - モデルリスト
   * @returns {ApiSettingsModel} - チェーンメソッド用のモデルインスタンス
   */
  setModelsList(provider, models) {
    const modelsList = { ...this.get('modelsList') };
    modelsList[provider] = models;
    this.set('modelsList', modelsList);
    return this;
  }
  
  /**
   * プロバイダーのカスタム設定を設定
   * 
   * @param {string} provider - APIプロバイダーID
   * @param {Object} settings - カスタム設定
   * @returns {ApiSettingsModel} - チェーンメソッド用のモデルインスタンス
   */
  setCustomSettings(provider, settings) {
    const customSettings = { ...this.get('customSettings') };
    customSettings[provider] = { ...customSettings[provider], ...settings };
    this.set('customSettings', customSettings);
    return this;
  }
  
  /**
   * アクティブなAPIプロバイダーを取得
   * 
   * @returns {string} - アクティブなAPIプロバイダーID
   */
  getActiveApi() {
    return this.get('activeApi');
  }
  
  /**
   * APIキーを取得
   * 
   * @param {string} provider - APIプロバイダーID
   * @returns {string} - APIキー
   */
  getApiKey(provider) {
    return this.get('apiKeys')[provider];
  }
  
  /**
   * 選択されたモデルを取得
   * 
   * @param {string} provider - APIプロバイダーID
   * @returns {string} - 選択されたモデルID
   */
  getSelectedModel(provider) {
    return this.get('selectedModels')[provider];
  }
  
  /**
   * プロバイダーのモデルリストを取得
   * 
   * @param {string} provider - APIプロバイダーID
   * @returns {Array} - モデルリスト
   */
  getModelsList(provider) {
    return this.get('modelsList')[provider];
  }
  
  /**
   * プロバイダーのカスタム設定を取得
   * 
   * @param {string} provider - APIプロバイダーID
   * @returns {Object} - カスタム設定
   */
  getCustomSettings(provider) {
    return this.get('customSettings')[provider];
  }
  
  /**
   * システムプロンプトを設定
   * 
   * @param {string} provider - APIプロバイダーID
   * @param {string} prompt - システムプロンプト
   * @returns {ApiSettingsModel} - チェーンメソッド用のモデルインスタンス
   */
  setSystemPrompt(provider, prompt) {
    const systemPrompts = { ...this.get('systemPrompts') };
    systemPrompts[provider] = prompt;
    this.set('systemPrompts', systemPrompts);
    return this;
  }
  
  /**
   * システムプロンプトを取得
   * 
   * @param {string} provider - APIプロバイダーID
   * @returns {string} - システムプロンプト
   */
  getSystemPrompt(provider) {
    return this.get('systemPrompts')[provider] || '';
  }
  
  /**
   * API設定を検証
   * 
   * @param {string} provider - APIプロバイダーID
   * @returns {boolean} - 設定が有効かどうか
   */
  validateApiConfig(provider) {
    const config = apiConfigs[provider];
    if (!config) return false;
    
    if (!this.getApiKey(provider)) return false;
    
    if (config.requiresAdditionalConfig) {
      const settings = this.getCustomSettings(provider);
      
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
    
    if (config.hasModels && !this.getSelectedModel(provider)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * ストレージから設定を読み込み
   * 
   * @param {Object} storage - ストレージサービス
   * @returns {Promise<ApiSettingsModel>} - チェーンメソッド用のモデルインスタンス
   */
  async loadFromStorage(storage) {
    try {
      const settings = await storage.get([
        'apiProvider',
        'apiKeys',
        'selectedModels',
        'customSettings',
        'systemPrompts'
      ]);
      
      if (settings.apiProvider) this.set('activeApi', settings.apiProvider);
      if (settings.apiKeys) this.set('apiKeys', settings.apiKeys);
      if (settings.selectedModels) this.set('selectedModels', settings.selectedModels);
      if (settings.customSettings) this.set('customSettings', settings.customSettings);
      if (settings.systemPrompts) this.set('systemPrompts', settings.systemPrompts);
    } catch (error) {
      console.error('Error loading API settings:', error);
    }
    
    return this;
  }
  
  /**
   * ストレージに設定を保存
   * 
   * @param {Object} storage - ストレージサービス
   * @returns {Promise<ApiSettingsModel>} - チェーンメソッド用のモデルインスタンス
   */
  async saveToStorage(storage) {
    try {
      await storage.set({
        apiProvider: this.get('activeApi'),
        apiKeys: this.get('apiKeys'),
        selectedModels: this.get('selectedModels'),
        customSettings: this.get('customSettings'),
        systemPrompts: this.get('systemPrompts')
      });
    } catch (error) {
      console.error('Error saving API settings:', error);
    }
    
    return this;
  }
  
  /**
   * プロバイダーのAPI設定を取得
   * 
   * @param {string} provider - APIプロバイダーID
   * @returns {Object} - API設定
   */
  getApiConfig(provider) {
    const activeProvider = provider || this.getActiveApi();
    if (!activeProvider) return null;
    
    const config = {
      provider: activeProvider,
      apiKey: this.getApiKey(activeProvider),
      model: this.getSelectedModel(activeProvider),
      customSettings: this.getCustomSettings(activeProvider),
      systemPrompt: this.getSystemPrompt(activeProvider)
    };
    
    if (activeProvider === 'compatible' || activeProvider === 'local') {
      const customSettings = this.getCustomSettings(activeProvider);
      config.url = customSettings.url;
      if (activeProvider === 'compatible') {
        config.model = customSettings.model;
      }
    } else if (activeProvider === 'bedrock') {
      const customSettings = this.getCustomSettings(activeProvider);
      config.model = customSettings.model;
    }
    
    return config;
  }
}

/**
 * ApiSettingsModelインスタンスを作成するファクトリ関数
 * 
 * @param {Object} container - 依存性注入コンテナ
 * @returns {ApiSettingsModel} - ApiSettingsModelインスタンス
 */
export const createApiSettingsModel = (container) => {
  const storage = container.get('storage');
  const model = new ApiSettingsModel();
  
  model.loadFromStorage(storage);
  
  return model;
};
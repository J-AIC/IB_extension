//=================================================
// api_settings.js
//=================================================

//-----------------------------
// API設定オブジェクト
//-----------------------------
const apiConfigs = {
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
    customUrl: true,    // 後でURL入力欄を出すためのフラグ
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

//-----------------------------
// 各APIのエンドポイント設定
//-----------------------------
const apiEndpoints = {
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
    console.log('Raw API Response:', JSON.stringify(data, null, 2));

    // dataが配列の場合
    if (Array.isArray(data)) {
      return data.map(model => ({
        id: model.id,
        name: model.id
      }));
    }
    // data.modelsが配列の場合
    if (data && Array.isArray(data.models)) {
      return data.models.map(model => ({
        id: model.id,
        name: model.id
      }));
    }
    // data.dataが配列の場合
    if (data && Array.isArray(data.data)) {
      return data.data.map(model => ({
        id: model.id,
        name: model.id
      }));
    }

    console.error('No valid models found in API response');
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
  modelsUrl: '', // 実際には動的に設定
  headers: (key) => ({
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  }),
  processResponse: (data) => {
    // "models/" プレフィックスを削除
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

    const signedHeaders = await createAWSSignature({
      service: 'bedrock',
      region: config.region,
      credentials: credentials,
      timestamp: timestamp,
      date: date
    });

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

//=================================================
// AWS署名ユーティリティ
//=================================================
async function createAWSSignature(params) {
const { service, region, credentials, timestamp, date } = params;

// AWS Signature Version 4の実装（簡易版）
const algorithm = 'AWS4-HMAC-SHA256';
const scope = `${date}/${region}/${service}/aws4_request`;

const signedHeaders = {
  'Authorization': `${algorithm} Credential=${credentials.accessKey}/${scope}`,
  'X-Amz-Date': timestamp
};

if (credentials.sessionToken) {
  signedHeaders['X-Amz-Security-Token'] = credentials.sessionToken;
}

return signedHeaders;
}

//=================================================
// ApiManagerクラス
//=================================================
class ApiManager {
constructor() {
  // メンバ変数
  this.activeApi = null;
  this.apiKeys = {};
  this.selectedModels = {};
  this.modelsList = {};
  this.customSettings = {
    compatible: { url: '', model: '' },
    local: { url: '' },
    bedrock: { region: '', secretKey: '', sessionToken: '', crossRegionInference: false },
    azureOpenai: { endpoint: '', deploymentName: '', apiVersion: '' }
  };

  // 設定をロード & UI 初期化
  this.loadStoredSettings().then(() => {
    this.initializeCards(); // カード生成
    this.initializeUIWithStoredSettings(); // 既存設定を画面に反映
  });
}

//-------------------------------------
// 設定を保存
//-------------------------------------
async saveSettings() {
  const settings = {
    apiMode: 'external',
    apiProvider: this.activeApi,
    apiKeys: this.apiKeys,
    selectedModels: this.selectedModels,
    customSettings: this.customSettings
  };

  // Chrome拡張の場合
  if (typeof chrome !== 'undefined' && chrome.storage) {
    await chrome.storage.local.set(settings);
  } else {
    // 通常のローカルストレージ
    Object.entries(settings).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
  }
}

//-------------------------------------
// 設定をロード
//-------------------------------------
async loadStoredSettings() {
  let settings;

  // Chrome拡張の場合
  if (typeof chrome !== 'undefined' && chrome.storage) {
    settings = await new Promise(resolve => {
      chrome.storage.local.get(
        ['apiProvider', 'apiKeys', 'selectedModels', 'customSettings'],
        resolve
      );
    });
  } else {
    // 通常のローカルストレージ
    try {
      settings = {
        apiProvider: JSON.parse(localStorage.getItem('apiProvider')),
        apiKeys: JSON.parse(localStorage.getItem('apiKeys')),
        selectedModels: JSON.parse(localStorage.getItem('selectedModels')),
        customSettings: JSON.parse(localStorage.getItem('customSettings'))
      };
    } catch (error) {
      console.error('Error loading settings:', error);
      settings = {};
    }
  }

  if (settings.apiProvider) this.activeApi = settings.apiProvider;
  if (settings.apiKeys) this.apiKeys = settings.apiKeys;
  if (settings.selectedModels) this.selectedModels = settings.selectedModels;
  if (settings.customSettings) this.customSettings = settings.customSettings;
}

//-------------------------------------
// 既存設定をUIに反映
//-------------------------------------
initializeUIWithStoredSettings() {
  // トグルの状態を設定
  if (this.activeApi) {
    const toggle = document.querySelector(`#${this.activeApi}-toggle`);
    if (toggle) toggle.checked = true;
  }

  // 各APIの保存された情報を反映
  Object.entries(apiConfigs).forEach(([apiId]) => {
    const card = document.querySelector(`#${apiId}-card`);
    if (!card) return;

    // APIキーの表示を更新
    const keyDisplay = card.querySelector('.key-display');
    if (keyDisplay) {
      if (this.apiKeys[apiId]) {
        keyDisplay.textContent = '*'.repeat(20);
      } else {
        keyDisplay.textContent = chrome.i18n.getMessage('notSet');
      }
    }

    // モデル情報の表示を更新
    if (this.selectedModels[apiId]) {
      const modelNameElement = card.querySelector('.model-name');
      if (modelNameElement) {
        if (this.modelsList[apiId]) {
          const model = this.modelsList[apiId].find(
            m => m.id === this.selectedModels[apiId]
          );
          modelNameElement.textContent = model
            ? `(${model.name})`
            : `(${this.selectedModels[apiId]})`;
        } else {
          modelNameElement.textContent = `(${this.selectedModels[apiId]})`;
        }
      }
    }
  });
}

//-------------------------------------
// カードを生成
//-------------------------------------
initializeCards() {
  const container = document.querySelector('.row');
  if (!container) return;

  Object.entries(apiConfigs).forEach(([apiId, config]) => {
    const card = this.createApiCard(apiId, config);
    container.appendChild(card);
  });
}

//-------------------------------------
// 各APIカードのDOM要素を生成
//-------------------------------------
createApiCard(apiId, config) {
  const template = document.getElementById('apiCardTemplate');
  const card = template.content.cloneNode(true);
  const cardElement = card.querySelector('.col-12');

  // カードにIDを付与
  cardElement.id = `${apiId}-card`;

  // カードタイトル
  cardElement.querySelector('h3').textContent = config.name;

  // APIキー表示
  const keyDisplay = cardElement.querySelector('.key-display');
  if (this.apiKeys[apiId]) {
    keyDisplay.textContent = '*'.repeat(20);
  } else {
    keyDisplay.textContent = chrome.i18n.getMessage('notSet');
  }

  // フォーム関連要素
  const form = cardElement.querySelector('form');
  const keyInput = form.querySelector('.key-input');
  const viewMode = cardElement.querySelector('.view-mode');
  const editMode = cardElement.querySelector('.edit-mode');

  keyInput.placeholder = config.keyPlaceholder;

  // 「表示／非表示」ボタン
  const toggleVisibilityBtn = cardElement.querySelector('.toggle-visibility');
  toggleVisibilityBtn.addEventListener('click', () => {
    const icon = toggleVisibilityBtn.querySelector('i');
    if (icon.classList.contains('bi-eye')) {
      keyDisplay.textContent = this.apiKeys[apiId] || chrome.i18n.getMessage('notSet');
      icon.classList.replace('bi-eye', 'bi-eye-slash');
    } else {
      keyDisplay.textContent = this.apiKeys[apiId]
        ? '*'.repeat(20)
        : chrome.i18n.getMessage('notSet');
      icon.classList.replace('bi-eye-slash', 'bi-eye');
    }
  });

  // 「編集開始／キャンセル」ボタン
  const toggleEditBtn = cardElement.querySelector('.toggle-edit');
  const cancelEditBtn = cardElement.querySelector('.cancel-edit');

  const toggleEdit = () => {
    viewMode.classList.toggle('d-none');
    editMode.classList.toggle('d-none');
    if (!editMode.classList.contains('d-none')) {
      // 編集開始時、入力フォームに既存の値をセット
      keyInput.value = this.apiKeys[apiId] || '';
      if (config.customUrl) {
        const urlInput = cardElement.querySelector('.url-input');
        urlInput.value = this.customSettings[apiId]?.url || '';
      }
      if (config.customModel) {
        const modelInput = cardElement.querySelector('.model-input');
        modelInput.value = this.customSettings[apiId]?.model || '';
      }
    }
  };

  toggleEditBtn.addEventListener('click', toggleEdit);
  cancelEditBtn.addEventListener('click', toggleEdit);

  // カスタムURL／モデル入力欄を表示
  if (config.customUrl) {
    const urlContainer = cardElement.querySelector('.custom-url-container');
    urlContainer.classList.remove('d-none');
  }
  if (config.customModel) {
    const modelContainer = cardElement.querySelector('.custom-model-container');
    modelContainer.classList.remove('d-none');
  }

  // ★★★ 追加設定フィールドの生成と表示 ★★★
  if (config.requiresAdditionalConfig && config.additionalFields) {
    const additionalFieldsContainer = document.createElement('div');
    additionalFieldsContainer.className = 'additional-fields mb-2';

    Object.entries(config.additionalFields).forEach(([fieldName, fieldConfig]) => {
      const fieldWrapper = document.createElement('div');
      fieldWrapper.className = 'mb-2';

      const label = document.createElement('label');
      label.className = 'form-label small fw-medium';
      label.textContent = fieldConfig.label || fieldName;

      let input;
      switch (fieldConfig.type) {
        case 'select':
          input = document.createElement('select');
          input.className = 'form-select form-select-sm';
          fieldConfig.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            input.appendChild(optionElement);
          });
          break;
        case 'checkbox':
          input = document.createElement('input');
          input.type = 'checkbox';
          input.className = 'form-check-input';
          // checkbox の場合は label に .form-check-label を追加
          label.className += ' form-check-label';
          break;
        case 'password':
          input = document.createElement('input');
          input.type = 'password';
          input.className = 'form-control form-control-sm';
          break;
        default:
          input = document.createElement('input');
          input.type = 'text';
          input.className = 'form-control form-control-sm';
      }

      input.placeholder = fieldConfig.placeholder || '';
      input.dataset.field = fieldName;

      // 既存の値があれば設定
      if (this.customSettings[apiId]?.[fieldName] !== undefined) {
        if (fieldConfig.type === 'checkbox') {
          input.checked = this.customSettings[apiId][fieldName];
        } else {
          input.value = this.customSettings[apiId][fieldName];
        }
      // デフォルト値がある場合の初期設定
      } else if (fieldConfig.defaultValue) {
        if (fieldConfig.type === 'checkbox') {
          input.checked = fieldConfig.defaultValue;
        } else {
          input.value = fieldConfig.defaultValue;
        }
      }

      // ラベルと入力欄を配置
      fieldWrapper.appendChild(label);

      // checkbox の場合は label 内に input を入れるパターンもありますが、
      // ここでは既存コードの流れにあわせて直下に追加しています
      fieldWrapper.appendChild(input);
      additionalFieldsContainer.appendChild(fieldWrapper);
    });

    form.insertBefore(additionalFieldsContainer, form.querySelector('.text-end'));
  }
  // ★★★ 追加設定フィールドの生成と表示 ここまで ★★★

  // フォーム送信時の処理
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newKey = keyInput.value.trim();

    // キーのプレフィックスチェック
    if (config.keyPrefix && !newKey.startsWith(config.keyPrefix)) {
      const feedback = cardElement.querySelector('.invalid-feedback');
      feedback.textContent = chrome.i18n.getMessage(
        'invalidApiKeyPrefix',
        [config.keyPrefix]
      );
      keyInput.classList.add('is-invalid');
      return;
    }
    keyInput.classList.remove('is-invalid');

    // APIキー保存
    this.apiKeys[apiId] = newKey;

    // カスタム設定の保存
    if (config.customUrl) {
      const urlInput = cardElement.querySelector('.url-input');
      this.customSettings[apiId].url = urlInput.value.trim();
    }
    if (config.customModel) {
      const modelInput = cardElement.querySelector('.model-input');
      this.customSettings[apiId].model = modelInput.value.trim();
    }

    // ★★★ 追加設定の保存ロジック ★★★
    if (config.requiresAdditionalConfig && config.additionalFields) {
      const additionalFields = form.querySelectorAll('.additional-fields input, .additional-fields select');
      additionalFields.forEach(field => {
        const fieldName = field.dataset.field;
        this.customSettings[apiId] = this.customSettings[apiId] || {};
        // checkboxならchecked、それ以外ならvalue
        this.customSettings[apiId][fieldName] = (field.type === 'checkbox') 
          ? field.checked 
          : field.value;
      });
    }
    // ★★★ 追加設定の保存ロジック ここまで ★★★

    // 保存
    await this.saveSettings();

    // UI更新
    keyDisplay.textContent = '*'.repeat(20);
    viewMode.classList.remove('d-none');
    editMode.classList.add('d-none');
  });

  // モデル選択が必要な場合のUI設定
  if (config.hasModels) {
    const selectorContainer = cardElement.querySelector('.model-selector-container');
    selectorContainer.classList.remove('d-none');

    const modelSelector = cardElement.querySelector('.model-selector');
    const modelsList = cardElement.querySelector('.models-list');

    // 既存選択モデルを表示
    if (this.selectedModels[apiId]) {
      const modelNameElement = cardElement.querySelector('.model-name');
      if (this.modelsList[apiId]) {
        const model = this.modelsList[apiId].find(
          m => m.id === this.selectedModels[apiId]
        );
        modelNameElement.textContent = model
          ? `(${model.name})`
          : `(${this.selectedModels[apiId]})`;
      } else {
        modelNameElement.textContent = `(${this.selectedModels[apiId]})`;
      }
    }

    // モデルリスト開閉＆取得
    modelSelector.addEventListener('click', async () => {
      modelSelector.classList.toggle('open');
      modelsList.classList.toggle('d-none');

      // 未取得かつキーがある場合のみ取得
      if (!this.modelsList[apiId] && this.apiKeys[apiId]) {
        await this.fetchModels(apiId, cardElement);
      }
    });
  }

  // APIトグル (ON/OFF)
  const apiToggle = cardElement.querySelector('.api-toggle');
  apiToggle.id = `${apiId}-toggle`;

  // ロード済みの設定を反映
  if (this.activeApi === apiId) {
    apiToggle.checked = true;
  }

  apiToggle.addEventListener('change', async () => {
    if (apiToggle.checked) {
      if (this.validateApiConfig(apiId)) {
        this.activeApi = apiId;
        // 他のトグルをオフ
        document.querySelectorAll('.api-toggle').forEach(toggle => {
          if (toggle !== apiToggle) toggle.checked = false;
        });
        await this.saveSettings();
      } else {
        apiToggle.checked = false;
        alert(chrome.i18n.getMessage('incompleteSettings', [config.name]));
      }
    } else {
      // トグルをOFFにした時に自分がアクティブだったら解除
      if (this.activeApi === apiId) {
        this.activeApi = null;
        await this.saveSettings();
      }
    }
  });

  return cardElement;
}

//-------------------------------------
// モデル一覧を取得してUIに表示
//-------------------------------------
async fetchModels(apiId, cardElement) {
  const endpoint = apiEndpoints[apiId];
  if (!endpoint) return;

  const loadingState = cardElement.querySelector('.loading-state');
  const errorState = cardElement.querySelector('.error-state');
  const emptyState = cardElement.querySelector('.empty-state');
  const modelsContainer = cardElement.querySelector('.models-container');

  loadingState.classList.remove('d-none');
  errorState.classList.add('d-none');
  emptyState.classList.add('d-none');
  modelsContainer.innerHTML = '';

  try {
    // Compatible API の場合はURLを動的に構築
    let modelsUrl = endpoint.modelsUrl;
    if (apiId === 'compatible') {
      const baseUrl = this.customSettings.compatible.url.trim();
      modelsUrl = baseUrl.endsWith('/')
        ? `${baseUrl}v1/models`
        : `${baseUrl}/v1/models`;
    }

    const response = await fetch(modelsUrl, {
      headers: endpoint.headers(this.apiKeys[apiId])
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const models = endpoint.processResponse(data);
    this.modelsList[apiId] = models;

    if (models.length === 0) {
      emptyState.classList.remove('d-none');
    } else {
      models.forEach(model => {
        const label = document.createElement('label');
        label.className =
          'form-check d-flex align-items-center gap-2 py-1 px-2 rounded cursor-pointer hover-bg-light';
        label.innerHTML = `
          <input type="radio" class="form-check-input" name="model-${apiId}" value="${model.id}">
          <span class="small model-name-text">${model.name}</span>
        `;

        const input = label.querySelector('input');
        input.checked = this.selectedModels[apiId] === model.id;
        input.addEventListener('change', async () => {
          this.selectedModels[apiId] = model.id;
          cardElement.querySelector('.model-name').textContent = `(${model.name})`;
          await this.saveSettings();
        });

        modelsContainer.appendChild(label);
      });
    }
  } catch (err) {
    console.error('Error fetching models:', err);
    errorState.classList.remove('d-none');
    errorState.querySelector('.error-message').textContent = err.message;
  } finally {
    loadingState.classList.add('d-none');
  }
}

//-------------------------------------
// API設定が有効かどうかをチェック
//-------------------------------------
validateApiConfig(apiId) {
  const config = apiConfigs[apiId];
  if (!config) return false;

  // 基本的なAPIキーチェック
  if (!this.apiKeys[apiId]) return false;

  // 追加設定が必要なAPIの検証
  if (config.requiresAdditionalConfig) {
    const settings = this.customSettings[apiId];
    
    // 必須フィールドの検証
    for (const [fieldName, fieldConfig] of Object.entries(config.additionalFields)) {
      if (fieldConfig.required && !settings?.[fieldName]) {
        // checkbox のように false が有効値になる場合もあるので、
        // そもそも "required" なら値の有無だけチェック
        if (fieldConfig.type === 'checkbox') {
          // checkboxの場合、「未定義」ならNG、定義済ならOK
          if (settings[fieldName] === undefined) return false;
        } else {
          // textやselectなどで空文字はNGとするなら、値が空でないかどうかもチェック
          if (!settings[fieldName]) return false;
        }
      }
    }
  }

  // モデル選択の検証
  if (config.hasModels && !this.selectedModels[apiId]) {
    return false;
  }

  return true;
}
}

//=================================================
// メッセージ（ポストメッセージ）ハンドリング
//=================================================
window.addEventListener('message', async (event) => {
  if (event.data.type === 'GET_API_CONFIG') {
    const manager = window.apiManager;
    const provider = manager.activeApi;
    const config = {
      provider: provider,
      apiKey: manager.apiKeys[provider],
      model: manager.selectedModels[provider],
      customSettings: manager.customSettings[provider]
    };

    // Compatible, Localは追加情報を付加
    if (provider === 'compatible' || provider === 'local') {
      const customSettings = manager.customSettings[provider];
      config.url = customSettings.url;
      if (provider === 'compatible') {
        config.model = customSettings.model;
      }
     // bedrock用にモデルを手動入力した場合も同様に反映する
    } else if (provider === 'bedrock') {
      const customSettings = manager.customSettings[provider];
      // カード編集フォームで設定した手動モデル
      config.model = customSettings.model;
    }

    event.source.postMessage({ type: 'API_CONFIG', config }, '*');
  }
});

//=================================================
// DOM読み込み後の初期化
//=================================================
document.addEventListener('DOMContentLoaded', () => {
// API管理クラスを生成
window.apiManager = new ApiManager();

// お問い合わせボタン
const contactButton = document.getElementById('contactButton');
if (contactButton) {
  contactButton.addEventListener('click', () => {
    // お問い合わせフォームのURLを開く
    window.open('contact.html', '_blank');
  });
}
});
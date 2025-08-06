/**
 * API設定ビュークラス
 * API設定カードの描画とユーザーインタラクションを処理する
 */

import { View } from '../architecture.js';
import { apiConfigs } from '../models/ApiSettingsModel.js';

/**
 * API設定ビュークラス
 * API設定用のビューを表現し、API設定カードの描画とユーザーインタラクションを処理する
 */
export class ApiSettingsView extends View {
  /**
   * コンストラクタ
   * 
   * @param {HTMLElement|string} element - ビュー用のDOM要素またはセレクタ
   * @param {Object} model - API設定モデル
   * @param {Object} [options={}] - ビューの追加オプション
   */
  constructor(element, model, options = {}) {
    super(element, model);
    
    this.options = {
      cardContainerSelector: '.row',
      cardTemplateId: 'apiCardTemplate',
      ...options
    };
    
    this.cardContainer = this.element.querySelector(this.options.cardContainerSelector);
    this.cardTemplate = document.getElementById(this.options.cardTemplateId);
    
    this.initialize();
  }
  
  /**
   * ビューを初期化する
   */
  initialize() {
    this.createApiCards();
    
    const contactButton = this.element.querySelector('#contactButton');
    if (contactButton) {
      contactButton.addEventListener('click', () => {
        window.open('contact.html', '_blank');
      });
    }
  }
  
  /**
   * 全プロバイダー用のAPIカードを作成する
   */
  createApiCards() {
    if (!this.cardContainer || !this.cardTemplate) return;
    
    this.cardContainer.innerHTML = '';
    
    Object.entries(apiConfigs).forEach(([apiId, config]) => {
      const card = this.createApiCard(apiId, config);
      this.cardContainer.appendChild(card);
    });
  }
  
  /**
   * プロバイダー用のAPIカードを作成する
   * 
   * @param {string} apiId - APIプロバイダーID
   * @param {Object} config - APIプロバイダー設定
   * @returns {HTMLElement} APIカード要素
   */
  createApiCard(apiId, config) {
    const card = this.cardTemplate.content.cloneNode(true);
    const cardElement = card.querySelector('.col-12');
    
    cardElement.id = `${apiId}-card`;
    cardElement.querySelector('h3').textContent = config.name;
    
    const keyDisplay = cardElement.querySelector('.key-display');
    if (this.model.getApiKey(apiId)) {
      keyDisplay.textContent = '*'.repeat(20);
    } else {
      keyDisplay.textContent = chrome.i18n.getMessage('notSet');
    }
    
    const form = cardElement.querySelector('form');
    const keyInput = form.querySelector('.key-input');
    const viewMode = cardElement.querySelector('.view-mode');
    const editMode = cardElement.querySelector('.edit-mode');
    
    keyInput.placeholder = config.keyPlaceholder;
    const toggleVisibilityBtn = cardElement.querySelector('.toggle-visibility');
    toggleVisibilityBtn.addEventListener('click', () => {
      const icon = toggleVisibilityBtn.querySelector('i');
      if (icon.classList.contains('bi-eye')) {
        keyDisplay.textContent = this.model.getApiKey(apiId) || chrome.i18n.getMessage('notSet');
        icon.classList.replace('bi-eye', 'bi-eye-slash');
      } else {
        keyDisplay.textContent = this.model.getApiKey(apiId)
          ? '*'.repeat(20)
          : chrome.i18n.getMessage('notSet');
        icon.classList.replace('bi-eye-slash', 'bi-eye');
      }
    });
    
    const toggleEditBtn = cardElement.querySelector('.toggle-edit');
    const cancelEditBtn = cardElement.querySelector('.cancel-edit');
    
    const toggleEdit = () => {
      viewMode.classList.toggle('d-none');
      editMode.classList.toggle('d-none');
      if (!editMode.classList.contains('d-none')) {
        keyInput.value = this.model.getApiKey(apiId) || '';
        if (config.customUrl) {
          const urlInput = cardElement.querySelector('.url-input');
          urlInput.value = this.model.getCustomSettings(apiId)?.url || '';
        }
        if (config.customModel) {
          const modelInput = cardElement.querySelector('.model-input');
          modelInput.value = this.model.getCustomSettings(apiId)?.model || '';
        }
      }
    };
    
    toggleEditBtn.addEventListener('click', toggleEdit);
    cancelEditBtn.addEventListener('click', toggleEdit);
    
    // Set up delete button
    const deleteBtn = cardElement.querySelector('.delete-key');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.showDeleteConfirmModal(apiId, config.name, cardElement);
      });
      
      // Show/hide delete button based on whether key exists
      if (!this.model.getApiKey(apiId)) {
        deleteBtn.style.display = 'none';
      }
    }
    
    if (config.customUrl) {
      const urlContainer = cardElement.querySelector('.custom-url-container');
      urlContainer.classList.remove('d-none');
    }
    if (config.customModel) {
      const modelContainer = cardElement.querySelector('.custom-model-container');
      modelContainer.classList.remove('d-none');
    }
    
    if (config.requiresAdditionalConfig && config.additionalFields) {
      this.addAdditionalFields(form, apiId, config);
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newKey = keyInput.value.trim();
      
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
      
      this.controller.handleAction('setApiKey', { provider: apiId, key: newKey });
      
      if (config.customUrl) {
        const urlInput = cardElement.querySelector('.url-input');
        this.controller.handleAction('setCustomSettings', {
          provider: apiId,
          settings: { url: urlInput.value.trim() }
        });
      }
      if (config.customModel) {
        const modelInput = cardElement.querySelector('.model-input');
        this.controller.handleAction('setCustomSettings', {
          provider: apiId,
          settings: { model: modelInput.value.trim() }
        });
      }
      
      if (config.requiresAdditionalConfig && config.additionalFields) {
        const additionalFields = form.querySelectorAll('.additional-fields input, .additional-fields select');
        const settings = {};
        additionalFields.forEach(field => {
          const fieldName = field.dataset.field;
          settings[fieldName] = (field.type === 'checkbox') ? field.checked : field.value;
        });
        this.controller.handleAction('setCustomSettings', { provider: apiId, settings });
      }
      
      this.controller.handleAction('saveSettings');
      
      keyDisplay.textContent = '*'.repeat(20);
      viewMode.classList.remove('d-none');
      editMode.classList.add('d-none');
      
      // Show delete button since a key now exists
      const deleteBtn = cardElement.querySelector('.delete-key');
      if (deleteBtn && newKey.trim()) {
        deleteBtn.style.display = 'inline-block';
      }
      
      // Show model selector if this provider has models
      if (config.hasModels) {
        const modelSelectorContainer = cardElement.querySelector('.model-selector-container');
        if (modelSelectorContainer) {
          modelSelectorContainer.classList.remove('d-none');
        }
      }
      
    });
    
    if (config.hasModels) {
      this.setupModelSelector(cardElement, apiId);
    }
    
    this.setupApiToggle(cardElement, apiId);
    
    return cardElement;
  }
  
  /**
   * フォームに追加フィールドを追加する
   * 
   * @param {HTMLElement} form - フォーム要素
   * @param {string} apiId - APIプロバイダーID
   * @param {Object} config - APIプロバイダー設定
   */
  addAdditionalFields(form, apiId, config) {
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
      
      const settings = this.model.getCustomSettings(apiId);
      if (settings && settings[fieldName] !== undefined) {
        if (fieldConfig.type === 'checkbox') {
          input.checked = settings[fieldName];
        } else {
          input.value = settings[fieldName];
        }
      } else if (fieldConfig.defaultValue) {
        if (fieldConfig.type === 'checkbox') {
          input.checked = fieldConfig.defaultValue;
        } else {
          input.value = fieldConfig.defaultValue;
        }
      }
      
      fieldWrapper.appendChild(label);
      fieldWrapper.appendChild(input);
      additionalFieldsContainer.appendChild(fieldWrapper);
    });
    
    form.insertBefore(additionalFieldsContainer, form.querySelector('.text-end'));
  }
  
  /**
   * カード用のモデルセレクタをセットアップする
   * 
   * @param {HTMLElement} cardElement - カード要素
   * @param {string} apiId - APIプロバイダーID
   */
  setupModelSelector(cardElement, apiId) {
    const selectorContainer = cardElement.querySelector('.model-selector-container');
    selectorContainer.classList.remove('d-none');
    
    const modelSelector = cardElement.querySelector('.model-selector');
    const modelsList = cardElement.querySelector('.models-list');
    
    if (this.model.getSelectedModel(apiId)) {
      const modelNameElement = cardElement.querySelector('.model-name');
      const models = this.model.getModelsList(apiId);
      if (models) {
        const model = models.find(m => m.id === this.model.getSelectedModel(apiId));
        modelNameElement.textContent = model
          ? `(${model.name})`
          : `(${this.model.getSelectedModel(apiId)})`;
      } else {
        modelNameElement.textContent = `(${this.model.getSelectedModel(apiId)})`;
      }
    }
    
    modelSelector.addEventListener('click', async () => {
      modelSelector.classList.toggle('open');
      modelsList.classList.toggle('d-none');
      
      if (!this.model.getModelsList(apiId) && this.model.getApiKey(apiId)) {
        this.controller.handleAction('fetchModels', { provider: apiId, element: cardElement });
      }
    });
  }
  
  /**
   * カード用のAPIトグルをセットアップする
   * 
   * @param {HTMLElement} cardElement - カード要素
   * @param {string} apiId - APIプロバイダーID
   */
  setupApiToggle(cardElement, apiId) {
    const apiToggle = cardElement.querySelector('.api-toggle');
    apiToggle.id = `${apiId}-toggle`;
    
    if (this.model.getActiveApi() === apiId) {
      apiToggle.checked = true;
    }
    
    apiToggle.addEventListener('change', async () => {
      if (apiToggle.checked) {
        if (this.model.validateApiConfig(apiId)) {
          this.controller.handleAction('setActiveApi', { provider: apiId });
          
          document.querySelectorAll('.api-toggle').forEach(toggle => {
            if (toggle !== apiToggle) toggle.checked = false;
          });
        } else {
          apiToggle.checked = false;
          alert(chrome.i18n.getMessage('incompleteSettings', [apiConfigs[apiId].name]));
        }
      } else {
        if (this.model.getActiveApi() === apiId) {
          this.controller.handleAction('setActiveApi', { provider: null });
        }
      }
    });
  }
  
  
  /**
   * プロバイダーのモデルリストを更新する
   * 
   * @param {string} apiId - APIプロバイダーID
   * @param {Array} models - モデルリスト
   * @param {HTMLElement} cardElement - カード要素
   */
  updateModelsList(apiId, models, cardElement) {
    const loadingState = cardElement.querySelector('.loading-state');
    const errorState = cardElement.querySelector('.error-state');
    const emptyState = cardElement.querySelector('.empty-state');
    const modelsContainer = cardElement.querySelector('.models-container');
    
    loadingState.classList.add('d-none');
    modelsContainer.innerHTML = '';
    
    if (models.length === 0) {
      emptyState.classList.remove('d-none');
      errorState.classList.add('d-none');
    } else {
      emptyState.classList.add('d-none');
      errorState.classList.add('d-none');
      
      models.forEach(model => {
        const label = document.createElement('label');
        label.className =
          'form-check d-flex align-items-center gap-2 py-1 px-2 rounded cursor-pointer hover-bg-light';
        label.innerHTML = `
          <input type="radio" class="form-check-input" name="model-${apiId}" value="${model.id}">
          <span class="small model-name-text">${model.name}</span>
        `;
        
        const input = label.querySelector('input');
        input.checked = this.model.getSelectedModel(apiId) === model.id;
        input.addEventListener('change', () => {
          this.controller.handleAction('setSelectedModel', {
            provider: apiId,
            model: model.id
          });
          cardElement.querySelector('.model-name').textContent = `(${model.name})`;
        });
        
        modelsContainer.appendChild(label);
      });
    }
  }
  
  /**
   * モデルリストのエラー状態を表示する
   * 
   * @param {string} apiId - APIプロバイダーID
   * @param {Error} error - エラー
   * @param {HTMLElement} cardElement - カード要素
   */
  showModelsError(apiId, error, cardElement) {
    const loadingState = cardElement.querySelector('.loading-state');
    const errorState = cardElement.querySelector('.error-state');
    const emptyState = cardElement.querySelector('.empty-state');
    
    loadingState.classList.add('d-none');
    emptyState.classList.add('d-none');
    
    errorState.classList.remove('d-none');
    errorState.querySelector('.error-message').textContent = error.message;
  }
  
  /**
   * モデルリストのローディング状態を表示する
   * 
   * @param {string} apiId - APIプロバイダーID
   * @param {HTMLElement} cardElement - カード要素
   */
  showModelsLoading(apiId, cardElement) {
    const loadingState = cardElement.querySelector('.loading-state');
    const errorState = cardElement.querySelector('.error-state');
    const emptyState = cardElement.querySelector('.empty-state');
    const modelsContainer = cardElement.querySelector('.models-container');
    
    loadingState.classList.remove('d-none');
    errorState.classList.add('d-none');
    emptyState.classList.add('d-none');
    modelsContainer.innerHTML = '';
  }
  
  /**
   * モデルの変更を処理する
   * 
   * @param {Object} change - 変更オブジェクト
   * @param {Object} model - モデル
   */
  onModelChange(change, model) {
    switch (change.key) {
      case 'activeApi':
        document.querySelectorAll('.api-toggle').forEach(toggle => {
          const apiId = toggle.id.replace('-toggle', '');
          toggle.checked = apiId === change.newValue;
        });
        break;
        
      case 'apiKeys':
        Object.entries(change.newValue).forEach(([apiId, key]) => {
          const card = document.querySelector(`#${apiId}-card`);
          if (card) {
            const keyDisplay = card.querySelector('.key-display');
            const deleteBtn = card.querySelector('.delete-key');
            
            keyDisplay.textContent = key ? '*'.repeat(20) : chrome.i18n.getMessage('notSet');
            
            // Show/hide delete button based on whether key exists
            if (deleteBtn) {
              deleteBtn.style.display = key ? 'inline-block' : 'none';
            }
          }
        });
        
        // Handle deleted keys (keys that existed before but don't exist in newValue)
        const allApiIds = Object.keys(apiConfigs);
        allApiIds.forEach(apiId => {
          if (!change.newValue[apiId]) {
            const card = document.querySelector(`#${apiId}-card`);
            if (card) {
              const keyDisplay = card.querySelector('.key-display');
              const deleteBtn = card.querySelector('.delete-key');
              
              keyDisplay.textContent = chrome.i18n.getMessage('notSet');
              if (deleteBtn) {
                deleteBtn.style.display = 'none';
              }
            }
          }
        });
        break;
        
      case 'selectedModels':
        Object.entries(change.newValue).forEach(([apiId, modelId]) => {
          const card = document.querySelector(`#${apiId}-card`);
          if (card) {
            const modelNameElement = card.querySelector('.model-name');
            const models = this.model.getModelsList(apiId);
            if (modelId) {
              if (models) {
                const model = models.find(m => m.id === modelId);
                modelNameElement.textContent = model
                  ? `(${model.name})`
                  : `(${modelId})`;
              } else {
                modelNameElement.textContent = `(${modelId})`;
              }
            } else {
              modelNameElement.textContent = '';
            }
          }
        });
        
        // Handle deleted models (check all API IDs for missing entries)
        const allProviderIds = Object.keys(apiConfigs);
        allProviderIds.forEach(apiId => {
          if (!change.newValue[apiId]) {
            const card = document.querySelector(`#${apiId}-card`);
            if (card) {
              const modelNameElement = card.querySelector('.model-name');
              if (modelNameElement) {
                modelNameElement.textContent = '';
              }
            }
          }
        });
        break;
    }
  }
  
  /**
   * Show delete confirmation modal
   * 
   * @param {string} apiId - API provider ID
   * @param {string} providerName - Name of the API provider
   * @param {HTMLElement} cardElement - The card element
   */
  showDeleteConfirmModal(apiId, providerName, cardElement) {
    const modal = document.getElementById('deleteConfirmModal');
    const messageElement = document.getElementById('deleteConfirmMessage');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    
    // Update modal content
    messageElement.textContent = `Are you sure you want to delete the API key for ${providerName}?`;
    
    // Remove any existing event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    // Add new event listener
    newConfirmBtn.addEventListener('click', async () => {
      await this.performDelete(apiId, providerName, cardElement);
      
      // Close modal
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) {
        bsModal.hide();
      }
    });
    
    // Show modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }
  
  /**
   * Perform the actual delete operation
   * 
   * @param {string} apiId - API provider ID
   * @param {string} providerName - Name of the API provider
   * @param {HTMLElement} cardElement - The card element
   */
  async performDelete(apiId, providerName, cardElement) {
    const deleteBtn = cardElement.querySelector('.delete-key');
    
    try {
      // Add loading state
      if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
      }
      
      await this.controller.handleAction('deleteApiKey', { provider: apiId });
      
      // Update UI immediately
      const keyDisplay = cardElement.querySelector('.key-display');
      if (keyDisplay) {
        keyDisplay.textContent = chrome.i18n.getMessage('notSet') || 'Not set';
      }
      
      // Clear model display
      const modelNameElement = cardElement.querySelector('.model-name');
      if (modelNameElement) {
        modelNameElement.textContent = '';
      }
      
      // Hide model selector if it exists
      const modelSelectorContainer = cardElement.querySelector('.model-selector-container');
      if (modelSelectorContainer) {
        modelSelectorContainer.classList.add('d-none');
      }
      
      
      // Clear models list
      const modelsContainer = cardElement.querySelector('.models-container');
      if (modelsContainer) {
        modelsContainer.innerHTML = '';
      }
      
      // Hide delete button since there's no key
      if (deleteBtn) {
        deleteBtn.style.display = 'none';
      }
      
      // If this was the active API, deactivate it
      if (this.model.getActiveApi() === apiId) {
        const apiToggle = cardElement.querySelector('.api-toggle');
        if (apiToggle) {
          apiToggle.checked = false;
        }
        await this.controller.handleAction('setActiveApi', { provider: null });
      }
      
      // Show success feedback
      this.showDeleteSuccessMessage(cardElement, providerName);
      
    } catch (error) {
      console.error('Error deleting API key:', error);
      this.showDeleteErrorMessage(cardElement, error.message);
      
      // Restore delete button
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
      }
    }
  }

  /**
   * Show success message after deleting API key
   * 
   * @param {HTMLElement} cardElement - The card element
   * @param {string} providerName - Name of the API provider
   */
  showDeleteSuccessMessage(cardElement, providerName) {
    const successMessage = document.createElement('div');
    successMessage.className = 'alert alert-success alert-dismissible fade show mt-2';
    successMessage.innerHTML = `
      <strong>Success!</strong> API key for ${providerName} has been deleted.
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    cardElement.appendChild(successMessage);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (successMessage.parentNode) {
        successMessage.remove();
      }
    }, 3000);
  }
  
  /**
   * Show error message when deleting API key fails
   * 
   * @param {HTMLElement} cardElement - The card element
   * @param {string} errorMessage - Error message to display
   */
  showDeleteErrorMessage(cardElement, errorMessage) {
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-danger alert-dismissible fade show mt-2';
    errorAlert.innerHTML = `
      <strong>Error!</strong> Failed to delete API key: ${errorMessage}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    cardElement.appendChild(errorAlert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorAlert.parentNode) {
        errorAlert.remove();
      }
    }, 5000);
  }

  /**
   * ビューを描画する
   * 
   * @returns {ApiSettingsView} チェーン用のビューインスタンス
   */
  render() {
    this.createApiCards();
    return this;
  }
}

/**
 * ApiSettingsViewインスタンスを作成するファクトリ関数
 * 
 * @param {Object} container - 依存性注入コンテナ
 * @returns {ApiSettingsView} ApiSettingsViewインスタンス
 */
export const createApiSettingsView = (container) => {
  const apiSettingsModel = container.get('apiSettingsModel');
  const element = document.querySelector('#api-settings-container') || document.body;
  
  const view = new ApiSettingsView(element, apiSettingsModel);
  
  const controller = container.get('apiSettingsController');
  view.controller = controller;
  
  return view;
};
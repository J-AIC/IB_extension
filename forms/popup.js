// ----------------------------
// forms/popup.js
// メインの関数、UI制御・状態管理
// ----------------------------
import GPTService from './gpt.js';

// Using global secureLogger without fallback implementation
// secureLogger is initialized and made available by utils/loggerSetup.js
// No more fallback needed as it's guaranteed to be available

const DEBUG = true;
function debugLog(section, message, data = null) {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString();
  secureLogger.log(`[FormController][${section}][${timestamp}] ${message}`);
  if (data) {
    secureLogger.log('Data:', data);
  }
}

async function loadActiveAPISettings() {
  const data = await chrome.storage.local.get([
    'apiProvider',
    'apiKeys',
    'selectedModels',
    'customSettings'
  ]);
  const provider = data.apiProvider;
  if (!provider) throw new Error('アクティブなAPIプロバイダが設定されていません');

  const apiKey = data.apiKeys?.[provider] || '';
  const model = data.selectedModels?.[provider] || '';
  const settings = data.customSettings?.[provider] || {};

  return { provider, apiKey, model, customSettings: settings };
}

class FormController {
  constructor() {
    debugLog('Constructor', 'Initializing FormController');
    this.STATE_KEY = 'form_controller_state';
    this.processingTabId = null;
    this.cachedForms = [];
    this.isRemoteForms = false;
    this.suggestions = [];
    this.selectedValues = {};
    this.status = 'idle';
    this.mode = 'normal';
    this.manualRulesContent = '';
    this.processDocContent = '';
    this.webExtractContent = '';
    this.manualRulesFileName = '';
    this.processDocFileName = '';
    this.processDocImageData = null;
    this.gptService = new GPTService();

    if (window.pdfjsLib) {
      this.pdfjsLib = window.pdfjsLib;
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/js/pdf.worker.min.js');
      debugLog('Constructor', 'pdfjsLib is set from window.pdfjsLib');
    } else {
      debugLog('Constructor', 'pdfjsLib not found on window; PDF parsing may fail');
      this.pdfjsLib = null;
    }

    this.elements = {
      formControlSection: document.getElementById('formControlSection'),
      apiKey: document.getElementById('apiKey'),
      modelSelect: document.getElementById('modelSelect'),
      manualPdf: document.getElementById('manualPdf'),
      processPdf: document.getElementById('processPdf'),
      manualPdfUploadSection: document.getElementById('manualPdfUploadSection'),
      manualPdfSelectedSection: document.getElementById('manualPdfSelectedSection'),
      manualPdfFileName: document.getElementById('manualPdfFileName'),
      manualPdfRemoveBtn: document.getElementById('manualPdfRemoveBtn'),
      processPdfUploadSection: document.getElementById('processPdfUploadSection'),
      processPdfSelectedSection: document.getElementById('processPdfSelectedSection'),
      processPdfFileName: document.getElementById('processPdfFileName'),
      processPdfRemoveBtn: document.getElementById('processPdfRemoveBtn'),
      extractButton: document.getElementById('extractButton'),
      promptInput: document.getElementById('promptInput'),
      gptButton: document.getElementById('gptButton'),
      statusDisplay: document.getElementById('statusDisplay'),
      statusIcon: document.getElementById('statusIcon'),
      statusText: document.getElementById('statusText'),
      formContainer: document.getElementById('formElementsContainer'),
      selectedSection: document.getElementById('selectedValuesSection'),
      selectedContainer: document.getElementById('selectedValuesContainer'),
      applyButton: document.getElementById('applyFormButton')
    };
  }

  syncWebExtractContent() {
    if (window.webListManager) {
      const pages = window.webListManager.getPageContents();
      this.webExtractContent = pages.map(p => p.content).join('\n\n');
      debugLog('syncWebExtractContent', 'Refreshed webExtractContent', {
        length: this.webExtractContent.length
      });
      this.saveState();
    }
  }

  showFormControl() {
    if (this.elements.formControlSection) {
      this.elements.formControlSection.classList.remove('hidden');
    }
  }

  hideFormControl() {
    if (this.elements.formControlSection) {
      this.elements.formControlSection.classList.add('hidden');
    }
  }

  async saveState() {
    const formState = {
      cachedForms: this.cachedForms,
      selectedValues: this.selectedValues,
      status: this.status,
      processingTabId: this.processingTabId
    };
  
    const suggestionState = {
      suggestions: this.suggestions,
      lastUpdated: new Date().toISOString()
    };
  
    const persistentState = {
      manualRulesContent: this.manualRulesContent,
      processDocContent: this.processDocContent,
      webExtractContent: this.webExtractContent,
      promptInput: this.elements.promptInput?.value || '',
      apiKey: this.elements.apiKey?.value,
      selectedModel: this.elements.modelSelect?.value,
      manualRulesFileName: this.manualRulesFileName,
      processDocFileName: this.processDocFileName,
      processDocImageData: this.processDocImageData || ''
    };
  
    await Promise.all([
      chrome.storage.local.set({ [`${this.STATE_KEY}_form`]: formState }),
      chrome.storage.local.set({ [`${this.STATE_KEY}_suggestions`]: suggestionState }),
      chrome.storage.local.set({ [`${this.STATE_KEY}_persistent`]: persistentState })
    ]);
  
    debugLog('saveState', 'States saved', { formState, suggestionState, persistentState });
  }

  async loadState() {
    const data = await chrome.storage.local.get([
      `${this.STATE_KEY}_form`,
      `${this.STATE_KEY}_suggestions`,
      `${this.STATE_KEY}_persistent`
    ]);
  
    const formState = data[`${this.STATE_KEY}_form`];
    const suggestionState = data[`${this.STATE_KEY}_suggestions`];
    const persistentState = data[`${this.STATE_KEY}_persistent`];
  
    if (formState) {
      debugLog('loadState', 'Loading form state', formState);
      this.cachedForms = formState.cachedForms || [];
      this.selectedValues = formState.selectedValues || {};
      this.status = formState.status || 'idle';
      this.processingTabId = formState.processingTabId || null;
    }
  
    if (suggestionState) {
      debugLog('loadState', 'Loading suggestion state', suggestionState);
      this.suggestions = suggestionState.suggestions || [];
    }
  
    if (persistentState) {
      debugLog('loadState', 'Loading persistent state', persistentState);
  
      this.manualRulesContent = persistentState.manualRulesContent || '';
      this.processDocContent = persistentState.processDocContent || '';
      this.webExtractContent = persistentState.webExtractContent || '';
  
      if (this.elements.promptInput && persistentState.promptInput) {
        this.elements.promptInput.value = persistentState.promptInput;
      }
  
      if (persistentState.apiKey) {
        this.elements.apiKey.value = persistentState.apiKey;
        this.gptService.setApiKey(persistentState.apiKey);
      }
  
      if (persistentState.selectedModel) {
        await this.updateModelSelect();
        this.elements.modelSelect.value = persistentState.selectedModel;
        this.gptService.setModel(persistentState.selectedModel);
      }
  
      if (persistentState.manualRulesFileName) {
        this.manualRulesFileName = persistentState.manualRulesFileName;
      }
      if (persistentState.processDocFileName) {
        this.processDocFileName = persistentState.processDocFileName;
      }
  
      this.processDocImageData = persistentState.processDocImageData || null;
  
      this.updatePdfListDisplay();
    }
  
    if (this.cachedForms.length > 0) {
      this.renderFormElements();
      this.showFormControl();
  
      if (Object.keys(this.suggestions).length > 0) {
        this.renderSuggestions();
      }
      if (Object.keys(this.selectedValues).length > 0) {
        this.renderSelectedValues();
      }
    } else {
      this.hideFormControl();
    }
  
    if (this.status !== 'idle') {
      this.updateStatus(this.status, this._getStatusMessage(this.status));
    }
  }

  async cleanupState() {
    await chrome.storage.local.remove(`${this.STATE_KEY}_form`);
    debugLog('cleanupState', 'Form state cleaned up');
  }

  async initializeNavigationListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'refreshForms' && request.success) {
        debugLog('refreshFormsListener', 'Received refreshForms message, re-fetching forms');
        this.autoLoadForms().then(() => {
          sendResponse({ received: true });
        }).catch(error => {
          debugLog('refreshFormsListener', 'Error re-fetching forms', { error });
          sendResponse({ error: error.message });
        });
        return true;
      }
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
      if (this.processingTabId === tabId) {
        if (changeInfo.url) {
          debugLog('navigationListener', 'URL change detected', { url: changeInfo.url });
          await Promise.all([
            chrome.storage.local.remove(`${this.STATE_KEY}_form`),
            chrome.storage.local.remove(`${this.STATE_KEY}_suggestions`)
          ]);
          this.suggestions = [];
          this.selectedValues = {};
          this.hideFormControl();
          setTimeout(async () => {
            await this.autoLoadForms();
          }, 1000);
        }
      }
    });
  }

  async initialize() {
    debugLog('initialize', 'Starting initialization');
    await this.initializeNavigationListener();
    await this.initializeEventListeners();
    await this.initializeModelSelect();

    this.hideFormControl();
    await this.loadState();

    await this.autoLoadForms();

    debugLog('initialize', 'Initialization complete');
  }

  async initializeModelSelect() {
    debugLog('initializeModelSelect', 'Initializing model selection');

    this.elements.apiKey?.addEventListener('change', async (e) => {
      debugLog('apiKeyChange', 'API key updated, fetching models');
      const apiKey = e.target.value;
      this.gptService.setApiKey(apiKey);
      localStorage.setItem('openai_api_key', apiKey);

      if (apiKey) {
        try {
          await this.updateModelSelect();
          await this.saveState();
        } catch (error) {
          debugLog('apiKeyChange', 'Error updating models', { error });
          this.updateStatus('error', 'モデル一覧の取得に失敗しました');
        }
      }
    });

    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
      this.elements.apiKey.value = savedApiKey;
      this.gptService.setApiKey(savedApiKey);
      await this.updateModelSelect();
    }
  }

  async updateModelSelect() {
    debugLog('updateModelSelect', 'Updating model selection');
    try {
      this.updateStatus('reading', 'モデル一覧を取得中...');
      const models = await this.gptService.fetchAvailableModels();

      const select = this.elements.modelSelect;
      select.innerHTML = '<option value="">モデルを選択してください</option>';

      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        select.appendChild(option);
      });

      this.updateStatus('ready', 'モデル一覧を更新しました');
      select.disabled = false;

      const savedModel = localStorage.getItem('selected_model');
      if (savedModel) {
        select.value = savedModel;
        this.gptService.setModel(savedModel);
      }

      debugLog('updateModelSelect', 'Model selection updated', {
        modelCount: models.length
      });
    } catch (error) {
      debugLog('updateModelSelect', 'Error updating model selection', {
        error: error.message
      });
      this.elements.modelSelect.disabled = true;
      throw error;
    }
  }

  initializeEventListeners() {
    debugLog('initializeEventListeners', 'Setting up event listeners');

    this.elements.apiKey?.addEventListener('change', async (e) => {
      const apiKey = e.target.value;
      this.gptService.setApiKey(apiKey);
      localStorage.setItem('openai_api_key', apiKey);
      await this.saveState();
    });

    this.elements.modelSelect?.addEventListener('change', async (e) => {
      const model = e.target.value;
      this.gptService.setModel(model);
      localStorage.setItem('selected_model', model);
      await this.saveState();
    });

    this.elements.manualPdf?.addEventListener('change', async (e) => {
      debugLog('manualPdfChange', 'Manual PDF upload');
      await this.handlePdfUpload(e, 'manualRulesContent');
    });

    this.elements.processPdf?.addEventListener('change', async (e) => {
      debugLog('processPdfChange', 'Process PDF upload');
      await this.handlePdfUpload(e, 'processDocContent');
    });

    this.elements.manualPdfRemoveBtn?.addEventListener('click', async () => {
      this.manualRulesContent = '';
      this.manualRulesFileName = '';
      this.elements.manualPdf.value = null;
      this.updatePdfListDisplay();
      await this.saveState();
    });

    this.elements.processPdfRemoveBtn?.addEventListener('click', async () => {
      this.processDocContent = '';
      this.processDocFileName = '';
      this.processDocImageData = null;
      this.elements.processPdf.value = null;
      this.updatePdfListDisplay();
      await this.saveState();
    });

    this.elements.extractButton?.addEventListener('click', async () => {
      debugLog('extractButtonClick', 'Handling web extraction');
      await this.handleWebExtract();
    });

    this.elements.gptButton?.addEventListener('click', async () => {
      debugLog('gptButtonClick', 'Handling GPT suggestions');
      await this.handleGptSuggestions();
    });

    this.elements.applyButton?.addEventListener('click', async () => {
      debugLog('applyButtonClick', 'Applying form values');
      await this.handleFormApply();
    });

    this.elements.promptInput?.addEventListener('change', async () => {
      await this.saveState();
    });

    const clearButton = document.getElementById('clearFormDataButton');
    clearButton?.addEventListener('click', () => {
      debugLog('clearFormDataButtonClick', 'Clearing AI suggestions and user selections');
      this.clearFormData();
    });
  }

  async handlePdfUpload(event, targetProperty) {
    try {
      const file = event.target.files[0];
      if (!file) return;

      this.updateStatus('reading', `${file.name} を読み込み中...`);

      if (file.type === "application/pdf") {
        const text = await this.parsePdfFile(file);
        if (targetProperty === 'manualRulesContent') {
          this.manualRulesContent = text;
          this.manualRulesFileName = file.name;
        } else {
          this.processDocContent = text;
          this.processDocFileName = file.name;
        }
        debugLog('handlePdfUpload', 'PDF loaded successfully', {
          targetProperty,
          fileName: file.name,
          textSnippet: text.slice(0, 100)
        });
      }
      else if ((file.type === "image/jpeg" || file.type === "image/png")
        && this.gptService.modelMatchesImageProcessing()) {
        const base64Str = await this.convertFileToBase64(file);
        this.processDocImageData = `data:${file.type};base64,${base64Str}`;
        this.processDocFileName = file.name;
        debugLog('handlePdfUpload', 'Image loaded successfully for GPT', {
          targetProperty,
          fileName: file.name
        });
      }
      else {
        debugLog('handlePdfUpload', 'Unsupported file type', { fileType: file.type });
        this.updateStatus('error', 'サポートされていないファイル形式です');
        return;
      }

      this.updatePdfListDisplay();
      this.updateStatus('ready', `${file.name} の読み込み完了`);
      await this.saveState();

    } catch (error) {
      debugLog('handlePdfUpload', 'Error processing file', { error });
      this.updateStatus('error', 'ファイルの読み込みに失敗しました');
    }
  }

  convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => {
        reader.abort();
        reject(new Error("ファイル読み込みエラー"));
      };
      reader.onload = () => {
        const result = reader.result;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });
  }

  updatePdfListDisplay() {
    if (this.manualRulesFileName) {
      this.elements.manualPdfFileName.textContent = this.manualRulesFileName;
      this.elements.manualPdfSelectedSection.classList.remove('hidden');
      this.elements.manualPdfUploadSection.classList.add('hidden');
    } else {
      this.elements.manualPdfFileName.textContent = '';
      this.elements.manualPdfSelectedSection.classList.add('hidden');
      this.elements.manualPdfUploadSection.classList.remove('hidden');
    }

    if (this.processDocFileName) {
      this.elements.processPdfFileName.textContent = this.processDocFileName;
      this.elements.processPdfSelectedSection.classList.remove('hidden');
      this.elements.processPdfUploadSection.classList.add('hidden');
    } else {
      this.elements.processPdfFileName.textContent = '';
      this.elements.processPdfSelectedSection.classList.add('hidden');
      this.elements.processPdfUploadSection.classList.remove('hidden');
    }
  }

  async parsePdfFile(file) {
    if (!this.pdfjsLib) {
      debugLog('parsePdfFile', 'pdfjsLib not loaded; cannot parse PDF');
      return '';
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await this.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

      let textContentAll = '';
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        textContentAll += pageText + '\n';
      }
      return textContentAll;
    } catch (err) {
      debugLog('parsePdfFile', 'Error parsing PDF with pdf.js', { err });
      return '';
    }
  }

  async handleWebExtract() {
    await this.autoLoadForms();
    try {
      if (window.webListManager?.getPageContents) {
        const pages = window.webListManager.getPageContents();
        this.webExtractContent = pages.map(p => p.content).join('\n\n');
        debugLog('handleWebExtract', 'Web content extracted', {
          pageCount: pages.length,
          snippet: this.webExtractContent.slice(0, 100)
        });
        await this.saveState();
      }
    } catch (err) {
      debugLog('handleWebExtract', 'Error extracting web content', { err });
    }
  }

  async handleGptSuggestions() {
    debugLog('handleGptSuggestions', 'Starting GPT processing');
    try {
      await this.clearFormData();

      const { provider, apiKey, model, customSettings } = await loadActiveAPISettings();
      this.gptService.setProvider(provider);
      this.gptService.setApiKey(apiKey);
      this.gptService.setModel(model);
      this.gptService.setCustomSettings(customSettings);

      this.updateStatus('processing', 'GPT処理中...');

      await chrome.storage.local.remove(`${this.STATE_KEY}_suggestions`);
      this.suggestions = [];

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.processingTabId = tab.id;

      let mergedPrompt = this.elements.promptInput?.value || '';

      if (this.isRemoteForms) {
        const remotePrompts = this.cachedForms
          .filter(f => f.absolute_xpath)
          .map(f => {
            const t = f.type || 'text';
            const label = f.label || f.id;
            const pr = f.prompt || '';
            return `(type=${t})【${label}】: ${pr}`;
          })
          .filter(line => line.trim().length > 0);

        if (remotePrompts.length > 0) {
          mergedPrompt += '\n\n--- 以下は各フォームごとのユーザ入力 ---\n'
            + remotePrompts.join('\n');
        }
      }

      const prompt = await this.gptService.generatePrompt(
        this.cachedForms,
        this.manualRulesContent,
        this.processDocContent,
        this.webExtractContent,
        mergedPrompt,
        this.processDocImageData
      );

      await this.saveState();
      debugLog('handleGptSuggestions', 'Prompt generated', { prompt });

      const result = await this.gptService.sendToGPT(prompt);

      this.suggestions = result.form_suggestions || [];
      this.suggestions.forEach(formSuggestion => {
        formSuggestion.suggestions.sort((a, b) => b.confidence - a.confidence);
        const formId = formSuggestion.form_id;
        if (!this.selectedValues[formId] && formSuggestion.suggestions.length > 0) {
          this.selectedValues[formId] = formSuggestion.suggestions[0].value;
        }
      });

      debugLog('handleGptSuggestions', 'Suggestions received', {
        suggestionCount: this.suggestions.length
      });

      this.renderSuggestions();
      this.updateStatus('ready', 'GPT処理完了');

      await this.saveState();
    } catch (error) {
      debugLog('handleGptSuggestions', 'Error in GPT processing', { error });
      this.updateStatus('error', 'GPT処理に失敗しました');
    }
  }

  async handleFormApply() {
    debugLog('handleFormApply', 'Applying form values', { values: this.selectedValues });
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const finalValues = {};

      this.cachedForms.forEach(form => {
        const formId = form.id;
        const val = this.selectedValues[formId];
        if (!val) return;

        if (form.absolute_xpath) {
          finalValues[formId] = {
            __xpath: form.absolute_xpath,
            __value: val
          };
        } else {
          finalValues[formId] = val;
        }
      });

      await chrome.tabs.sendMessage(tab.id, {
        action: 'applyValues',
        values: finalValues
      });
      this.updateStatus('success', 'フォームに反映しました');

      if (!this.isRemoteForms) {
        await chrome.tabs.sendMessage(tab.id, { action: 'removeHighlight' });
      }
      await this.saveState();
    } catch (error) {
      debugLog('handleFormApply', 'Error applying form values', { error });
      this.updateStatus('error', 'フォームの反映に失敗しました');
    }
  }

  async autoLoadForms() {
    debugLog('autoLoadForms', 'Starting automatic form loading');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.processingTabId = tab.id;

    const tryFetchRemoteForms = async (retries = 2) => {
      try {
        const tabUrl = tab.url || '';
        const { apiProvider, apiKeys, customSettings } = await chrome.storage.local.get([
          'apiProvider', 'apiKeys', 'customSettings'
        ]);

        if (apiKeys?.local && customSettings?.local?.url) {
          const baseUrl = customSettings.local.url.replace(/\/+$/, '');
          const token = apiKeys.local;

          const response = await fetch(`${baseUrl}/widget/forms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token, url: tabUrl })
          });

          const data = await response.json();
          debugLog('autoLoadForms', 'Remote forms response', data);

          if (response.ok && data.status === 'success' && data.forms && data.forms.length > 0) {
            this.cachedForms = [];
            data.forms.forEach(formData => {
              formData.items.forEach((item, idx) => {
                const formattedData = {
                  id: `remote-xpath-${idx}`,
                  tagName: 'input',
                  type: item.type || 'text',
                  name: item.label || `field-${idx}`,
                  label: item.label || '',
                  placeholder: '',
                  required: false,
                  value: '',
                  absolute_xpath: item.absolute_xpath,
                  prompt: item.prompt || ''
                };
                if (item.type === 'select' || item.type === 'radio' || item.type === 'checkbox') {
                  if (item.options) {
                    formattedData.options = item.options.map(opt => ({
                      value: opt.value,
                      label: opt.label || opt.value,
                      selected: false
                    }));
                  }
                }
                this.cachedForms.push(formattedData);
              });
            });

            this.isRemoteForms = true;
            this.renderFormElements();
            this.showFormControl();
            this.updateStatus('ready', 'リモートフォームを取得しました');
            this.elements.gptButton.disabled = false;
            await this.saveState();
            return true;
          }
        }
        return false;
      } catch (error) {
        debugLog('autoLoadForms', `Remote forms fetch error (retries left: ${retries})`, { error });
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return tryFetchRemoteForms(retries - 1);
        }
        return false;
      }
    };

    if (await tryFetchRemoteForms()) return;

    const maxRetries = 3;
    let retryCount = 0;

    const fetchForms = async () => {
      try {
        this.updateStatus('reading', 'フォーム読み込み中...');

        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Message timeout'));
          }, 3000); // 3-second timeout

          chrome.tabs.sendMessage(tab.id, { action: 'getForms' }, (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });

        if (response && response.length > 0) {
          debugLog('autoLoadForms', 'Forms loaded successfully', { formCount: response.length });
          this.cachedForms = response;
          this.isRemoteForms = false;
          this.renderFormElements();
          this.showFormControl();
          this.updateStatus('ready', 'フォーム読み込み完了');
          this.elements.gptButton.disabled = false;

          await chrome.tabs.sendMessage(tab.id, { action: 'highlightForms' });
          await this.saveState();

          if (this.suggestions.length > 0) {
            this.renderSuggestions();
          }
        } else {
          debugLog('autoLoadForms', 'No forms found');
          this.hideFormControl();
          this.updateStatus('info', 'フォーム要素が見つかりませんでした');
          this.elements.gptButton.disabled = true;
        }
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          debugLog('autoLoadForms', `Retrying form fetch (${retryCount}/${maxRetries})`, { error });
          await new Promise(resolve => setTimeout(resolve, 500));
          return fetchForms();
        } else {
          debugLog('autoLoadForms', 'Error loading forms after retries', { error });
          this.hideFormControl();
          this.updateStatus('error', 'フォーム読み込みに失敗しました');
          this.elements.gptButton.disabled = true;
        }
      }
    };

    await fetchForms();
  }

  async clearFormData() {
    debugLog('clearFormDataButtonClick', 'Clearing AI suggestions and user selections');

    this.suggestions = [];
    this.selectedValues = {};

    await chrome.storage.local.remove(`${this.STATE_KEY}_suggestions`);

    const data = await chrome.storage.local.get([`${this.STATE_KEY}_form`]);
    const formState = data[`${this.STATE_KEY}_form`];
    if (formState) {
      formState.selectedValues = {};
      await chrome.storage.local.set({ [`${this.STATE_KEY}_form`]: formState });
    }

    this.elements.selectedContainer.innerHTML = '';
    this.renderFormElements();
    this.renderSuggestions();
    this.renderSelectedValues();

    this.updateStatus('info', 'AI候補と選択内容をクリアしました');
    await this.saveState();
  }

  renderFormElements() {
    debugLog('renderFormElements', 'Rendering form elements', {
      formCount: this.cachedForms.length
    });

    this.elements.formContainer.innerHTML = '';
    const template = document.getElementById('formElementTemplate');

    this.cachedForms.forEach(form => {
      const clone = template.content.cloneNode(true);

      const identifierEl = clone.querySelector('.element-identifier');
      identifierEl.textContent = form.label || form.name || form.id || '名称未設定';

      const select = clone.querySelector('select');
      select.id = `select-${form.id}`;

      const reasonDiv = clone.querySelector('.suggestion-reason');
      const reasonContent = clone.querySelector('.suggestion-reason-content');

      const promptWrapper = clone.querySelector('.prompt-wrapper');
      const promptInput = clone.querySelector('.prompt-input');

      if (form.absolute_xpath) {
        promptWrapper.classList.remove('hidden');
        promptInput.value = form.prompt || '';
        promptInput.addEventListener('change', async (e) => {
          form.prompt = e.target.value;
          await this.saveState();
        });
      } else {
        promptWrapper.classList.add('hidden');
      }

      select.addEventListener('change', async (e) => {
        const formIdentifier = form.id;
        this.selectedValues[formIdentifier] = e.target.value;

        if (e.target.value) {
          const selectedOption = e.target.selectedOptions[0];
          const reason = selectedOption.title;
          if (reason) {
            reasonContent.textContent = reason;
            reasonDiv.classList.remove('hidden');
          } else {
            reasonDiv.classList.add('hidden');
          }
        } else {
          reasonDiv.classList.add('hidden');
        }

        this.renderSelectedValues();
        await this.saveState();
      });

      this.elements.formContainer.appendChild(clone);
    });

    debugLog('renderFormElements', 'Form elements rendered', {
      elements: this.elements.formContainer.children.length
    });
  }

  renderSuggestions() {
    debugLog('renderSuggestions', 'Rendering suggestions');

    this.suggestions.forEach(formSuggestion => {
      const escapedId = CSS.escape(`select-${formSuggestion.form_id}`);
      const select = document.querySelector(`#${escapedId}`);
      if (!select) return;
      while (select.options.length > 1) {
        select.remove(1);
      }
      formSuggestion.suggestions.forEach(suggestion => {
        const text = `${suggestion.value} (確信度: ${Math.round(suggestion.confidence * 100)}%)`;
        const option = new Option(text, suggestion.value);
        option.title = suggestion.reason;
        select.add(option);
      });
      const formIdentifier = formSuggestion.form_id;
      if (!this.selectedValues[formIdentifier]) {
        if (formSuggestion.suggestions.length > 0) {
          const highest = formSuggestion.suggestions[0];
          select.value = highest.value;
          this.selectedValues[formIdentifier] = highest.value;

          const reasonDiv = select.closest('.card-content').querySelector('.suggestion-reason');
          const reasonContent = reasonDiv.querySelector('.suggestion-reason-content');
          if (highest.reason) {
            reasonContent.textContent = highest.reason;
            reasonDiv.classList.remove('hidden');
          }
        }
      } else {
        select.value = this.selectedValues[formIdentifier];
        const selectedSuggestion = formSuggestion.suggestions.find(
          s => s.value === this.selectedValues[formIdentifier]
        );
        if (selectedSuggestion?.reason) {
          const reasonDiv = select.closest('.card-content').querySelector('.suggestion-reason');
          const reasonContent = reasonDiv.querySelector('.suggestion-reason-content');
          reasonContent.textContent = selectedSuggestion.reason;
          reasonDiv.classList.remove('hidden');
        }
      }
    });

    this.renderSelectedValues();
    this.saveState();
  }

  renderSelectedValues() {
    debugLog('renderSelectedValues', 'Rendering selected values', {
      selectedValues: this.selectedValues
    });
    this.elements.selectedContainer.innerHTML = '';

    Object.entries(this.selectedValues).forEach(([formId, value]) => {
      const form = this.cachedForms.find(f => f.id === formId);
      const labelText = form?.label || form?.name || formId;
      if (form && value) {
        const div = document.createElement('div');
        div.className = 'grid grid-cols-2 gap-2';
        div.innerHTML = `
          <span class="text-gray-600">${labelText}:</span>
          <span>${value}</span>
        `;
        this.elements.selectedContainer.appendChild(div);
      }
    });
  }

  updateStatus(type, message) {
    debugLog('updateStatus', 'Updating status', { type, message });
    this.status = type;
    this.elements.statusDisplay.classList.remove('hidden');
    this.elements.statusText.textContent = message;

    this.elements.statusIcon.className = 'icon ' +
      (type === 'reading'
        ? 'alert-circle text-blue-500 animate-pulse'
        : type === 'ready'
          ? 'check-circle text-green-500'
          : type === 'error'
            ? 'alert-circle text-red-500'
            : type === 'success'
              ? 'check-circle text-green-500'
              : 'info text-gray-500');
  }

  _getStatusMessage(status) {
    const messages = {
      idle: '待機中',
      reading: 'フォーム読み込み中...',
      processing: 'GPT処理中...',
      ready: '処理完了',
      error: 'エラーが発生しました',
      success: 'フォームに反映しました',
      info: ''
    };
    return messages[status] || '';
  }
}

window.formController = new FormController();
window.formController.initialize();
//------------------------
// forms/content.js
// 挙動を制御するメインの関数
//------------------------
const DEBUG = true;
function debugLog(section, message, data = null) {
  if (!DEBUG) return;
  const log = `[FormObserver][${section}] ${message}`;
  console.log(log);
  if (data) {
    console.log('Data:', data);
  }
}

class FormObserver {
  constructor() {
    this.forms = new Map();
    this.initialized = false;
  }

  init() {
    debugLog('init', 'Initializing FormObserver');
    if (this.initialized) {
      debugLog('init', 'Already initialized, skipping');
      return;
    }
    this.initialized = true;

    // フォーム要素の監視を開始
    this.observeForms();

    // メッセージリスナーの設定
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      debugLog('messageListener', 'Received message', request);
      
      try {
        switch (request.action) {
          case 'getForms':
            debugLog('getForms', 'Getting form data');
            const formsData = this.getFormsData();
            debugLog('getForms', 'Retrieved form data', formsData);
            sendResponse(formsData);
            break;
          case 'applyValues':
            debugLog('applyValues', 'Applying values to forms', request.values);
            this.applyValues(request.values);
            sendResponse({ success: true });
            break;
          case 'highlightForms':
            debugLog('highlightForms', 'Highlighting form elements');
            this.highlightForms();
            sendResponse({ success: true });
            break;
          case 'removeHighlight':
            debugLog('removeHighlight', 'Removing form highlights');
            this.removeHighlight();
            sendResponse({ success: true });
            break;
        }
      } catch (error) {
        debugLog('messageListener', 'Error processing message', error);
        sendResponse({ error: error.message });
      }
      
      return true; // 非同期レスポンス用
    });
  }

  observeForms() {
    // 既存のフォーム要素を収集
    this.collectForms();

    // DOM変更の監視
    const observer = new MutationObserver((mutations) => {
      let needsUpdate = false;
      
      for (const mutation of mutations) {
        if (this.hasForms(mutation)) {
          needsUpdate = true;
          break;
        }
      }

      if (needsUpdate) {
        this.collectForms();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  hasForms(mutation) {
    // 追加されたノードにフォーム要素が含まれているか確認
    const elements = Array.from(mutation.addedNodes);
    return elements.some(node => {
      if (node.querySelectorAll) {
        return node.querySelectorAll('input, select, textarea').length > 0;
      }
      return false;
    });
  }

  isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' 
           && style.visibility !== 'hidden' 
           && style.opacity !== '0'
           && element.offsetParent !== null
           && element.getBoundingClientRect().height > 0
           && element.getBoundingClientRect().width > 0;
  }

  collectForms() {
    debugLog('collectForms', 'Starting form collection');
    
    // フォーム要素の収集（可視要素のみ）
    const formElements = document.querySelectorAll('input, select, textarea');
    debugLog('collectForms', `Found ${formElements.length} total form elements`);
    
    // まず全リセット
    this.forms.clear();

    // ラジオ・チェックボックスは name 単位でまとめる
    const radioCheckboxGroupMap = new Map();
    // それ以外は個別に格納
    const individualElements = [];

    formElements.forEach((el, index) => {
      if (!this.isElementVisible(el)) return;  // 不可視は除外

      const tagName = el.tagName.toLowerCase();
      let type = (el.type || tagName).toLowerCase();

      // ラジオ or チェックボックス → nameキーでまとめる
      if (type === 'radio' || type === 'checkbox') {
        const groupKey = el.name || el.id || `group-${index}`;
        if (!radioCheckboxGroupMap.has(groupKey)) {
          radioCheckboxGroupMap.set(groupKey, {
            id: groupKey,
            tagName: 'input-group', 
            type: type,
            name: el.name || el.id || '',
            label: '',
            options: []
          });
        }
        const groupData = radioCheckboxGroupMap.get(groupKey);
        if (!groupData.label) {
          groupData.label = this.findLabel(el);
        }
        groupData.options.push({
          value: el.value,
          label: this.findLabel(el) || el.value,
          checked: el.checked
        });
      } else {
        individualElements.push({ el, index });
      }
    });

    individualElements.forEach(({ el, index }) => {
      const tagName = el.tagName.toLowerCase();
      let type = (el.type || tagName).toLowerCase();
      
      if (tagName === 'select') {
        type = el.multiple ? 'select-multiple' : 'select';
      }

      const formData = this.extractFormData(el, index, type);
      if (formData?.id) {
        this.forms.set(formData.id, formData);
      }
    });

    // グループ化したラジオ・チェックボックスを追加
    radioCheckboxGroupMap.forEach((groupData, groupKey) => {
      this.forms.set(groupKey, groupData);
    });

    debugLog('collectForms', `Collected ${this.forms.size} visible form items/groups`);
  }

  extractFormData(element, index, forcedType = null) {
    try {
      const label = this.findLabel(element);
      const formData = {
        id: element.id || element.name || `form-element-${index}`,
        tagName: element.tagName.toLowerCase(),
        type: forcedType || (element.type || element.tagName.toLowerCase()),
        name: element.name || '',
        label: label || '',
        placeholder: element.placeholder || '',
        required: element.required || false
      };

      if (formData.type === 'select' || formData.type === 'select-multiple') {
        const selectEl = element;
        formData.options = Array.from(selectEl.options).map(opt => ({
          value: opt.value,
          label: opt.text,
          selected: opt.selected
        }));
      } else {
        formData.value = element.value || '';
      }

      return formData;
    } catch (error) {
      debugLog('extractFormData', 'Error extracting form data', error);
      return null;
    }
  }

  findLabel(element) {
    let label = '';
    try {
      if (element.id) {
        const labelElement = document.querySelector(`label[for="${element.id}"]`);
        if (labelElement) {
          label = labelElement.textContent.trim();
        }
      }
      
      if (!label && element.parentElement?.tagName === 'LABEL') {
        label = element.parentElement.textContent.trim();
      }
      
      if (!label) {
        const previousElement = element.previousElementSibling;
        if (
          previousElement && 
          !['INPUT','SELECT','TEXTAREA'].includes(previousElement.tagName)
        ) {
          label = previousElement.textContent.trim();
        }
      }
      
      return label || element.placeholder || element.name || '';
    } catch (error) {
      debugLog('findLabel', 'Error finding label', error);
      return '';
    }
  }

  getFormsData() {
    return Array.from(this.forms.values());
  }

  // -----------------------------
  // ★追加: absolute_xpath 用の適用処理
  // -----------------------------
  applyValues(values) {
    Object.entries(values).forEach(([id, val]) => {
      try {
        // formData が local解析分か、リモートxpath分かを判定する
        const formData = this.forms.get(id);

        // ★もし既存formsに無い (= リモート専用) 場合は
        //   'remote-xpath' タイプだとみなして直接適用
        if (!formData && val?.__xpath) {
          const xpath = val.__xpath;
          const inputValue = val.__value;

          const node = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;

          if (node) {
            node.value = inputValue;
            node.dispatchEvent(new Event('change', { bubbles: true }));
            node.dispatchEvent(new Event('input', { bubbles: true }));
            debugLog('applyValues', `Applied remote-xpath value`, { xpath, inputValue });
          }
          return;
        }

        if (!formData) return; // どちらでもなければスキップ

        // 既存のローカルフォーム適用処理
        if (formData.type === 'radio' || formData.type === 'checkbox') {
          const groupName = formData.name || formData.id;
          const inputs = document.querySelectorAll(`input[name="${groupName}"]`);
          if (formData.type === 'radio') {
            inputs.forEach(inputEl => {
              inputEl.checked = (inputEl.value === val);
              if (inputEl.checked) {
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
              }
            });
          } else {
            if (!Array.isArray(val)) {
              val = val === true ? [formData.options?.[0]?.value] : [];
            }
            inputs.forEach(inputEl => {
              inputEl.checked = val.includes(inputEl.value);
              if (inputEl.checked) {
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
              }
            });
          }
        }
        else if (formData.type === 'select-multiple') {
          const selectEl = (
            document.getElementById(id) || 
            document.querySelector(`select[name="${id}"]`)
          );
          if (selectEl) {
            if (!Array.isArray(val)) {
              val = [val];
            }
            Array.from(selectEl.options).forEach(option => {
              option.selected = val.includes(option.value);
            });
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        else if (formData.type === 'select') {
          const selectEl = (
            document.getElementById(id) || 
            document.querySelector(`select[name="${id}"]`)
          );
          if (selectEl) {
            selectEl.value = val;
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        else {
          const element = document.querySelector(`#${id}`) || 
                         document.querySelector(`[name="${id}"]`);
          if (element) {
            element.value = val;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        
        debugLog('applyValues', `Applied value to element`, { id, val });
      } catch (error) {
        debugLog('applyValues', `Error applying value to element`, { id, error });
      }
    });
  }

  highlightForms() {
    try {
      this.forms.forEach(formData => {
        const id = formData.id;
        if (formData.type === 'radio' || formData.type === 'checkbox') {
          const groupName = formData.name || formData.id;
          const inputs = document.querySelectorAll(`input[name="${groupName}"]`);
          inputs.forEach(el => el.classList.add('form-control-highlight'));
        } else {
          const element = document.querySelector(`#${id}`) || 
                         document.querySelector(`[name="${id}"]`);
          if (element) {
            element.classList.add('form-control-highlight');
          }
        }
      });
    } catch (error) {
      debugLog('highlightForms', 'Error highlighting forms', error);
    }
  }

  removeHighlight() {
    try {
      document.querySelectorAll('.form-control-highlight').forEach(element => {
        element.classList.remove('form-control-highlight');
      });
    } catch (error) {
      debugLog('removeHighlight', 'Error removing highlights', error);
    }
  }
}

try {
  debugLog('main', 'Starting FormObserver initialization');
  const formObserver = new FormObserver();
  formObserver.init();
  debugLog('main', 'FormObserver initialized successfully');
} catch (error) {
  debugLog('main', 'Error initializing FormObserver', error);
  console.error('FormObserver initialization error:', error);
}

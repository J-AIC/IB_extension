//------------------------
// forms/content.js
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

// Utility to debounce a function
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

class FormObserver {
  constructor() {
    this.forms = new Map();
    this.initialized = false;
    this.lastUrl = window.location.href;
    this.setupMessageListener();
  }

  setupMessageListener() {
    debugLog('setupMessageListener', 'Setting up message listener');
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        debugLog('messageListener', 'Received message', request);
        try {
            switch (request.action) {
                case 'getForms':
                    debugLog('getForms', 'Getting form data');
                    const formsData = this.getFormsData();
                    sendResponse(formsData);
                    break;
                case 'applyValues':
                    debugLog('applyValues', 'Applying values to forms', request.values);
                    if (this.isKintonePage()) {
                        this.applyKintoneValues(request.values);
                    } else {
                        this.applyNormalValues(request.values);
                    }
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
                case 'refreshForms':
                    debugLog('refreshForms', 'Refreshing forms due to navigation');
                    try {
                        this.refreshForms();
                        sendResponse({ success: true });
                    } catch (error) {
                        debugLog('refreshForms', 'Error refreshing forms', error);
                        sendResponse({ success: false, error: error.message });
                    }
                    break;
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            debugLog('messageListener', 'Error processing message', error);
            sendResponse({ error: error.message });
        }
        return true; // 非同期レスポンス用
    });
  }

  /**
   * kintoneページかどうかを簡易判定する
   * 例: .layout-gaia が存在する/しない など
   */
  isKintonePage() {
    return !!document.querySelector('.layout-gaia')
        || !!document.querySelector('.gaia-argoui-app-view');
    // ↑kintone特有のクラスを適宜追加
  }

  init() {
    debugLog('init', 'Initializing FormObserver');
    if (this.initialized) {
      debugLog('init', 'Already initialized, skipping');
      return;
    }

    // Ensure document.body is available before proceeding
    const startObservation = () => {
      if (!document.body) {
        debugLog('init', 'document.body not available, retrying in 100ms');
        setTimeout(startObservation, 100);
        return;
      }

      this.initialized = true;
      this.observeForms();
      this.setupSPATransitionListeners();

      chrome.runtime.sendMessage({ action: 'contentScriptLoaded' }, response => {
        debugLog('init', 'Notified background script of initialization', response);
      });
    };

    startObservation();
  }

  setupSPATransitionListeners() {
    window.addEventListener('popstate', () => {
      debugLog('spaTransition', 'Popstate event detected');
      this.handleNavigation();
    });

    window.addEventListener('hashchange', () => {
      debugLog('spaTransition', 'Hashchange event detected');
      this.handleNavigation();
    });

    ['pushState', 'replaceState'].forEach(method => {
      const original = history[method];
      history[method] = (...args) => {
        debugLog('spaTransition', `History.${method} called`, { args });
        const result = original.apply(history, args);
        this.handleNavigation();
        return result;
      };
    });

    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastUrl) {
        debugLog('spaTransition', 'URL change detected via polling', { old: this.lastUrl, new: currentUrl });
        this.lastUrl = currentUrl;
        this.handleNavigation();
      }
    }, 1000);
  }

  handleNavigation() {
    debugLog('handleNavigation', 'Handling page navigation');
    if (!this.initialized || !document.body) {
      debugLog('handleNavigation', 'Not initialized or document.body unavailable, skipping');
      return;
    }
    setTimeout(() => {
      this.refreshForms();
    }, 500);
  }

  observeForms() {
    debugLog('observeForms', 'Starting form observation');
    if (!document.body) {
      debugLog('observeForms', 'document.body not available, skipping observation');
      return;
    }

    this.collectForms();

    // DOM変更の監視
    const observer = new MutationObserver(
      debounce(mutations => {
        let needsUpdate = false;

        for (const mutation of mutations) {
          if (this.hasForms(mutation)) {
            debugLog('observeForms', 'Form-related DOM change detected');
            needsUpdate = true;
            break;
          }
          if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
            debugLog('observeForms', 'Significant structural change detected');
            needsUpdate = true;
            break;
          }
          if (mutation.type === 'attributes' && mutation.target instanceof Element && mutation.target.matches('input, select, textarea')) {
            debugLog('observeForms', 'Attribute change detected on form element');
            needsUpdate = true;
            break;
          }
          if (mutation.type === 'characterData' && mutation.target.parentElement?.matches('.field, .form-group, form')) {
            debugLog('observeForms', 'Content change detected in form container');
            needsUpdate = true;
            break;
          }
        }

        if (needsUpdate) {
          this.refreshForms();
        }
      }, 300)
    );

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value', 'checked', 'selected', 'style', 'class'],
      characterData: true
    });
    debugLog('observeForms', 'MutationObserver attached to document.body with enhanced config');
  }

  hasForms(mutation) {
    const elements = Array.from(mutation.addedNodes).filter(node => node.nodeType === Node.ELEMENT_NODE);
    if (elements.some(node => node.querySelectorAll && node.querySelectorAll('input, select, textarea').length > 0)) {
      return true;
    }
    if (mutation.target instanceof Element && (mutation.target.matches('input, select, textarea') || mutation.target.closest('input, select, textarea'))) {
      return true;
    }
    return false;
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

    const formElements = document.querySelectorAll('input, select, textarea');
    debugLog('collectForms', `Found ${formElements.length} total form elements`);

    this.forms.clear();

    const radioCheckboxGroupMap = new Map();
    const individualElements = [];

    formElements.forEach((el, index) => {
      if (!this.isElementVisible(el)) return;

      const tagName = el.tagName.toLowerCase();
      let type = (el.type || tagName).toLowerCase();

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
          groupData.label = this.findLabelEnhanced(el);
        }
        groupData.options.push({
          value: el.value,
          label: this.findLabelEnhanced(el) || el.value,
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

    radioCheckboxGroupMap.forEach((groupData, groupKey) => {
      this.forms.set(groupKey, groupData);
    });

    debugLog('collectForms', `Collected ${this.forms.size} visible form items/groups`);
  }

  extractFormData(element, index, forcedType = null) {
    try {
      const label = this.findLabelEnhanced(element);
      const fieldContainer = element.closest('[class*="field-"]');
      let fieldIdNumber = '';
      if (fieldContainer) {
        const match = fieldContainer.className.match(/field-(\d+)/);
        if (match) {
          fieldIdNumber = match[1];
        }
      }

      const formData = {
        id: element.id || element.name || `form-element-${index}`,
        tagName: element.tagName.toLowerCase(),
        type: forcedType || (element.type || element.tagName.toLowerCase()),
        name: element.name || '',
        label: label || '',
        placeholder: element.placeholder || '',
        required: element.required || false,
        kintoneFieldId: fieldIdNumber
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
        const escapedId = CSS.escape(element.id);
        const labelElement = document.querySelector(`label[for="${escapedId}"]`);
        if (labelElement) {
          label = labelElement.textContent.trim();
        }
      }

      if (!label && element.parentElement?.tagName === 'LABEL') {
        label = element.parentElement.textContent.trim();
        if (element.type === 'checkbox' || element.type === 'radio') {
          label = label.replace(element.value || '', '').trim();
        }
      }

      if (!label) {
        const previousElement = element.previousElementSibling;
        if (previousElement &&
            !['INPUT','SELECT','TEXTAREA'].includes(previousElement.tagName)) {
          label = previousElement.textContent.trim();
        }
      }
    } catch (error) {
      debugLog('findLabel', 'Error finding label', error);
    }

    return label;
  }

  findLabelEnhanced(element) {
    let label = this.findLabel(element);
    if (label) return label;

    label = this.findCybozuLabel(element);
    if (label) return label;

    label = this.findParentContainerLabel(element);
    if (label) return label;

    label = this.findAriaLabel(element);
    if (label) return label;

    label = this.findTableHeaderLabel(element);
    if (label) return label;

    if (element.id) {
      label = this.findLabelByFieldId(element.id);
      if (label) return label;
    }

    return element.placeholder || element.name || '';
  }

  findCybozuLabel(element) {
    let currentEl = element;
    let depth = 0;
    const maxDepth = 10;

    while (currentEl && depth < maxDepth) {
      if (currentEl.className &&
         (currentEl.className.includes('control-gaia') ||
          currentEl.className.includes('field-'))) {

        const labelSpans = currentEl.querySelectorAll('.control-label-text-gaia');
        if (labelSpans.length > 0) {
          return labelSpans[0].textContent.trim();
        }

        const labelDivs = currentEl.querySelectorAll('[class*="label-"]');
        if (labelDivs.length > 0) {
          const spans = labelDivs[0].querySelectorAll('span');
          if (spans.length > 0) {
            return spans[0].textContent.trim();
          } else {
            return labelDivs[0].textContent.trim();
          }
        }
      }
      currentEl = currentEl.parentElement;
      depth++;
    }
    return '';
  }

  findParentContainerLabel(element) {
    let parent = element.parentElement;
    let searchDepth = 0;

    while (parent && searchDepth < 3) {
      const labelDivs = parent.querySelectorAll(
        'div[class*="label"], div[class*="title"], div[class*="heading"], span[class*="label"]'
      );
      if (labelDivs.length > 0) {
        return labelDivs[0].textContent.trim();
      }

      const headings = parent.querySelectorAll('h1, h2, h3, h4, h5, h6, legend');
      if (headings.length > 0) {
        return headings[0].textContent.trim();
      }

      parent = parent.parentElement;
      searchDepth++;
    }
    return '';
  }

  findAriaLabel(element) {
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    } else if (element.getAttribute('aria-labelledby')) {
      const labelId = element.getAttribute('aria-labelledby');
      if (labelId) {
        const labelElement = document.getElementById(labelId);
        if (labelElement) {
          return labelElement.textContent.trim();
        }
      }
    }
    return '';
  }

  findTableHeaderLabel(element) {
    const cell = element.closest('td, th');
    if (cell) {
      const table = cell.closest('table');
      if (table) {
        const cellIndex = Array.from(cell.parentElement.children).indexOf(cell);
        const headerRow = table.querySelector('tr');
        if (headerRow && cellIndex >= 0 && headerRow.children[cellIndex]) {
          return headerRow.children[cellIndex].textContent.trim();
        }
      }
    }
    return '';
  }

  extractFieldId(id) {
    const matches = id.match(/(\d+)_(\d+)/);
    if (matches && matches[2]) {
      return matches[2];
    }
    return null;
  }

  findLabelByFieldId(id) {
    const fieldId = this.extractFieldId(id);
    if (!fieldId) return '';

    const labelElements = document.querySelectorAll(
      `.label-${fieldId}, .field-${fieldId} .control-label-text-gaia`
    );
    if (labelElements.length > 0) {
      for (const el of labelElements) {
        const text = el.textContent.trim();
        if (text) {
          return text;
        }
      }
    }
    return '';
  }

  getFormsData() {
    // Simplified to reduce DOM query overhead
    const formsArray = Array.from(this.forms.values());
    debugLog('getFormsData', `Returning ${formsArray.length} forms`);
    return formsArray;
  }

  applyNormalValues(values) {
    Object.entries(values).forEach(([id, val]) => {
      try {
        const formData = this.forms.get(id);
        if (!formData) return;

        if (formData.type === 'radio' || formData.type === 'checkbox') {
          const groupName = formData.name || formData.id;
          const escapedName = CSS.escape(groupName);
          const inputs = document.querySelectorAll(`input[name="${escapedName}"]`);

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
          const escapedId = CSS.escape(id);
          const selectEl = document.getElementById(id)
                        || document.querySelector(`select[name="${escapedId}"]`);
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
          const escapedId = CSS.escape(id);
          const selectEl = document.getElementById(id)
                        || document.querySelector(`select[name="${escapedId}"]`);
          if (selectEl) {
            selectEl.value = val;
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        else {
          let element = this.findFormElement(id);
          if (element) {
            element.value = val;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('input', { bubbles: true }));
            debugLog('applyNormalValues', `Applied value: ${id} = ${val}`);
          }
        }
      } catch (error) {
        debugLog('applyNormalValues', `Error applying value to element`, { id, error });
      }
    });
  }

  applyKintoneValues(values) {
    Object.entries(values).forEach(([id, val]) => {
      try {
        const formData = this.forms.get(id);

        if (!formData && val?.__xpath) {
          this.applyRemoteXpath(val.__xpath, val.__value);
          return;
        }
        if (!formData) return;

        if (this.isKintoneDateField(formData)) {
          this.applyValueToKintoneDateField(formData, val);
        }
        else if (formData.type === 'radio' || formData.type === 'checkbox') {
          this.applyKintoneCheckboxRadio(formData, val);
        }
        else if (formData.type.includes('select')) {
          this.applyKintoneSelect(formData, val);
        }
        else {
          this.applyKintoneTextField(formData, val);
        }
      } catch (error) {
        debugLog('applyKintoneValues', `Error applying value to element`, { id, error });
      }
    });
  }

  isKintoneDateField(formData) {
    const fieldContainer = document.querySelector(`.field-${formData.kintoneFieldId}.control-date-field-gaia`);
    return !!fieldContainer;
  }

  applyValueToKintoneDateField(formData, val) {
    const fieldEl = document.querySelector(`.field-${formData.kintoneFieldId}`);
    if (!fieldEl) return;

    const inputEl = fieldEl.querySelector('input.input-date-text-cybozu');
    if (inputEl) {
      const oldVal = inputEl.value;
      inputEl.value = val;
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));

      if (inputEl.value !== val) {
        this.applyHiddenFallback(fieldEl, val);
      }
    }
  }

  applyHiddenFallback(containerEl, val) {
    const hiddenEl = containerEl.querySelector('input[type="hidden"]');
    if (!hiddenEl) {
      debugLog('applyHiddenFallback', 'No hidden element found', { val });
      return;
    }
    hiddenEl.value = val;
    hiddenEl.dispatchEvent(new Event('change', { bubbles: true }));
    hiddenEl.dispatchEvent(new Event('input', { bubbles: true }));
    debugLog('applyHiddenFallback', `Set hidden date = ${val}`);
  }

  applyKintoneCheckboxRadio(formData, val) {
    const groupName = formData.name || formData.id;
    const escapedName = CSS.escape(groupName);
    const inputs = document.querySelectorAll(`input[name="${escapedName}"]`);

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

  applyKintoneSelect(formData, val) {
    const escapedId = CSS.escape(formData.id);
    let selectEl = document.getElementById(formData.id)
                || document.querySelector(`select[name="${escapedId}"]`);
    if (!selectEl) {
      const fieldEl = document.querySelector(`.field-${formData.kintoneFieldId}`);
      if (fieldEl) {
        selectEl = fieldEl.querySelector('select');
      }
    }
    if (selectEl) {
      if (formData.type === 'select-multiple') {
        if (!Array.isArray(val)) {
          val = [val];
        }
        Array.from(selectEl.options).forEach(option => {
          option.selected = val.includes(option.value);
        });
      } else {
        selectEl.value = val;
      }
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  applyKintoneTextField(formData, val) {
    const element = this.findFormElement(formData.id);
    if (element) {
      const oldVal = element.value;
      element.value = val;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('input', { bubbles: true }));

      if (element.value !== val || element.readOnly) {
        const fieldEl = document.querySelector(`.field-${formData.kintoneFieldId}`);
        if (fieldEl) {
          this.applyHiddenFallback(fieldEl, val);
        }
      }
    }
  }

  applyRemoteXpath(xpath, value) {
    const node = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    if (node) {
      node.value = value;
      node.dispatchEvent(new Event('change', { bubbles: true }));
      node.dispatchEvent(new Event('input', { bubbles: true }));
      debugLog('applyKintoneValues', `Applied remote-xpath value`, { xpath, value });
    }
  }

  findFormElement(id) {
    let element = null;

    element = document.getElementById(id);
    if (element) return element;

    const escapedId = CSS.escape(id);
    element = document.querySelector(`#${escapedId}`);
    if (element) return element;

    element = document.querySelector(`[name="${escapedId}"]`);
    if (element) return element;

    try {
      const xpathResult = document.evaluate(
        `//*[@id="${id}"]`,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      element = xpathResult.singleNodeValue;
      if (element) return element;
    } catch (e) {
      // ignore
    }

    if (id.includes(':')) {
      const parts = id.split(':');
      const numericPart = parts[0];
      const elementsWithSimilarId = Array.from(
        document.querySelectorAll(`[id^="${numericPart}"]`)
      );
      if (elementsWithSimilarId.length > 0) {
        return elementsWithSimilarId[0];
      }
    }

    element = this.findElementInFormContainer(id);
    if (element) return element;

    const formData = this.forms.get(id);
    if (formData && formData.kintoneFieldId) {
      const fieldEl = document.querySelector(`.field-${formData.kintoneFieldId}`);
      if (fieldEl) {
        const subElement = fieldEl.querySelector('input, select, textarea');
        if (subElement) {
          return subElement;
        }
      }
    }

    return null;
  }

  findElementInFormContainer(id) {
    const formContainers = document.querySelectorAll('form, .form, [role="form"], .layout-gaia');
    for (const container of formContainers) {
      const inputs = container.querySelectorAll('input, select, textarea');
      for (const input of inputs) {
        if (input.id === id) return input;
        if (id.includes(':') && input.id && input.id.includes(id.split(':')[0])) {
          return input;
        }
        if (input.className && id.includes('-') && input.className.includes(id.split('-')[0])) {
          return input;
        }
      }
    }
    return null;
  }

  highlightForms() {
    try {
      this.forms.forEach(formData => {
        const id = formData.id;
        if (formData.type === 'radio' || formData.type === 'checkbox') {
          const groupName = formData.name || formData.id;
          const escapedName = CSS.escape(groupName);
          const inputs = document.querySelectorAll(`input[name="${escapedName}"]`);
          inputs.forEach(el => el.classList.add('form-control-highlight'));
        } else {
          const escapedId = CSS.escape(id);
          const element = document.querySelector(`#${escapedId}`)
                       || document.querySelector(`[name="${escapedId}"]`);
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

  refreshForms() {
    debugLog('refreshForms', 'Clearing and re-collecting forms');
    this.forms.clear();
    this.collectForms();
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
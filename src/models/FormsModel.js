
import { Model } from '../architecture.js';

/**
 * フォーム検出・操作用データモデルクラス
 * 
 * フォーム検出と操作のデータモデルを表します。
 * フォーム要素、そのプロパティ、操作を管理します。
 */
export class FormsModel extends Model {
  /**
   * コンストラクタ
   * 
   * @param {Object} data - モデルの初期データ
   */
  constructor(data = {}) {
    const defaultData = {
      forms: new Map(),
      initialized: false,
      debug: true,
      highlightedElements: [],
      ...data
    };
    
    super(defaultData);
  }
  
  /**
   * デバッグメッセージをログ出力
   * 
   * @param {string} section - コードのセクション
   * @param {string} message - ログメッセージ
   * @param {*} data - オプションのログデータ
   */
  debugLog(section, message, data = null) {
    if (!this.get('debug')) return;
    
    const log = `[FormObserver][${section}] ${message}`;
    console.log(log);
    
    if (data) {
      console.log('Data:', data);
    }
  }
  
  /**
   * モデルを初期化
   * 
   * @returns {FormsModel} - チェーンメソッド用のモデルインスタンス
   */
  initialize() {
    this.debugLog('initialize', 'Initializing FormsModel');
    
    if (this.get('initialized')) {
      this.debugLog('initialize', 'Already initialized, skipping');
      return this;
    }
    
    this.set('initialized', true);
    
    this.collectForms();
    
    return this;
  }
  
  /**
   * ページがKintoneページかチェック
   * 
   * @returns {boolean} - ページがKintoneページかどうか
   */
  isKintonePage() {
    return !!document.querySelector('.layout-gaia') || 
           !!document.querySelector('.gaia-argoui-app-view');
  }
  
  /**
   * ページからフォーム要素を収集
   * 
   * @returns {FormsModel} - チェーンメソッド用のモデルインスタンス
   */
  collectForms() {
    this.debugLog('collectForms', 'Starting form collection');
    
    const formElements = document.querySelectorAll('input, select, textarea');
    this.debugLog('collectForms', `Found ${formElements.length} total form elements`);
    
    const forms = new Map();
    
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
        forms.set(formData.id, formData);
      }
    });
    
    radioCheckboxGroupMap.forEach((groupData, groupKey) => {
      forms.set(groupKey, groupData);
    });
    
    this.set('forms', forms);
    this.debugLog('collectForms', `Collected ${forms.size} visible form items/groups`);
    
    return this;
  }
  
  /**
   * 要素が表示されているかチェック
   * 
   * @param {HTMLElement} element - チェックする要素
   * @returns {boolean} - 要素が表示されているかどうか
   */
  isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           element.offsetParent !== null &&
           element.getBoundingClientRect().height > 0 &&
           element.getBoundingClientRect().width > 0;
  }
  
  /**
   * 要素からフォームデータを抽出
   * 
   * @param {HTMLElement} element - フォーム要素
   * @param {number} index - 要素のインデックス
   * @param {string} forcedType - オプションの強制タイプ
   * @returns {Object} - フォームデータ
   */
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
      this.debugLog('extractFormData', 'Error extracting form data', error);
      return null;
    }
  }
  
  /**
   * 要素のラベルを検索
   * 
   * @param {HTMLElement} element - ラベルを検索する要素
   * @returns {string} - ラベルテキスト
   */
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
      this.debugLog('findLabel', 'Error finding label', error);
    }
    
    return label;
  }
  
  /**
   * 拡張メソッドを使用して要素のラベルを検索
   * 
   * @param {HTMLElement} element - ラベルを検索する要素
   * @returns {string} - ラベルテキスト
   */
  findLabelEnhanced(element) {
    let label = this.findLabel(element);
    if (label) return label;
    
    const methods = [
      this.findCybozuLabel,
      this.findParentContainerLabel,
      this.findAriaLabel,
      this.findTableHeaderLabel
    ];
    
    for (const method of methods) {
      label = method.call(this, element);
      if (label) return label;
    }
    
    if (element.id) {
      label = this.findLabelByFieldId(element.id);
      if (label) return label;
    }
    
    return element.placeholder || element.name || '';
  }
  
  /**
   * Cybozu (Kintone) ラベルを検索
   * 
   * @param {HTMLElement} element - ラベルを検索する要素
   * @returns {string} - ラベルテキスト
   */
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
  
  /**
   * 親コンテナー内でラベルを検索
   * 
   * @param {HTMLElement} element - ラベルを検索する要素
   * @returns {string} - ラベルテキスト
   */
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
  
  /**
   * ARIA属性を使用してラベルを検索
   * 
   * @param {HTMLElement} element - ラベルを検索する要素
   * @returns {string} - ラベルテキスト
   */
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
  
  /**
   * テーブルヘッダー内でラベルを検索
   * 
   * @param {HTMLElement} element - ラベルを検索する要素
   * @returns {string} - ラベルテキスト
   */
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
  
  /**
   * 要素IDからフィールドIDを抽出
   * 
   * @param {string} id - 要素ID
   * @returns {string|null} - フィールドID
   */
  extractFieldId(id) {
    const matches = id.match(/(\d+)_(\d+)/);
    if (matches && matches[2]) {
      return matches[2];
    }
    return null;
  }
  
  /**
   * フィールドIDでラベルを検索
   * 
   * @param {string} id - 要素ID
   * @returns {string} - ラベルテキスト
   */
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
  
  /**
   * すべてのフォームデータを取得
   * 
   * @returns {Array} - フォームデータオブジェクトの配列
   */
  getFormsData() {
    return Array.from(this.get('forms').values());
  }
  
  /**
   * フォーム要素をハイライト
   * 
   * @param {Array} formIds - ハイライトするフォームIDの配列
   * @param {Object} options - ハイライトオプション
   * @returns {FormsModel} - チェーンメソッド用のモデルインスタンス
   */
  highlight(formIds, options = {}) {
    this.debugLog('highlight', `Highlighting ${formIds.length} forms`, formIds);
    
    const defaultOptions = {
      color: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      borderColor: '#4CAF50',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderRadius: '4px',
      padding: '2px',
      transition: 'all 0.3s ease',
      pulseAnimation: true
    };
    
    const highlightOptions = { ...defaultOptions, ...options };
    
    this.removeHighlight();
    
    if (highlightOptions.pulseAnimation) {
      this.createPulseAnimationStyle();
    }
    
    formIds.forEach(id => {
      const formData = this.get('forms').get(id);
      if (!formData) {
        this.debugLog('highlight', `Form with ID ${id} not found`);
        return;
      }
      
      if (formData.type === 'radio' || formData.type === 'checkbox') {
        const groupName = formData.name || formData.id;
        const escapedName = CSS.escape(groupName);
        const inputs = document.querySelectorAll(`input[name="${escapedName}"]`);
        
        inputs.forEach(inputEl => {
          this.highlightElement(inputEl, highlightOptions);
        });
      } else {
        const element = this.findFormElement(id);
        if (element) {
          this.highlightElement(element, highlightOptions);
        } else {
          this.debugLog('highlight', `Element with ID ${id} not found in DOM`);
        }
      }
    });
    
    return this;
  }
  
  /**
   * パルスアニメーション用のスタイル要素を作成
   */
  createPulseAnimationStyle() {
    if (document.getElementById('form-highlight-pulse-animation')) {
      return;
    }
    
    const styleEl = document.createElement('style');
    styleEl.id = 'form-highlight-pulse-animation';
    styleEl.textContent = `
      @keyframes formHighlightPulse {
        0% {
          box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
        }
      }
      
      .form-highlight-pulse {
        animation: formHighlightPulse 2s infinite;
      }
    `;
    
    document.head.appendChild(styleEl);
  }
  
  /**
   * 単一要素をハイライト
   * 
   * @param {HTMLElement} element - ハイライトする要素
   * @param {Object} options - ハイライトオプション
   */
  highlightElement(element, options) {
    const originalStyles = {
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
      backgroundColor: element.style.backgroundColor,
      borderColor: element.style.borderColor,
      borderWidth: element.style.borderWidth,
      borderStyle: element.style.borderStyle,
      borderRadius: element.style.borderRadius,
      padding: element.style.padding,
      transition: element.style.transition
    };
    
    element.style.outline = `${options.borderWidth} ${options.borderStyle} ${options.borderColor}`;
    element.style.outlineOffset = '2px';
    element.style.backgroundColor = options.backgroundColor;
    element.style.borderColor = options.borderColor;
    element.style.borderWidth = options.borderWidth;
    element.style.borderStyle = options.borderStyle;
    element.style.borderRadius = options.borderRadius;
    element.style.padding = options.padding;
    element.style.transition = options.transition;
    
    if (options.pulseAnimation) {
      element.classList.add('form-highlight-pulse');
    }
    
    this.get('highlightedElements').push({
      element,
      originalStyles
    });
  }
  
  /**
   * すべてのハイライトを削除
   * 
   * @returns {FormsModel} - チェーンメソッド用のモデルインスタンス
   */
  removeHighlight() {
    this.debugLog('removeHighlight', 'Removing all highlights');
    
    this.get('highlightedElements').forEach(({ element, originalStyles }) => {
      Object.entries(originalStyles).forEach(([prop, value]) => {
        element.style[prop] = value;
      });
      
      element.classList.remove('form-highlight-pulse');
    });
    
    this.set('highlightedElements', []);
    
    return this;
  }
}
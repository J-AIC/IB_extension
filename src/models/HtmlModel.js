import { Model } from '../architecture.js';

/**
 * HTML表示・操作用データモデルクラス
 * 
 * HTML表示と操作のデータモデルを表します。
 * HTMLコンテンツ、テンプレート、それらの操作を管理します。
 */
export class HtmlModel extends Model {
  /**
   * コンストラクタ
   * 
   * @param {Object} data - モデルの初期データ
   */
  constructor(data = {}) {
    const defaultData = {
      templates: new Map(),
      renderedElements: new Map(),
      activeOverlays: [],
      initialized: false,
      debug: true,
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
    
    const log = `[HtmlModel][${section}] ${message}`;
    console.log(log);
    
    if (data) {
      console.log('Data:', data);
    }
  }
  
  /**
   * モデルを初期化
   * 
   * @returns {HtmlModel} - チェーンメソッド用のモデルインスタンス
   */
  initialize() {
    this.debugLog('initialize', 'Initializing HtmlModel');
    
    if (this.get('initialized')) {
      this.debugLog('initialize', 'Already initialized, skipping');
      return this;
    }
    
    this.set('initialized', true);
    
    this.registerDefaultTemplates();
    
    return this;
  }
  
  /**
   * デフォルトテンプレートを登録
   * 
   * @returns {HtmlModel} - チェーンメソッド用のモデルインスタンス
   */
  registerDefaultTemplates() {
    this.registerTemplate('tooltip', `
      <div class="ib-tooltip" role="tooltip">
        <div class="ib-tooltip-arrow"></div>
        <div class="ib-tooltip-inner"></div>
      </div>
    `);
    
    this.registerTemplate('modal', `
      <div class="ib-modal-backdrop"></div>
      <div class="ib-modal" role="dialog" aria-modal="true">
        <div class="ib-modal-dialog">
          <div class="ib-modal-content">
            <div class="ib-modal-header">
              <h5 class="ib-modal-title"></h5>
              <button type="button" class="ib-close" aria-label="Close">&times;</button>
            </div>
            <div class="ib-modal-body"></div>
            <div class="ib-modal-footer"></div>
          </div>
        </div>
      </div>
    `);
    
    this.registerTemplate('notification', `
      <div class="ib-notification">
        <div class="ib-notification-icon"></div>
        <div class="ib-notification-content">
          <div class="ib-notification-title"></div>
          <div class="ib-notification-message"></div>
        </div>
        <button type="button" class="ib-notification-close" aria-label="Close">&times;</button>
      </div>
    `);
    
    this.registerTemplate('overlay', `
      <div class="ib-overlay">
        <div class="ib-overlay-content"></div>
      </div>
    `);
    
    this.registerTemplate('popover', `
      <div class="ib-popover" role="tooltip">
        <div class="ib-popover-arrow"></div>
        <h3 class="ib-popover-header"></h3>
        <div class="ib-popover-body"></div>
      </div>
    `);
    
    return this;
  }
  
  /**
   * テンプレートを登録
   * 
   * @param {string} name - テンプレート名
   * @param {string} html - テンプレートHTML
   * @returns {HtmlModel} - チェーンメソッド用のモデルインスタンス
   */
  registerTemplate(name, html) {
    const templates = this.get('templates');
    templates.set(name, html.trim());
    this.set('templates', templates);
    
    this.debugLog('registerTemplate', `Registered template: ${name}`);
    return this;
  }
  
  /**
   * テンプレートを取得
   * 
   * @param {string} name - テンプレート名
   * @returns {string|null} - テンプレートHTMLまたは見つからない場合はnull
   */
  getTemplate(name) {
    return this.get('templates').get(name) || null;
  }
  
  /**
   * データでテンプレートをレンダリング
   * 
   * @param {string} templateName - テンプレート名
   * @param {Object} data - テンプレートをレンダリングするデータ
   * @returns {string} - レンダリングされたHTML
   */
  renderTemplate(templateName, data = {}) {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }
    
    let rendered = template;
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, value);
    });
    
    return rendered;
  }
  
  /**
   * HTMLから要素を作成
   * 
   * @param {string} html - 要素を作成するHTML
   * @returns {HTMLElement} - 作成された要素
   */
  createElementFromHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }
  
  /**
   * DOMに要素をレンダリング
   * 
   * @param {string} templateName - テンプレート名
   * @param {Object} data - テンプレートをレンダリングするデータ
   * @param {string} targetSelector - ターゲット要素のセレクター
   * @param {string} position - 要素を挿入する位置 (beforebegin, afterbegin, beforeend, afterend)
   * @returns {HTMLElement} - レンダリングされた要素
   */
  renderElement(templateName, data = {}, targetSelector = 'body', position = 'beforeend') {
    const renderedHtml = this.renderTemplate(templateName, data);
    const element = this.createElementFromHtml(renderedHtml);
    
    const target = document.querySelector(targetSelector);
    if (!target) {
      throw new Error(`Target element not found: ${targetSelector}`);
    }
    
    target.insertAdjacentElement(position, element);
    
    const renderedElements = this.get('renderedElements');
    const id = `${templateName}-${Date.now()}`;
    renderedElements.set(id, { element, templateName, data });
    this.set('renderedElements', renderedElements);
    
    element.setAttribute('data-ib-id', id);
    
    this.debugLog('renderElement', `Rendered element: ${templateName}`, { id, element });
    return element;
  }
  
  /**
   * レンダリングされた要素を削除
   * 
   * @param {string} id - 要素ID
   * @returns {HtmlModel} - チェーンメソッド用のモデルインスタンス
   */
  removeElement(id) {
    const renderedElements = this.get('renderedElements');
    const elementData = renderedElements.get(id);
    
    if (elementData) {
      const { element } = elementData;
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
      
      renderedElements.delete(id);
      this.set('renderedElements', renderedElements);
      
      this.debugLog('removeElement', `Removed element: ${id}`);
    }
    
    return this;
  }
  
  /**
   * オーバーレイを作成
   * 
   * @param {Object} options - オーバーレイオプション
   * @returns {HTMLElement} - オーバーレイ要素
   */
  createOverlay(options = {}) {
    const defaultOptions = {
      content: '',
      className: '',
      closeOnClick: true,
      closeOnEscape: true,
      zIndex: 1000,
      duration: 300
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    const overlay = this.createElementFromHtml(`
      <div class="ib-overlay ${mergedOptions.className}" style="z-index: ${mergedOptions.zIndex}">
        <div class="ib-overlay-content">${mergedOptions.content}</div>
      </div>
    `);
    
    document.body.appendChild(overlay);
    
    const activeOverlays = this.get('activeOverlays');
    activeOverlays.push({ element: overlay, options: mergedOptions });
    this.set('activeOverlays', activeOverlays);
    
    if (mergedOptions.closeOnClick) {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          this.removeOverlay(overlay);
        }
      });
    }
    
    if (mergedOptions.closeOnEscape) {
      const escapeHandler = (event) => {
        if (event.key === 'Escape') {
          this.removeOverlay(overlay);
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    }
    
    setTimeout(() => {
      overlay.classList.add('ib-overlay-visible');
    }, 10);
    
    this.debugLog('createOverlay', 'Created overlay', { overlay, options: mergedOptions });
    return overlay;
  }
  
  /**
   * オーバーレイを削除
   * 
   * @param {HTMLElement} overlay - オーバーレイ要素
   * @returns {HtmlModel} - チェーンメソッド用のモデルインスタンス
   */
  removeOverlay(overlay) {
    const activeOverlays = this.get('activeOverlays');
    const overlayData = activeOverlays.find(data => data.element === overlay);
    
    if (overlayData) {
      const { element, options } = overlayData;
      
        element.classList.remove('ib-overlay-visible');
      
      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
        
        const updatedOverlays = activeOverlays.filter(data => data.element !== element);
        this.set('activeOverlays', updatedOverlays);
        
        this.debugLog('removeOverlay', 'Removed overlay', { element });
      }, options.duration);
    }
    
    return this;
  }
  
  /**
   * すべてのオーバーレイを削除
   * 
   * @returns {HtmlModel} - チェーンメソッド用のモデルインスタンス
   */
  removeAllOverlays() {
    const activeOverlays = this.get('activeOverlays');
    
    activeOverlays.forEach(({ element }) => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    this.set('activeOverlays', []);
    this.debugLog('removeAllOverlays', 'Removed all overlays');
    
    return this;
  }
  
  /**
   * ツールチップを作成
   * 
   * @param {HTMLElement} target - ターゲット要素
   * @param {Object} options - ツールチップオプション
   * @returns {HTMLElement} - ツールチップ要素
   */
  createTooltip(target, options = {}) {
    const defaultOptions = {
      content: '',
      position: 'top',
      className: '',
      duration: 200,
      showDelay: 200,
      hideDelay: 200
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    const tooltip = this.createElementFromHtml(`
      <div class="ib-tooltip ib-tooltip-${mergedOptions.position} ${mergedOptions.className}">
        <div class="ib-tooltip-arrow"></div>
        <div class="ib-tooltip-inner">${mergedOptions.content}</div>
      </div>
    `);
    
    document.body.appendChild(tooltip);
    
    this.positionTooltip(tooltip, target, mergedOptions.position);
    
    setTimeout(() => {
      tooltip.classList.add('ib-tooltip-visible');
    }, mergedOptions.showDelay);
    
    const renderedElements = this.get('renderedElements');
    const id = `tooltip-${Date.now()}`;
    renderedElements.set(id, { 
      element: tooltip, 
      templateName: 'tooltip', 
      data: { target, options: mergedOptions } 
    });
    this.set('renderedElements', renderedElements);
    
    tooltip.setAttribute('data-ib-id', id);
    
    this.debugLog('createTooltip', 'Created tooltip', { tooltip, target, options: mergedOptions });
    return tooltip;
  }
  
  /**
   * ツールチップを配置
   * 
   * @param {HTMLElement} tooltip - ツールチップ要素
   * @param {HTMLElement} target - ターゲット要素
   * @param {string} position - ツールチップの位置 (top, right, bottom, left)
   */
  positionTooltip(tooltip, target, position) {
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let top, left;
    
    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.right;
        break;
      case 'bottom':
        top = targetRect.bottom;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.left - tooltipRect.width;
        break;
    }
    
    top += window.scrollY;
    left += window.scrollX;
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }
  
  /**
   * ツールチップを削除
   * 
   * @param {HTMLElement} tooltip - ツールチップ要素
   * @returns {HtmlModel} - チェーンメソッド用のモデルインスタンス
   */
  removeTooltip(tooltip) {
    const renderedElements = this.get('renderedElements');
    let tooltipId = null;
    
    for (const [id, data] of renderedElements.entries()) {
      if (data.element === tooltip) {
        tooltipId = id;
        break;
      }
    }
    
    if (tooltipId) {
      const tooltipData = renderedElements.get(tooltipId);
      const { options } = tooltipData.data;
      
      tooltip.classList.remove('ib-tooltip-visible');
      
      setTimeout(() => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
        
        renderedElements.delete(tooltipId);
        this.set('renderedElements', renderedElements);
        
        this.debugLog('removeTooltip', 'Removed tooltip', { tooltipId });
      }, options.duration);
    }
    
    return this;
  }
}
/**
 * HtmlController.js - HTML表示と操作のコントローラー
 */

import { Controller } from '../architecture.js';
import { HtmlModel } from '../models/HtmlModel.js';

/**
 * HtmlController クラス
 * HTML表示と操作のビジネスロジックを処理
 */
export class HtmlController extends Controller {
  /**
   * コンストラクタ
   * 
   * @param {Object} options - コントローラーオプション
   */
  constructor(options = {}) {
    super(options);
    
    if (!this.model) {
      this.model = new HtmlModel();
    }
    
    this.model.initialize();
  }
  
  /**
   * テンプレートを登録
   * 
   * @param {string} name - テンプレート名
   * @param {string} html - テンプレートHTML
   * @returns {HtmlController} メソッドチェーン用コントローラーインスタンス
   */
  registerTemplate(name, html) {
    this.model.registerTemplate(name, html);
    return this;
  }
  
  /**
   * テンプレートを取得
   * 
   * @param {string} name - テンプレート名
   * @returns {string|null} テンプレートHTMLまたはnull（見つからない場合）
   */
  getTemplate(name) {
    return this.model.getTemplate(name);
  }
  
  /**
   * データでテンプレートをレンダリング
   * 
   * @param {string} templateName - テンプレート名
   * @param {Object} data - テンプレートレンダリング用データ
   * @returns {string} レンダリングされたHTML
   */
  renderTemplate(templateName, data = {}) {
    return this.model.renderTemplate(templateName, data);
  }
  
  /**
   * HTMLから要素を作成
   * 
   * @param {string} html - 要素作成用HTML
   * @returns {HTMLElement} 作成された要素
   */
  createElementFromHtml(html) {
    return this.model.createElementFromHtml(html);
  }
  
  /**
   * 要素をDOMにレンダリング
   * 
   * @param {string} templateName - テンプレート名
   * @param {Object} data - テンプレートレンダリング用データ
   * @param {string} targetSelector - ターゲット要素のセレクター
   * @param {string} position - 要素の挿入位置（beforebegin, afterbegin, beforeend, afterend）
   * @returns {HTMLElement} レンダリングされた要素
   */
  renderElement(templateName, data = {}, targetSelector = 'body', position = 'beforeend') {
    return this.model.renderElement(templateName, data, targetSelector, position);
  }
  
  /**
   * レンダリングされた要素を削除
   * 
   * @param {string} id - 要素ID
   * @returns {HtmlController} メソッドチェーン用コントローラーインスタンス
   */
  removeElement(id) {
    this.model.removeElement(id);
    return this;
  }
  
  /**
   * オーバーレイを作成
   * 
   * @param {Object} options - オーバーレイオプション
   * @returns {HTMLElement} オーバーレイ要素
   */
  createOverlay(options = {}) {
    return this.model.createOverlay(options);
  }
  
  /**
   * オーバーレイを削除
   * 
   * @param {HTMLElement} overlay - オーバーレイ要素
   * @returns {HtmlController} メソッドチェーン用コントローラーインスタンス
   */
  removeOverlay(overlay) {
    this.model.removeOverlay(overlay);
    return this;
  }
  
  /**
   * すべてのオーバーレイを削除
   * 
   * @returns {HtmlController} メソッドチェーン用コントローラーインスタンス
   */
  removeAllOverlays() {
    this.model.removeAllOverlays();
    return this;
  }
  
  /**
   * ツールチップを作成
   * 
   * @param {HTMLElement} target - ターゲット要素
   * @param {Object} options - ツールチップオプション
   * @returns {HTMLElement} ツールチップ要素
   */
  createTooltip(target, options = {}) {
    return this.model.createTooltip(target, options);
  }
  
  /**
   * ツールチップを削除
   * 
   * @param {HTMLElement} tooltip - ツールチップ要素
   * @returns {HtmlController} メソッドチェーン用コントローラーインスタンス
   */
  removeTooltip(tooltip) {
    this.model.removeTooltip(tooltip);
    return this;
  }
  
  /**
   * 通知を表示
   * 
   * @param {Object} options - 通知オプション
   * @returns {HTMLElement} 通知要素
   */
  showNotification(options = {}) {
    const defaultOptions = {
      title: '',
      message: '',
      type: 'info',
      duration: 5000,
      position: 'top-right',
      closable: true
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    const notification = this.model.renderElement('notification', {
      title: mergedOptions.title,
      message: mergedOptions.message
    });
    
    notification.classList.add(`ib-notification-${mergedOptions.type}`);
    notification.classList.add(`ib-notification-${mergedOptions.position}`);
    
    if (mergedOptions.closable) {
      const closeButton = notification.querySelector('.ib-notification-close');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          this.closeNotification(notification);
        });
      }
    } else {
      const closeButton = notification.querySelector('.ib-notification-close');
      if (closeButton) {
        closeButton.remove();
      }
    }
    
    if (mergedOptions.duration > 0) {
      setTimeout(() => {
        this.closeNotification(notification);
      }, mergedOptions.duration);
    }
    
    setTimeout(() => {
      notification.classList.add('ib-notification-visible');
    }, 10);
    
    return notification;
  }
  
  /**
   * 通知を閉じる
   * 
   * @param {HTMLElement} notification - 通知要素
   * @returns {HtmlController} メソッドチェーン用コントローラーインスタンス
   */
  closeNotification(notification) {
    notification.classList.remove('ib-notification-visible');
    
    setTimeout(() => {
      const id = notification.getAttribute('data-ib-id');
      if (id) {
        this.removeElement(id);
      } else if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
    
    return this;
  }
  
  /**
   * モーダルダイアログを表示
   * 
   * @param {Object} options - モーダルオプション
   * @returns {HTMLElement} モーダル要素
   */
  showModal(options = {}) {
    const defaultOptions = {
      title: '',
      content: '',
      footer: '',
      size: 'medium',
      closeOnBackdrop: true,
      closeOnEscape: true,
      onClose: null,
      onConfirm: null,
      confirmText: 'OK',
      cancelText: 'Cancel',
      showFooterButtons: true
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    const modal = this.model.renderElement('modal', {
      title: mergedOptions.title
    });
    
    modal.querySelector('.ib-modal-dialog').classList.add(`ib-modal-${mergedOptions.size}`);
    
    const modalBody = modal.querySelector('.ib-modal-body');
    if (modalBody) {
      if (typeof mergedOptions.content === 'string') {
        modalBody.innerHTML = mergedOptions.content;
      } else if (mergedOptions.content instanceof HTMLElement) {
        modalBody.appendChild(mergedOptions.content);
      }
    }
    
    const modalFooter = modal.querySelector('.ib-modal-footer');
    if (modalFooter) {
      if (mergedOptions.showFooterButtons) {
        if (mergedOptions.onConfirm) {
          const confirmButton = document.createElement('button');
          confirmButton.className = 'ib-btn ib-btn-primary';
          confirmButton.textContent = mergedOptions.confirmText;
          confirmButton.addEventListener('click', () => {
            mergedOptions.onConfirm();
            this.closeModal(modal);
          });
          modalFooter.appendChild(confirmButton);
        }
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'ib-btn ib-btn-secondary';
        cancelButton.textContent = mergedOptions.cancelText;
        cancelButton.addEventListener('click', () => {
          this.closeModal(modal);
        });
        modalFooter.appendChild(cancelButton);
      } else if (typeof mergedOptions.footer === 'string') {
        modalFooter.innerHTML = mergedOptions.footer;
      } else if (mergedOptions.footer instanceof HTMLElement) {
        modalFooter.appendChild(mergedOptions.footer);
      }
    }
    
    const closeButton = modal.querySelector('.ib-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.closeModal(modal);
      });
    }
    
    if (mergedOptions.closeOnBackdrop) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          this.closeModal(modal);
        }
      });
    }
    
    if (mergedOptions.closeOnEscape) {
      const escapeHandler = (event) => {
        if (event.key === 'Escape') {
          this.closeModal(modal);
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    }
    
    setTimeout(() => {
      modal.classList.add('ib-modal-visible');
      document.body.classList.add('ib-modal-open');
    }, 10);
    
    return modal;
  }
  
  /**
   * モーダルダイアログを閉じる
   * 
   * @param {HTMLElement} modal - モーダル要素
   * @returns {HtmlController} メソッドチェーン用コントローラーインスタンス
   */
  closeModal(modal) {
    modal.classList.remove('ib-modal-visible');
    
    setTimeout(() => {
      const id = modal.getAttribute('data-ib-id');
      if (id) {
        this.removeElement(id);
      } else if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      
      document.body.classList.remove('ib-modal-open');
    }, 300);
    
    return this;
  }
  
  /**
   * ポップオーバーを表示
   * 
   * @param {HTMLElement} target - ターゲット要素
   * @param {Object} options - ポップオーバーオプション
   * @returns {HTMLElement} ポップオーバー要素
   */
  showPopover(target, options = {}) {
    const defaultOptions = {
      title: '',
      content: '',
      position: 'top',
      trigger: 'click',
      closeOnClickOutside: true
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    const popover = this.model.renderElement('popover', {
      title: mergedOptions.title
    });
    
    popover.classList.add(`ib-popover-${mergedOptions.position}`);
    
    const popoverBody = popover.querySelector('.ib-popover-body');
    if (popoverBody) {
      if (typeof mergedOptions.content === 'string') {
        popoverBody.innerHTML = mergedOptions.content;
      } else if (mergedOptions.content instanceof HTMLElement) {
        popoverBody.appendChild(mergedOptions.content);
      }
    }
    
    this.positionElement(popover, target, mergedOptions.position);
    
    setTimeout(() => {
      popover.classList.add('ib-popover-visible');
    }, 10);
    
    if (mergedOptions.closeOnClickOutside) {
      const clickOutsideHandler = (event) => {
        if (!popover.contains(event.target) && event.target !== target) {
          this.closePopover(popover);
          document.removeEventListener('click', clickOutsideHandler);
        }
      };
      
      setTimeout(() => {
        document.addEventListener('click', clickOutsideHandler);
      }, 100);
    }
    
    return popover;
  }
  
  /**
   * ポップオーバーを閉じる
   * 
   * @param {HTMLElement} popover - ポップオーバー要素
   * @returns {HtmlController} メソッドチェーン用コントローラーインスタンス
   */
  closePopover(popover) {
    popover.classList.remove('ib-popover-visible');
    
    setTimeout(() => {
      const id = popover.getAttribute('data-ib-id');
      if (id) {
        this.removeElement(id);
      } else if (popover.parentNode) {
        popover.parentNode.removeChild(popover);
      }
    }, 300);
    
    return this;
  }
  
  /**
   * ターゲットに対して要素を配置
   * 
   * @param {HTMLElement} element - 配置する要素
   * @param {HTMLElement} target - ターゲット要素
   * @param {string} position - 配置位置（top, right, bottom, left）
   */
  positionElement(element, target, position) {
    const targetRect = target.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    let top, left;
    
    switch (position) {
      case 'top':
        top = targetRect.top - elementRect.height;
        left = targetRect.left + (targetRect.width / 2) - (elementRect.width / 2);
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (elementRect.height / 2);
        left = targetRect.right;
        break;
      case 'bottom':
        top = targetRect.bottom;
        left = targetRect.left + (targetRect.width / 2) - (elementRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (elementRect.height / 2);
        left = targetRect.left - elementRect.width;
        break;
    }
    
    top += window.scrollY;
    left += window.scrollX;
    
    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
  }
}
/**
 * HomeView.js
 * 
 * This file defines the HomeView class, which represents the view for the home page.
 * It extends the base View class from the architecture.js file.
 */

import { View } from '../architecture.js';

/**
 * HomeView class
 * 
 * Represents the view for the home page.
 * Renders content, loading states, and error messages.
 */
export class HomeView extends View {
  /**
   * Constructor
   * 
   * @param {HTMLElement|string} element - The DOM element or selector for the view
   * @param {Object} model - The home model
   * @param {Object} [options={}] - Additional options for the view
   */
  constructor(element, model, options = {}) {
    super(element, model);
    
    this.options = {
      loadingTemplate: '<div class="loading"><span data-i18n="loadingContent">Loading content...</span></div>',
      errorTemplate: (error) => `
        <div class="container">
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            ${error || chrome.i18n.getMessage('errorLoadingContent')}
          </div>
        </div>
      `,
      ...options
    };
    
    // Initialize the view
    this.initialize();
  }
  
  /**
   * Initialize the view
   */
  initialize() {
    // No additional initialization needed for now
  }
  
  /**
   * Handle model changes
   * 
   * @param {Object} change - The change object
   * @param {Object} model - The model
   */
  onModelChange(change, model) {
    if (change.key === 'content') {
      this.render();
    }
  }
  
  /**
   * Render the view
   * 
   * @returns {HomeView} - The view instance for chaining
   */
  render() {
    const content = this.model.get('content');
    
    if (content.isLoading) {
      this.renderLoading();
    } else if (content.error) {
      this.renderError(content.error);
    } else if (content.html) {
      this.renderContent(content.html);
    } else {
      this.renderLoading();
    }
    
    return this;
  }
  
  /**
   * Render loading state
   * 
   * @returns {HomeView} - The view instance for chaining
   */
  renderLoading() {
    this.element.innerHTML = this.options.loadingTemplate;
    return this;
  }
  
  /**
   * Render error state
   * 
   * @param {string} error - The error message
   * @returns {HomeView} - The view instance for chaining
   */
  renderError(error) {
    this.element.innerHTML = this.options.errorTemplate(error);
    return this;
  }
  
  /**
   * Render content
   * 
   * @param {string} html - The HTML content
   * @returns {HomeView} - The view instance for chaining
   */
  renderContent(html) {
    this.element.innerHTML = html;
    
    // Apply internationalization to any elements with data-i18n attribute
    this.applyI18n();
    
    // Set up event listeners for action cards
    this.setupActionCardListeners();
    
    return this;
  }
  
  /**
   * Apply internationalization to elements with data-i18n attribute
   * 
   * @returns {HomeView} - The view instance for chaining
   */
  applyI18n() {
    if (typeof chrome !== 'undefined' && chrome.i18n) {
      const i18nElements = this.element.querySelectorAll('[data-i18n]');
      i18nElements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = chrome.i18n.getMessage(key);
        if (translation) {
          element.textContent = translation;
        }
      });
    }
    
    return this;
  }
  
  /**
   * Set up event listeners for action cards
   * 
   * @returns {HomeView} - The view instance for chaining
   */
  setupActionCardListeners() {
    const actionCards = this.element.querySelectorAll('.action-card[data-action]');
    
    actionCards.forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const action = card.getAttribute('data-action');
        this.handleActionCardClick(action);
      });
    });
    
    return this;
  }
  
  /**
   * Handle action card click events
   * 
   * @param {string} action - The action to perform
   */
  handleActionCardClick(action) {
    switch (action) {
      case 'open-chat':
        this.openFullScreenChat();
        break;
      case 'api-settings':
        window.location.href = 'api_settings.html';
        break;
      case 'guide-url':
        window.location.href = 'guide_url.html';
        break;
      case 'system-prompts':
        window.location.href = 'system_prompts.html';
        break;
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }
  
  /**
   * Open the full-screen standalone chat
   */
  openFullScreenChat() {
    try {
      // Open the standalone chat in a new tab
      const chatUrl = chrome.runtime.getURL('chat-standalone.html');
      chrome.tabs.create({ url: chatUrl });
    } catch (error) {
      console.error('Error opening full-screen chat:', error);
      // Fallback: open in same window
      window.location.href = 'chat-standalone.html';
    }
  }
}

/**
 * HomeViewインスタンスを作成するファクトリ関数
 * 
 * @param {Object} container - 依存性注入コンテナ
 * @returns {HomeView} HomeViewインスタンス
 */
export const createHomeView = (container) => {
  const homeModel = container.get('homeModel');
  const element = document.querySelector('#homeContent');
  
  return new HomeView(element, homeModel);
};
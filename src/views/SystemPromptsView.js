/**
 * System Prompts View Class
 * Handles the rendering and user interactions for system prompt management
 */

import { View } from '../architecture.js';
import { apiConfigs } from '../models/ApiSettingsModel.js';

/**
 * System Prompts View Class
 * Manages the UI for system prompt configuration across all API providers
 */
export class SystemPromptsView extends View {
  /**
   * Constructor
   * 
   * @param {HTMLElement|string} element - DOM element or selector for the view
   * @param {Object} model - API settings model
   * @param {Object} [options={}] - Additional view options
   */
  constructor(element, model, options = {}) {
    super(element, model);
    
    this.options = {
      cardTemplateId: 'promptCardTemplate',
      ...options
    };
    
    this.cardTemplate = document.getElementById(this.options.cardTemplateId);
    
    // Preset prompts library
    this.presetPrompts = {
      helpful: "You are a helpful and knowledgeable assistant. Always provide accurate, detailed, and useful responses. Be polite, professional, and ensure your answers are well-structured and easy to understand.",
      creative: "You are a creative and imaginative assistant. Think outside the box, provide unique perspectives, and help with creative tasks like writing, brainstorming, and artistic projects. Be inspiring and original in your responses.",
      analytical: "You are an analytical and logical assistant. Focus on data-driven insights, critical thinking, and systematic problem-solving. Break down complex issues into manageable parts and provide evidence-based recommendations.",
      teacher: "You are a patient and encouraging teacher. Explain concepts clearly, use examples and analogies, and adapt your teaching style to the learner's level. Always be supportive and help build understanding step by step.",
      professional: "You are a professional business assistant. Provide formal, concise, and result-oriented responses. Focus on efficiency, best practices, and actionable advice for workplace and business contexts.",
      casual: "You are a friendly and casual conversational partner. Use a relaxed tone, be approachable, and communicate in a natural, conversational style while still being helpful and informative."
    };
    
    this.initialize();
  }
  
  /**
   * Initialize the view
   */
  initialize() {
    this.createPromptCards();
  }
  
  /**
   * Create prompt cards for all API providers
   */
  createPromptCards() {
    if (!this.element || !this.cardTemplate) return;
    
    this.element.innerHTML = '';
    
    // Check if any API providers have been configured
    const hasConfiguredProviders = Object.keys(apiConfigs).some(apiId => 
      this.model.getApiKey(apiId)
    );
    
    if (!hasConfiguredProviders) {
      this.showNoProvidersState();
      return;
    }
    
    // Create cards only for configured providers
    Object.entries(apiConfigs).forEach(([apiId, config]) => {
      if (this.model.getApiKey(apiId)) {
        const card = this.createPromptCard(apiId, config);
        this.element.appendChild(card);
      }
    });
  }
  
  /**
   * Create a prompt card for a specific API provider
   * 
   * @param {string} apiId - API provider ID
   * @param {Object} config - API provider configuration
   * @returns {HTMLElement} Prompt card element
   */
  createPromptCard(apiId, config) {
    const card = this.cardTemplate.content.cloneNode(true);
    const cardElement = card.querySelector('.prompt-card');
    
    // Set up provider information
    const providerIcon = cardElement.querySelector('.provider-icon');
    const providerName = cardElement.querySelector('.provider-name');
    const statusBadge = cardElement.querySelector('.status-badge');
    const statusText = cardElement.querySelector('.status-text');
    
    providerIcon.textContent = config.name.substring(0, 2).toUpperCase();
    providerName.textContent = config.name;
    
    // Set up status
    const isActive = this.model.getActiveApi() === apiId;
    statusBadge.className = `status-badge ${isActive ? 'status-active' : 'status-inactive'}`;
    statusText.textContent = isActive ? 'Active' : 'Inactive';
    
    // Set up textarea and character counter
    const textarea = cardElement.querySelector('.prompt-textarea');
    const charCounter = cardElement.querySelector('.current-count');
    const existingPrompt = this.model.getSystemPrompt(apiId);
    
    textarea.value = existingPrompt;
    charCounter.textContent = existingPrompt.length;
    
    // Auto-resize textarea
    this.autoResizeTextarea(textarea);
    
    // Set up event listeners
    this.setupCardEventListeners(cardElement, apiId, textarea, charCounter);
    
    return cardElement;
  }
  
  /**
   * Set up event listeners for a prompt card
   * 
   * @param {HTMLElement} cardElement - Card element
   * @param {string} apiId - API provider ID
   * @param {HTMLTextAreaElement} textarea - Textarea element
   * @param {HTMLElement} charCounter - Character counter element
   */
  setupCardEventListeners(cardElement, apiId, textarea, charCounter) {
    // Preset buttons
    const presetButtons = cardElement.querySelectorAll('.preset-btn');
    presetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const preset = button.dataset.preset;
        if (this.presetPrompts[preset]) {
          textarea.value = this.presetPrompts[preset];
          charCounter.textContent = textarea.value.length;
          this.autoResizeTextarea(textarea);
          
          // Visual feedback
          button.style.transform = 'scale(0.95)';
          setTimeout(() => {
            button.style.transform = '';
          }, 150);
        }
      });
    });
    
    // Textarea input event
    textarea.addEventListener('input', () => {
      charCounter.textContent = textarea.value.length;
      this.autoResizeTextarea(textarea);
    });
    
    // Save button
    const saveButton = cardElement.querySelector('.save-btn');
    saveButton.addEventListener('click', async () => {
      const prompt = textarea.value.trim();
      await this.controller.handleAction('setSystemPrompt', {
        provider: apiId,
        prompt: prompt
      });
      
      // Visual feedback
      const originalContent = saveButton.innerHTML;
      saveButton.innerHTML = '<i class="bi bi-check me-1"></i>Saved!';
      saveButton.disabled = true;
      
      setTimeout(() => {
        saveButton.innerHTML = originalContent;
        saveButton.disabled = false;
      }, 2000);
    });
    
    // Reset button
    const resetButton = cardElement.querySelector('.reset-btn');
    resetButton.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear this system prompt?')) {
        textarea.value = '';
        charCounter.textContent = '0';
        this.autoResizeTextarea(textarea);
        textarea.focus();
      }
    });
  }
  
  /**
   * Auto-resize textarea based on content
   * 
   * @param {HTMLTextAreaElement} textarea - Textarea element
   */
  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(120, textarea.scrollHeight) + 'px';
  }
  
  /**
   * Show the no providers configured state
   */
  showNoProvidersState() {
    this.element.innerHTML = `
      <div class="no-prompts-state">
        <i class="bi bi-gear"></i>
        <h3>No API Providers Configured</h3>
        <p>Please configure at least one API provider in the <a href="api_settings.html">API Settings</a> to manage system prompts.</p>
        <a href="api_settings.html" class="btn btn-primary">
          <i class="bi bi-gear me-2"></i>
          Go to API Settings
        </a>
      </div>
    `;
  }
  
  /**
   * Handle model changes
   * 
   * @param {Object} change - Change event
   * @param {Object} model - Model instance
   */
  onModelChange(change, model) {
    // Re-render cards when API settings change
    if (change.property === 'apiKeys' || change.property === 'activeApi') {
      this.createPromptCards();
    }
  }
  
  /**
   * Render the view
   */
  render() {
    this.createPromptCards();
  }
}
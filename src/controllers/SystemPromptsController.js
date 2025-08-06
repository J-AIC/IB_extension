/**
 * System Prompts Controller
 * Manages business logic for system prompt configuration
 */

import { Controller } from '../architecture.js';

/**
 * System Prompts Controller Class
 * Handles user actions and business logic for system prompt management
 */
export class SystemPromptsController extends Controller {
  /**
   * Constructor
   * 
   * @param {Object} model - API settings model
   * @param {Object} view - System prompts view
   * @param {Object} [services={}] - Services used by the controller
   */
  constructor(model, view, services = {}) {
    super(model, view);
    
    this.services = {
      storage: null,
      ...services
    };
  }
  
  /**
   * Handle user actions
   * 
   * @param {string} action - Action to process
   * @param {Object} data - Action data
   */
  async handleAction(action, data) {
    switch (action) {
      case 'setSystemPrompt':
        await this.setSystemPrompt(data.provider, data.prompt);
        break;
        
      case 'resetSystemPrompt':
        await this.resetSystemPrompt(data.provider);
        break;
        
      case 'validatePrompt':
        return this.validatePrompt(data.prompt);
        
      case 'refreshView':
        this.view.render();
        break;
        
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }
  
  /**
   * Set system prompt for a provider
   * 
   * @param {string} provider - API provider ID
   * @param {string} prompt - System prompt text
   */
  async setSystemPrompt(provider, prompt) {
    try {
      if (!provider) {
        throw new Error('Provider is required');
      }
      
      // Validate the prompt
      const validation = this.validatePrompt(prompt);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }
      
      // Set the system prompt in the model
      this.model.setSystemPrompt(provider, prompt);
      
      // Save to storage
      await this.saveSettings();
      
      console.log(`System prompt set for provider: ${provider}`);
      
    } catch (error) {
      console.error(`Failed to set system prompt for provider ${provider}:`, error);
      throw error; // Re-throw so the view can handle it
    }
  }
  
  /**
   * Reset system prompt for a provider
   * 
   * @param {string} provider - API provider ID
   */
  async resetSystemPrompt(provider) {
    try {
      if (!provider) {
        throw new Error('Provider is required');
      }
      
      // Clear the system prompt
      this.model.setSystemPrompt(provider, '');
      
      // Save to storage
      await this.saveSettings();
      
      console.log(`System prompt reset for provider: ${provider}`);
      
    } catch (error) {
      console.error(`Failed to reset system prompt for provider ${provider}:`, error);
      throw error;
    }
  }
  
  /**
   * Validate a system prompt
   * 
   * @param {string} prompt - Prompt to validate
   * @returns {Object} Validation result
   */
  validatePrompt(prompt) {
    const result = {
      isValid: true,
      message: ''
    };
    
    // Check length constraints
    if (prompt && prompt.length > 2000) {
      result.isValid = false;
      result.message = 'System prompt must be 2000 characters or less';
      return result;
    }
    
    // Check for potentially problematic content
    if (prompt && prompt.includes('<?php')) {
      result.isValid = false;
      result.message = 'System prompt contains potentially unsafe content';
      return result;
    }
    
    // Additional validation rules can be added here
    
    return result;
  }
  
  /**
   * Get system prompt for a provider
   * 
   * @param {string} provider - API provider ID
   * @returns {string} System prompt
   */
  getSystemPrompt(provider) {
    return this.model.getSystemPrompt(provider);
  }
  
  /**
   * Get all configured system prompts
   * 
   * @returns {Object} Object with provider IDs as keys and prompts as values
   */
  getAllSystemPrompts() {
    const prompts = {};
    const systemPrompts = this.model.get('systemPrompts') || {};
    
    // Only return prompts for providers that have API keys
    Object.keys(systemPrompts).forEach(provider => {
      if (this.model.getApiKey(provider)) {
        prompts[provider] = systemPrompts[provider];
      }
    });
    
    return prompts;
  }
  
  /**
   * Check if a provider has a custom system prompt
   * 
   * @param {string} provider - API provider ID
   * @returns {boolean} True if provider has a custom prompt
   */
  hasCustomPrompt(provider) {
    const prompt = this.model.getSystemPrompt(provider);
    return prompt && prompt.trim().length > 0;
  }
  
  /**
   * Get prompt statistics
   * 
   * @returns {Object} Statistics about system prompts
   */
  getPromptStatistics() {
    const allPrompts = this.getAllSystemPrompts();
    const stats = {
      totalProviders: Object.keys(allPrompts).length,
      withCustomPrompts: 0,
      averageLength: 0,
      totalCharacters: 0
    };
    
    const promptTexts = Object.values(allPrompts).filter(prompt => prompt && prompt.trim());
    stats.withCustomPrompts = promptTexts.length;
    
    if (promptTexts.length > 0) {
      stats.totalCharacters = promptTexts.reduce((sum, prompt) => sum + prompt.length, 0);
      stats.averageLength = Math.round(stats.totalCharacters / promptTexts.length);
    }
    
    return stats;
  }
  
  /**
   * Export all system prompts
   * 
   * @returns {Object} Exportable system prompts data
   */
  exportSystemPrompts() {
    const prompts = this.getAllSystemPrompts();
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      systemPrompts: prompts
    };
    
    return exportData;
  }
  
  /**
   * Import system prompts
   * 
   * @param {Object} importData - Data to import
   * @returns {Promise<boolean>} Success status
   */
  async importSystemPrompts(importData) {
    try {
      if (!importData || !importData.systemPrompts) {
        throw new Error('Invalid import data');
      }
      
      const prompts = importData.systemPrompts;
      let importCount = 0;
      
      // Import each prompt with validation
      for (const [provider, prompt] of Object.entries(prompts)) {
        if (this.model.getApiKey(provider)) {
          const validation = this.validatePrompt(prompt);
          if (validation.isValid) {
            this.model.setSystemPrompt(provider, prompt);
            importCount++;
          }
        }
      }
      
      // Save to storage
      await this.saveSettings();
      
      console.log(`Imported ${importCount} system prompts`);
      return true;
      
    } catch (error) {
      console.error('Failed to import system prompts:', error);
      return false;
    }
  }
  
  /**
   * Save settings to storage
   */
  async saveSettings() {
    if (this.services.storage) {
      await this.model.saveToStorage(this.services.storage);
    }
  }
}
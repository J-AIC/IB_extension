/**
 * ChatHistoryService.js
 * 
 * Centralized service for managing chat conversation history.
 * Provides a unified interface for saving, loading, and synchronizing chat history
 * across all components of the extension.
 */

import { eventBus } from '../architecture.js';

/**
 * ChatHistoryService class
 * 
 * Manages chat history with consistent storage, synchronization, and events.
 */
export class ChatHistoryService {
    /**
     * Constructor
     * 
     * @param {Object} storageService - The storage service instance
     * @param {Object} [options={}] - Configuration options
     */
    constructor(storageService, options = {}) {
        this.storage = storageService;
        this.options = {
            storageKey: 'chatHistory', // Standardized key
            recentConversationKey: 'recentConversation',
            maxHistory: 30,
            autoTitle: true,
            ...options
        };
        
        // In-memory cache for performance
        this.historyCache = null;
        this.recentCache = null;
        this.cacheExpiry = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    /**
     * Setup event listeners for cross-component communication
     */
    setupEventListeners() {
        // Listen for storage changes to invalidate cache
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local' && 
                    (changes[this.options.storageKey] || changes[this.options.recentConversationKey])) {
                    this.invalidateCache();
                    this.emitHistoryUpdated();
                }
            });
        }
        
        // Listen for conversation save events
        eventBus.on('conversation:save', (conversation) => {
            this.saveConversation(conversation);
        });
        
        // Listen for conversation load events
        eventBus.on('conversation:load', (conversationId) => {
            this.loadConversation(conversationId);
        });
    }
    
    /**
     * Emit history updated event
     */
    emitHistoryUpdated() {
        eventBus.emit('history:updated', { timestamp: Date.now() });
    }
    
    /**
     * Invalidate the in-memory cache
     */
    invalidateCache() {
        this.historyCache = null;
        this.recentCache = null;
        this.cacheExpiry = null;
    }
    
    /**
     * Check if cache is valid
     * @returns {boolean} True if cache is valid
     */
    isCacheValid() {
        return this.cacheExpiry && Date.now() < this.cacheExpiry;
    }
    
    /**
     * Generate a unique conversation ID
     * @returns {string} Unique conversation ID
     */
    generateConversationId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Generate title from conversation messages
     * @param {Array} messages - Array of messages
     * @returns {string} Generated title
     */
    generateTitle(messages) {
        if (!messages || messages.length === 0) {
            return 'New Conversation';
        }
        
        const firstUserMessage = messages.find(msg => msg.role === 'user');
        if (!firstUserMessage) {
            return 'New Conversation';
        }
        
        let title = firstUserMessage.content.trim();
        
        // Remove any markdown or special formatting
        title = title.replace(/[#*`_~]/g, '');
        
        // Limit length and add ellipsis if needed
        if (title.length > 50) {
            title = title.substring(0, 47) + '...';
        }
        
        return title || 'New Conversation';
    }
    
    /**
     * Normalize provider name
     * @param {string} provider - Raw provider name
     * @returns {string} Normalized provider name
     */
    normalizeProvider(provider) {
        if (!provider || provider === 'unknown') {
            return 'openai'; // Default to OpenAI
        }
        
        // Normalize common provider variations
        const normalizedProvider = provider.toLowerCase().trim();
        
        switch (normalizedProvider) {
            case 'gpt':
            case 'chatgpt':
            case 'openai':
                return 'openai';
            case 'claude':
            case 'anthropic':
                return 'anthropic';
            case 'gemini':
            case 'google':
            case 'bard':
                return 'gemini';
            case 'deepseek':
                return 'deepseek';
            case 'azure':
            case 'azureopenai':
            case 'azure-openai':
                return 'azureOpenai';
            case 'local':
            case 'localapi':
            case 'local-api':
                return 'local';
            case 'compatible':
            case 'openai-compatible':
                return 'compatible';
            default:
                return provider; // Return as-is if not recognized
        }
    }
    
    /**
     * Normalize model name based on provider
     * @param {string} model - Raw model name
     * @param {string} provider - Provider name
     * @returns {string} Normalized model name
     */
    normalizeModel(model, provider) {
        if (!model || model === 'unknown') {
            // Provide default models for each provider
            switch (provider) {
                case 'openai':
                    return 'gpt-3.5-turbo';
                case 'anthropic':
                    return 'claude-3-sonnet-20240229';
                case 'gemini':
                    return 'gemini-pro';
                case 'deepseek':
                    return 'deepseek-chat';
                case 'azureOpenai':
                    return 'gpt-35-turbo';
                case 'local':
                    return 'local-model';
                case 'compatible':
                    return 'compatible-model';
                default:
                    return 'gpt-3.5-turbo';
            }
        }
        
        // Clean up model names
        return model.trim();
    }
    
    /**
     * Get conversation history with caching
     * @returns {Promise<Array>} Array of conversation objects
     */
    async getHistory() {
        try {
            // Return cached data if valid
            if (this.isCacheValid() && this.historyCache) {
                return this.historyCache;
            }
            
            const result = await this.storage.get(this.options.storageKey);
            let history = result[this.options.storageKey] || [];
            
            // Ensure history is an array
            if (!Array.isArray(history)) {
                console.warn('History data is not an array, resetting to empty array');
                history = [];
                await this.setHistory(history);
            }
            
            // Validate and clean up history entries
            history = this.validateHistory(history);
            
            // Sort by timestamp (newest first)
            history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Update cache
            this.historyCache = history;
            this.cacheExpiry = Date.now() + this.cacheTimeout;
            
            return history;
        } catch (error) {
            console.error('Error getting history:', error);
            return [];
        }
    }
    
    /**
     * Validate and clean up history entries
     * @param {Array} history - Raw history array
     * @returns {Array} Cleaned history array
     */
    validateHistory(history) {
        return history.filter(conversation => {
            // Must have required fields
            if (!conversation.id || !conversation.timestamp) {
                console.warn('Removing invalid conversation entry:', conversation);
                return false;
            }
            
            // Must have messages array
            if (!Array.isArray(conversation.messages)) {
                console.warn('Removing conversation with invalid messages:', conversation.id);
                return false;
            }
            
            // Ensure required fields have defaults
            conversation.title = conversation.title || this.generateTitle(conversation.messages);
            conversation.provider = this.normalizeProvider(conversation.provider);
            conversation.model = this.normalizeModel(conversation.model, conversation.provider);
            
            return true;
        });
    }
    
    /**
     * Set conversation history
     * @param {Array} history - Array of conversation objects
     * @returns {Promise<void>}
     */
    async setHistory(history) {
        try {
            await this.storage.set({ [this.options.storageKey]: history });
            
            // Update cache
            this.historyCache = history;
            this.cacheExpiry = Date.now() + this.cacheTimeout;
            
            this.emitHistoryUpdated();
        } catch (error) {
            console.error('Error setting history:', error);
            throw error;
        }
    }
    
    /**
     * Save a conversation to history
     * @param {Object} conversation - Conversation object
     * @returns {Promise<string>} Conversation ID
     */
    async saveConversation(conversation) {
        try {
            // Validate conversation object
            if (!conversation || !Array.isArray(conversation.messages)) {
                throw new Error('Invalid conversation object');
            }
            
            // Don't save empty conversations
            if (conversation.messages.length === 0) {
                console.log('Skipping save of empty conversation');
                return null;
            }
            
            const history = await this.getHistory();
            
            // Generate ID if not present
            if (!conversation.id) {
                conversation.id = this.generateConversationId();
            }
            
            // Generate title if not present or auto-title is enabled
            if (!conversation.title || this.options.autoTitle) {
                conversation.title = this.generateTitle(conversation.messages);
            }
            
            // Set timestamp
            conversation.timestamp = conversation.timestamp || new Date().toISOString();
            
            // Check if conversation already exists (update scenario)
            const existingIndex = history.findIndex(c => c.id === conversation.id);
            
            if (existingIndex !== -1) {
                // Update existing conversation
                history[existingIndex] = { ...history[existingIndex], ...conversation };
                console.log('Updated existing conversation:', conversation.id);
            } else {
                // Add new conversation to beginning
                history.unshift(conversation);
                console.log('Added new conversation:', conversation.id);
            }
            
            // Limit history size
            if (history.length > this.options.maxHistory) {
                const removed = history.splice(this.options.maxHistory);
                console.log(`Removed ${removed.length} old conversations`);
            }
            
            // Save to storage
            await this.setHistory(history);
            
            // Update recent conversation
            await this.setRecentConversation(conversation);
            
            // Emit save event
            eventBus.emit('conversation:saved', { 
                id: conversation.id, 
                conversation,
                timestamp: Date.now() 
            });
            
            return conversation.id;
        } catch (error) {
            console.error('Error saving conversation:', error);
            throw error;
        }
    }
    
    /**
     * Load a conversation by ID
     * @param {string} conversationId - Conversation ID
     * @returns {Promise<Object|null>} Conversation object or null if not found
     */
    async loadConversation(conversationId) {
        try {
            const history = await this.getHistory();
            const conversation = history.find(c => c.id === conversationId);
            
            if (conversation) {
                // Update recent conversation
                await this.setRecentConversation(conversation);
                
                // Emit load event
                eventBus.emit('conversation:loaded', { 
                    id: conversationId, 
                    conversation,
                    timestamp: Date.now() 
                });
            }
            
            return conversation || null;
        } catch (error) {
            console.error('Error loading conversation:', error);
            return null;
        }
    }
    
    /**
     * Delete a conversation by ID
     * @param {string} conversationId - Conversation ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    async deleteConversation(conversationId) {
        try {
            const history = await this.getHistory();
            const initialLength = history.length;
            
            const filteredHistory = history.filter(c => c.id !== conversationId);
            
            if (filteredHistory.length !== initialLength) {
                await this.setHistory(filteredHistory);
                
                // Clear recent conversation if it was deleted
                const recent = await this.getRecentConversation();
                if (recent && recent.id === conversationId) {
                    await this.clearRecentConversation();
                }
                
                // Emit delete event
                eventBus.emit('conversation:deleted', { 
                    id: conversationId,
                    timestamp: Date.now() 
                });
                
                console.log('Deleted conversation:', conversationId);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error deleting conversation:', error);
            return false;
        }
    }
    
    /**
     * Update conversation title
     * @param {string} conversationId - Conversation ID
     * @param {string} newTitle - New title
     * @returns {Promise<boolean>} True if updated, false if not found
     */
    async updateConversationTitle(conversationId, newTitle) {
        try {
            const history = await this.getHistory();
            const conversation = history.find(c => c.id === conversationId);
            
            if (conversation) {
                conversation.title = newTitle.trim() || 'Untitled Conversation';
                await this.setHistory(history);
                
                // Update recent conversation if it matches
                const recent = await this.getRecentConversation();
                if (recent && recent.id === conversationId) {
                    recent.title = conversation.title;
                    await this.setRecentConversation(recent);
                }
                
                // Emit update event
                eventBus.emit('conversation:titleUpdated', { 
                    id: conversationId, 
                    title: conversation.title,
                    timestamp: Date.now() 
                });
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error updating conversation title:', error);
            return false;
        }
    }
    
    /**
     * Get recent conversation
     * @returns {Promise<Object|null>} Recent conversation or null
     */
    async getRecentConversation() {
        try {
            // Return cached data if valid
            if (this.isCacheValid() && this.recentCache !== null) {
                return this.recentCache;
            }
            
            const result = await this.storage.get(this.options.recentConversationKey);
            const recent = result[this.options.recentConversationKey] || null;
            
            // Update cache
            this.recentCache = recent;
            this.cacheExpiry = Date.now() + this.cacheTimeout;
            
            return recent;
        } catch (error) {
            console.error('Error getting recent conversation:', error);
            return null;
        }
    }
    
    /**
     * Set recent conversation
     * @param {Object} conversation - Conversation object
     * @returns {Promise<void>}
     */
    async setRecentConversation(conversation) {
        try {
            await this.storage.set({ [this.options.recentConversationKey]: conversation });
            
            // Update cache
            this.recentCache = conversation;
            this.cacheExpiry = Date.now() + this.cacheTimeout;
            
        } catch (error) {
            console.error('Error setting recent conversation:', error);
            throw error;
        }
    }
    
    /**
     * Clear recent conversation
     * @returns {Promise<void>}
     */
    async clearRecentConversation() {
        try {
            await this.storage.set({ [this.options.recentConversationKey]: null });
            
            // Clear cache
            this.recentCache = null;
            
        } catch (error) {
            console.error('Error clearing recent conversation:', error);
            throw error;
        }
    }
    
    /**
     * Clear all conversation history
     * @returns {Promise<void>}
     */
    async clearAllHistory() {
        try {
            await this.storage.set({ 
                [this.options.storageKey]: [],
                [this.options.recentConversationKey]: null
            });
            
            // Clear cache
            this.invalidateCache();
            
            // Emit clear event
            eventBus.emit('history:cleared', { timestamp: Date.now() });
            
            console.log('Cleared all conversation history');
        } catch (error) {
            console.error('Error clearing all history:', error);
            throw error;
        }
    }
    
    /**
     * Search conversations by text content
     * @param {string} searchTerm - Search term
     * @param {Object} [options={}] - Search options
     * @returns {Promise<Array>} Array of matching conversations
     */
    async searchConversations(searchTerm, options = {}) {
        try {
            const { 
                searchTitles = true, 
                searchMessages = true, 
                limit = 20 
            } = options;
            
            if (!searchTerm || searchTerm.trim().length === 0) {
                return [];
            }
            
            const history = await this.getHistory();
            const term = searchTerm.toLowerCase().trim();
            
            const matches = history.filter(conversation => {
                // Search titles
                if (searchTitles && conversation.title && 
                    conversation.title.toLowerCase().includes(term)) {
                    return true;
                }
                
                // Search message content
                if (searchMessages && conversation.messages) {
                    return conversation.messages.some(message => 
                        message.content && message.content.toLowerCase().includes(term)
                    );
                }
                
                return false;
            });
            
            return matches.slice(0, limit);
        } catch (error) {
            console.error('Error searching conversations:', error);
            return [];
        }
    }
    
    /**
     * Get conversation statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const history = await this.getHistory();
            
            const stats = {
                totalConversations: history.length,
                totalMessages: 0,
                providerBreakdown: {},
                oldestConversation: null,
                newestConversation: null
            };
            
            history.forEach(conversation => {
                stats.totalMessages += conversation.messages.length;
                
                // Provider breakdown
                const provider = conversation.provider || 'unknown';
                stats.providerBreakdown[provider] = (stats.providerBreakdown[provider] || 0) + 1;
                
                // Date tracking
                const timestamp = new Date(conversation.timestamp);
                if (!stats.oldestConversation || timestamp < new Date(stats.oldestConversation)) {
                    stats.oldestConversation = conversation.timestamp;
                }
                if (!stats.newestConversation || timestamp > new Date(stats.newestConversation)) {
                    stats.newestConversation = conversation.timestamp;
                }
            });
            
            return stats;
        } catch (error) {
            console.error('Error getting statistics:', error);
            return {
                totalConversations: 0,
                totalMessages: 0,
                providerBreakdown: {},
                oldestConversation: null,
                newestConversation: null
            };
        }
    }
}

/**
 * Factory function to create ChatHistoryService instance
 * @param {Object} container - Dependency injection container
 * @returns {ChatHistoryService} ChatHistoryService instance
 */
export const createChatHistoryService = (container) => {
    const storage = container.get('storage');
    return new ChatHistoryService(storage);
};

/**
 * Global singleton instance (for backward compatibility)
 */
let globalHistoryService = null;

/**
 * Get or create global history service instance
 * @param {Object} storageService - Storage service instance
 * @returns {ChatHistoryService} Global history service instance
 */
export const getGlobalHistoryService = (storageService) => {
    if (!globalHistoryService && storageService) {
        globalHistoryService = new ChatHistoryService(storageService);
    }
    return globalHistoryService;
};
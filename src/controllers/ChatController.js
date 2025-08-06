/**
 * ChatController.js - チャット機能のコントローラー
 */

import { Controller, eventBus } from '../architecture.js';
import { validateApiConfiguration, getProviderDisplayName, getModelDisplayName } from '../utils/configurationValidator.js';

/**
 * ChatController クラス
 * チャット機能のコントローラー
 */
export class ChatController extends Controller {
    /**
     * コンストラクタ
     * 
     * @param {Object} model - チャットモデル
     * @param {Object} view - チャットビュー
     * @param {Object} [services={}] - コントローラーが使用するサービス
     */
    constructor(model, view, services = {}) {
        super(model, view);
        
        this.services = {
            apiClient: null,
            storage: null,
            historyService: null,
            ...services
        };
        
        if (this.view && this.services.storage) {
            this.view.storage = this.services.storage;
        }
        
        this.abortController = null;
        this.currentConversationId = null;
        
        // Initialize conversation if historyService is available
        this.initializeConversation();
        
        // Initialize configuration status display
        this.initializeConfigurationStatus();
    }
    
    /**
     * ユーザーアクションの処理
     * 
     * @param {string} action - 処理するアクション
     * @param {Object} data - アクションのデータ
     */
    async handleAction(action, data) {
        switch (action) {
            case 'sendMessage':
                await this.sendMessage(data.message);
                break;
                
            case 'clearChat':
                this.clearChat();
                break;
                
            case 'cancelRequest':
                this.cancelRequest();
                break;
                
            case 'loadConversation':
                await this.loadConversation(data.conversation);
                break;
                
            case 'setSystemPrompt':
                this.model.setSystemPrompt(data.systemPrompt);
                break;
                
            case 'setPageContext':
                this.model.setPageContext(data.pageContext);
                break;
                
            case 'editMessage':
                await this.editMessage(data.messageId, data.newContent);
                break;
                
            case 'regenerateResponse':
                await this.regenerateResponse(data.messageIndex);
                break;
                
            default:
                console.warn(`Unknown action: ${action}`);
        }
    }
    
    /**
     * メッセージの送信
     * 
     * @param {string} message - 送信するメッセージ
     * @param {Object} options - 追加オプション（pageHTMLなど）
     */
    async sendMessage(message, options = {}) {
        if (!message || this.model.get('isProcessing')) {
            return;
        }
        
        // Check if online before sending
        if (!navigator.onLine) {
            console.warn('Cannot send message: Device is offline');
            const errorMessage = {
                role: 'system',
                content: 'Cannot send message: No internet connection available. Please check your connection and try again.',
                timestamp: new Date().toISOString(),
                id: this.generateMessageId(),
                isError: true
            };
            this.model.addMessage(errorMessage);
            return;
        }
        
        // Check if configuration is valid before sending
        const apiConfig = await this.getApiConfig();
        if (!apiConfig) {
            console.warn('Cannot send message: API configuration not available');
            return;
        }
        
        let pageHTML = '';
        const includePageContext = this.model.get('includePageContext');
        console.log('Include page context:', includePageContext);
        console.log('Chrome tabs available:', !!chrome?.tabs);
        
        if (includePageContext && chrome?.tabs) {
            try {
                console.log('Extracting page content...');
                pageHTML = await this.extractPageContent();
                console.log('Extracted page content length:', pageHTML.length);
                console.log('Page content preview:', pageHTML.substring(0, 200) + '...');
                console.log('Page content type:', typeof pageHTML);
                console.log('Page content truthy:', !!pageHTML);
            } catch (error) {
                console.error('Failed to extract page content:', error);
            }
        }
        
        const userMessage = {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
            id: this.generateMessageId(),
            pageHTML: pageHTML,
            ...options
        };
        
        console.log('Created user message object:', {
            hasPageHTML: !!userMessage.pageHTML,
            pageHTMLLength: userMessage.pageHTML?.length || 0,
            pageHTMLPreview: userMessage.pageHTML?.substring(0, 100) + '...'
        });
        
        this.model.addMessage(userMessage);
        this.model.setProcessing(true);
        this.abortController = new AbortController();
        
        try {
            const apiConfig = await this.getApiConfig();
            
            if (!apiConfig) {
                throw new Error('API configuration not available');
            }
            
            apiConfig.abortController = this.abortController;
            const response = await this.services.apiClient.sendChatRequest(apiConfig);
            
            const assistantMessage = {
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString(),
                id: this.generateMessageId()
            };
            
            this.model.addMessage(assistantMessage);
            this.saveConversation();
        } catch (error) {
            console.error('Error sending message:', error);
            
            const errorMessage = {
                role: 'system',
                content: `Error: ${error.message}`,
                timestamp: new Date().toISOString(),
                id: this.generateMessageId(),
                isError: true
            };
            
            this.model.addMessage(errorMessage);
        } finally {
            this.model.setProcessing(false);
            this.abortController = null;
        }
    }
    
    /**
     * 一意のメッセージIDを生成
     */
    generateMessageId() {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * チャットのクリア
     */
    clearChat() {
        this.model.clearMessages();
        this.cancelRequest();
        // Reset conversation ID when clearing chat
        this.currentConversationId = null;
        
        // Clear recent conversation if historyService is available
        if (this.services.historyService) {
            this.services.historyService.clearRecentConversation().catch(error => {
                console.error('Error clearing recent conversation:', error);
            });
        }
        
        // Emit clear event
        eventBus.emit('chat:cleared', { timestamp: Date.now() });
    }
    
    /**
     * 現在のリクエストをキャンセル
     */
    cancelRequest() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
            this.model.setProcessing(false);
        }
    }
    
    /**
     * 会話の読み込み
     * 
     * @param {Object} conversation - 読み込む会話
     * @param {Object} options - Loading options
     */
    async loadConversation(conversation, options = {}) {
        try {
            // Only clear messages if this is a different conversation or explicitly requested
            const isDifferentConversation = this.currentConversationId !== conversation.id;
            const shouldClearMessages = options.clearMessages === true || 
                                      isDifferentConversation ||
                                      !this.currentConversationId;
            
            if (shouldClearMessages) {
                this.model.clearMessages();
            }
            
            // Set the current conversation ID when loading
            this.currentConversationId = conversation.id || null;
            
            const modelName = conversation.model || conversation.provider;
            let actualProvider = conversation.actualProvider || conversation.provider;
            
            // Auto-detect provider from model name if not specified
            if (!actualProvider && modelName) {
                if (modelName.includes('gpt') || modelName.includes('o1')) {
                    actualProvider = 'openai';
                } else if (modelName.includes('claude')) {
                    actualProvider = 'anthropic';
                } else if (modelName.includes('gemini')) {
                    actualProvider = 'gemini';
                } else if (modelName.includes('deepseek')) {
                    actualProvider = 'deepseek';
                } else if (modelName.includes('azure')) {
                    actualProvider = 'azureOpenai';
                } else if (conversation.provider && conversation.provider !== 'unknown') {
                    actualProvider = conversation.provider;
                } else {
                    actualProvider = 'openai'; // Default fallback
                }
            }
            
            // Ensure we don't have 'unknown' values
            if (actualProvider === 'unknown' || !actualProvider) {
                actualProvider = 'openai';
            }
            if (modelName === 'unknown' || !modelName) {
                modelName = 'gpt-3.5-turbo';
            }
            
            this.model.setProviderAndModel(
                actualProvider || 'openai',
                modelName || 'gpt-3.5-turbo'
            );
            
            // Load messages with validation - avoid duplicates when continuing conversation
            if (Array.isArray(conversation.messages)) {
                const currentMessages = this.model.get('messages') || [];
                const currentMessageIds = new Set(currentMessages.map(m => m.id));
                
                conversation.messages.forEach(message => {
                    if (message && message.role && message.content) {
                        // Only add messages that aren't already present
                        if (!message.id || !currentMessageIds.has(message.id)) {
                            this.model.addMessage(message);
                        }
                    }
                });
            }
            
            // Update the conversation as recent if historyService is available
            if (this.services.historyService && conversation.id) {
                await this.services.historyService.setRecentConversation(conversation);
            }
            
            // Emit load event
            eventBus.emit('conversation:loaded', {
                id: conversation.id,
                conversation,
                timestamp: Date.now()
            });
            
            console.log('Loaded conversation:', conversation.id, 'with', conversation.messages?.length || 0, 'messages');
        } catch (error) {
            console.error('Error loading conversation:', error);
            throw error;
        }
    }
    
    /**
     * Initialize configuration status display
     */
    initializeConfigurationStatus() {
        // Update configuration status when settings change
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local' && 
                    (changes.apiProvider || changes.selectedModels || changes.apiKeys)) {
                    this.updateCurrentProviderAndModel();
                }
            });
        }
        
        // Listen for configuration events
        eventBus.on('configuration:changed', () => {
            this.updateCurrentProviderAndModel();
        });
    }
    
    /**
     * Update configuration status display
     */
    async updateConfigurationStatus(provider, model, hasApiKey) {
        const providerStatus = document.getElementById('providerStatus');
        const modelStatus = document.getElementById('modelStatus');
        const inputWrapper = document.querySelector('.input-wrapper');
        const sendButton = document.querySelector('.modern-send-button');
        const messageInput = document.getElementById('messageInput');
        
        if (!providerStatus || !modelStatus) return;
        
        // Get full settings for validation
        let settings = {};
        try {
            if (this.services.storage) {
                settings = await this.services.storage.get(['apiProvider', 'selectedModels', 'apiKeys']);
            }
        } catch (error) {
            console.error('Error getting settings for configuration status:', error);
        }
        
        // Use configuration validator for comprehensive validation
        const validation = validateApiConfiguration(settings);
        
        // Update provider status with display name
        const providerDisplayName = getProviderDisplayName(validation.provider);
        providerStatus.textContent = providerDisplayName;
        providerStatus.className = 'provider-status ' + 
            (validation.provider === 'unknown' ? 'status-not-configured' : 
             validation.hasApiKey ? 'status-configured' : 'status-unknown');
        
        // Update model status with display name
        const modelDisplayName = getModelDisplayName(validation.model);
        modelStatus.textContent = modelDisplayName;
        modelStatus.className = 'model-status ' + 
            (validation.model === 'unknown' ? 'status-not-configured' : 'status-configured');
        
        // Disable/enable chat input based on configuration validation
        const isConfigured = validation.isValid;
        
        if (inputWrapper) {
            inputWrapper.classList.toggle('disabled', !isConfigured);
        }
        
        if (sendButton) {
            sendButton.classList.toggle('disabled', !isConfigured);
            sendButton.disabled = !isConfigured;
        }
        
        if (messageInput) {
            messageInput.disabled = !isConfigured;
            messageInput.placeholder = isConfigured 
                ? 'Type your message...'
                : 'Configure provider and model in settings to start chatting';
        }
        
        console.log('Updated configuration status:', { 
            provider: validation.provider, 
            model: validation.model, 
            hasApiKey: validation.hasApiKey, 
            isConfigured, 
            issues: validation.issues 
        });
    }
    
    /**
     * Initialize conversation on controller creation
     */
    async initializeConversation() {
        // Initialize current provider/model from storage
        await this.updateCurrentProviderAndModel();
        
        if (this.services.historyService) {
            // Try to load the most recent conversation if no current conversation
            if (!this.currentConversationId) {
                try {
                    const recent = await this.services.historyService.getRecentConversation();
                    if (recent && recent.messages && recent.messages.length > 0) {
                        // Only auto-load if it's compatible with current settings
                        const apiConfig = await this.getApiConfig();
                        if (apiConfig && this.isConversationCompatible(recent, apiConfig)) {
                            await this.loadConversation(recent);
                        }
                    }
                } catch (error) {
                    console.error('Error initializing conversation:', error);
                }
            }
        }
    }
    
    /**
     * Update current provider and model from storage
     */
    async updateCurrentProviderAndModel() {
        try {
            if (!this.services.storage) return;
            
            const settings = await this.services.storage.get([
                'apiProvider',
                'selectedModels',
                'apiKeys'
            ]);
            
            const provider = settings.apiProvider || 'unknown';
            const model = settings.selectedModels?.[provider] || 'unknown';
            const hasApiKey = settings.apiKeys?.[provider] ? true : false;
            
            this.model.setProviderAndModel(provider, model);
            
            // Update configuration status display
            this.updateConfigurationStatus(provider, model, hasApiKey).catch(error => {
                console.error('Error updating configuration status:', error);
            });
            
            console.log('Updated current provider/model:', { provider, model, hasApiKey });
        } catch (error) {
            console.error('Error updating provider/model:', error);
            // Set fallback values
            this.model.setProviderAndModel('unknown', 'unknown');
            this.updateConfigurationStatus('unknown', 'unknown', false).catch(error => {
                console.error('Error updating fallback configuration status:', error);
            });
        }
    }
    
    /**
     * Check if conversation is compatible with current API configuration
     */
    isConversationCompatible(conversation, apiConfig) {
        if (!conversation || !apiConfig) return false;
        
        // Local API is always compatible
        if (apiConfig.provider === 'local' || conversation.provider === 'local') {
            return apiConfig.provider === conversation.provider;
        }
        
        // Azure OpenAI is provider-compatible only
        if (apiConfig.provider === 'azureOpenai' || conversation.provider === 'azureOpenai') {
            return apiConfig.provider === conversation.provider;
        }
        
        // Other providers need exact model match
        return apiConfig.provider === conversation.provider && 
               apiConfig.model === conversation.model;
    }
    
    /**
     * Get the original timestamp of an existing conversation
     */
    async getExistingConversationTimestamp() {
        if (!this.currentConversationId || !this.services.historyService) {
            return null;
        }
        
        try {
            const existingConversation = await this.services.historyService.loadConversation(this.currentConversationId);
            return existingConversation?.timestamp || null;
        } catch (error) {
            console.error('Error getting existing conversation timestamp:', error);
            return null;
        }
    }

    /**
     * 会話をストレージに保存
     */
    async saveConversation() {
        const messages = this.model.get('messages');
        
        // Don't save empty conversations
        if (!messages || messages.length === 0) {
            return;
        }
        
        // Get current provider/model from storage to ensure accuracy
        let provider = this.model.get('currentProvider') || 'unknown';
        let model = this.model.get('currentModel') || 'unknown';
        
        // Ensure we have the latest settings
        try {
            const settings = await this.services.storage.get(['apiProvider', 'selectedModels']);
            if (settings.apiProvider) {
                provider = settings.apiProvider;
                model = settings.selectedModels?.[provider] || model;
                
                // Update model with current settings
                this.model.setProviderAndModel(provider, model);
            }
        } catch (error) {
            console.error('Error getting current provider/model for save:', error);
        }
        
        const conversation = {
            id: this.currentConversationId, // Will be generated by historyService if null
            provider: provider,
            model: model,
            timestamp: this.currentConversationId ? 
                       (await this.getExistingConversationTimestamp() || new Date().toISOString()) :
                       new Date().toISOString(),
            messages: messages
        };
        
        try {
            if (this.services.historyService) {
                // Use the new history service
                const savedId = await this.services.historyService.saveConversation(conversation);
                if (savedId && !this.currentConversationId) {
                    this.currentConversationId = savedId;
                }
            } else if (this.services.storage) {
                // Fallback to old storage method
                console.warn('Using fallback storage method for conversation');
                if (this.currentConversationId) {
                    // Update existing conversation
                    const history = await this.services.storage.getConversationHistory();
                    const updatedHistory = history.map(conv => {
                        if (conv.id === this.currentConversationId) {
                            return {
                                ...conv,
                                ...conversation,
                                id: this.currentConversationId
                            };
                        }
                        return conv;
                    });
                    await this.services.storage.set({ chatHistory: updatedHistory });
                } else {
                    // Create new conversation with ID
                    conversation.id = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    this.currentConversationId = conversation.id;
                    await this.services.storage.saveConversation(conversation);
                }
            }
        } catch (error) {
            console.error('Error saving conversation:', error);
        }
    }
    
    /**
     * メッセージの編集とレスポンスの再生成
     * 
     * @param {string} messageId - 編集するメッセージのID
     * @param {string} newContent - メッセージの新しい内容
     */
    async editMessage(messageId, newContent) {
        try {
            const messageDiv = document.getElementById(messageId);
            if (messageDiv) {
                const messageText = messageDiv.querySelector('.message-text');
                if (messageText) {
                    messageText.textContent = newContent;
                    messageText.dataset.originalContent = newContent;
                }
            }
            
            const messages = this.model.get('messages');
            const messageIndex = messages.findIndex(msg => msg.id === messageId);
            
            if (messageIndex !== -1) {
                messages[messageIndex].content = newContent;
                this.model.set('messages', [...messages]);
                await this.regenerateResponse(messageIndex);
            }
        } catch (error) {
            console.error('Error editing message:', error);
            throw error;
        }
    }
    
    /**
     * 指定したメッセージインデックスからレスポンスを再生成
     * 
     * @param {number} messageIndex - 再生成する開始インデックス
     */
    async regenerateResponse(messageIndex) {
        try {
            const messages = this.model.get('messages');
            
            const truncatedMessages = messages.slice(0, messageIndex + 1);
            this.model.set('messages', truncatedMessages);
            
            if (truncatedMessages[messageIndex]?.role === 'user') {
                this.model.setProcessing(true);
                this.abortController = new AbortController();
                
                const apiConfig = await this.getApiConfig();
                
                if (!apiConfig) {
                    throw new Error('API configuration not available');
                }
                
                apiConfig.abortController = this.abortController;
                const response = await this.services.apiClient.sendChatRequest(apiConfig);
                
                const assistantMessage = {
                    role: 'assistant',
                    content: response,
                    timestamp: new Date().toISOString(),
                    id: this.generateMessageId()
                };
                
                this.model.addMessage(assistantMessage);
                this.saveConversation();
            }
        } catch (error) {
            console.error('Error regenerating response:', error);
            
            const errorMessage = {
                role: 'system',
                content: `Error regenerating response: ${error.message}`,
                timestamp: new Date().toISOString(),
                id: this.generateMessageId(),
                isError: true
            };
            
            this.model.addMessage(errorMessage);
        } finally {
            this.model.setProcessing(false);
            this.abortController = null;
        }
    }

    /**
     * 現在のタブからページコンテンツを抽出
     * 
     * @returns {Promise<string>} 抽出されたページコンテンツ
     */
    async extractPageContent() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const contentTypeResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    return {
                        url: window.location.href,
                        contentType: document.contentType || ''
                    };
                }
            });

            const pageInfo = contentTypeResults?.[0]?.result || {};
            const isPDF = pageInfo.url.toLowerCase().endsWith('.pdf') ||
                         pageInfo.contentType.toLowerCase() === 'application/pdf';

            if (isPDF) {
                return await this.extractPDFContent(tab.id);
            } else {
                return await this.extractHTMLContent(tab.id);
            }
        } catch (error) {
            console.error('Error extracting page content:', error);
            return '';
        }
    }
    
    /**
     * PDFからコンテンツを抽出
     * 
     * @param {number} tabId - タブID
     * @returns {Promise<string>} 抽出されたPDFコンテンツ
     */
    async extractPDFContent(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['assets/js/pdf.min.js']
            });

            const pdfResult = await chrome.scripting.executeScript({
                target: { tabId },
                func: async () => {
                    try {
                        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/js/pdf.worker.min.js');
                        const response = await fetch(window.location.href);
                        const pdfData = await response.arrayBuffer();

                        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
                        const pdf = await loadingTask.promise;
                        let textAll = '';
                        
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            const pageText = textContent.items.map(item => item.str).join(' ');
                            textAll += pageText + '\n';
                        }
                        return textAll;
                    } catch (e) {
                        return `PDF読み込み失敗: ${e}`;
                    }
                }
            });

            return pdfResult?.[0]?.result || '';
        } catch (error) {
            console.error('Error extracting PDF content:', error);
            return '';
        }
    }
    
    /**
     * HTMLページからコンテンツを抽出
     * 
     * @param {number} tabId - タブID
     * @returns {Promise<string>} 抽出されたHTMLコンテンツ
     */
    async extractHTMLContent(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['assets/js/Readability.js']
            });
            
            const articleResult = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const cloned = document.cloneNode(true);
                    const reader = new Readability(cloned, {
                        charThreshold: 200,
                        keepClasses: false,
                        nbTopCandidates: 3,
                        scoreThreshold: 25
                    });
                    const article = reader.parse();
                    if (!article) return '';

                    const text = article.textContent
                        .replace(/\s+/g, ' ')
                        .replace(/\n{3,}/g, '\n\n')
                        .trim();
                    return text;
                }
            });
            
            return articleResult?.[0]?.result || '';
        } catch (error) {
            console.error('Error extracting HTML content:', error);
            return '';
        }
    }

    /**
     * API設定を取得
     * 
     * @returns {Promise<Object>} API設定
     */
    async getApiConfig() {
        if (!this.services.storage) {
            return null;
        }
        
        try {
            const settings = await this.services.storage.get([
                'apiProvider',
                'apiKeys',
                'selectedModels',
                'customSettings',
                'systemPrompts'
            ]);
            
            if (!settings.apiProvider || !settings.apiKeys) {
                throw new Error('API settings not configured');
            }
            
            const provider = settings.apiProvider;
            const apiKey = settings.apiKeys[provider];
            const model = settings.selectedModels?.[provider] || '';
            
            if (!apiKey) {
                throw new Error(`API key not configured for ${provider}`);
            }
            
            // Use provider-specific system prompt if available, otherwise fall back to chat model's prompt
            const systemPrompt = settings.systemPrompts?.[provider] || this.model.get('systemPrompt');
            console.log(`System prompt for provider ${provider}:`, systemPrompt ? systemPrompt.substring(0, 100) + '...' : 'No custom prompt, using default');
            
            const messages = this.getMessagesForApiWithPageContext(systemPrompt);
            
            return {
                provider,
                apiKey,
                model,
                systemPrompt,
                messages: messages,
                customSettings: settings.customSettings?.[provider] || {}
            };
        } catch (error) {
            console.error('Error getting API config:', error);
            return null;
        }
    }
    
    /**
     * ページコンテキストを含むAPI用メッセージを取得
     * 
     * @param {string} [customSystemPrompt] - カスタムシステムプロンプト
     * @returns {Array} フォーマットされたメッセージ
     */
    getMessagesForApiWithPageContext(customSystemPrompt) {
        const systemPrompt = customSystemPrompt || this.model.get('systemPrompt');
        const messages = this.model.get('messages');
        
        console.log('Getting messages for API, total messages:', messages.length);
        console.log('Using system prompt:', systemPrompt ? systemPrompt.substring(0, 100) + '...' : 'No system prompt');
        
        const unifiedPrompt = this.buildMarkdownPrompt(messages);
        
        console.log('Unified prompt built, length:', unifiedPrompt.length);
        
        if (systemPrompt) {
            const apiMessages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: unifiedPrompt }
            ];
            console.log('Sending to API with system prompt, messages:', apiMessages.length);
            return apiMessages;
        }
        
        const apiMessages = [{ role: 'user', content: unifiedPrompt }];
        console.log('Sending to API without system prompt, messages:', apiMessages.length);
        return apiMessages;
    }
    
    /**
     * 会話履歴とページコンテキストを含むMarkdownプロンプトを構築
     * 
     * @param {Array} messages - メッセージ配列
     * @returns {string} フォーマットされたMarkdownプロンプト
     */
    buildMarkdownPrompt(messages) {
        console.log('Building markdown prompt with messages:', messages.length);
        let markdown = '';
        
        const turns = [];
        let currentTurn = { user: null, assistant: null };
        
        for (const message of messages) {
            if (message.role === 'user') {
                if (currentTurn.user !== null) {
                    turns.push({ ...currentTurn });
                    currentTurn = { user: null, assistant: null };
                }
                currentTurn.user = message;
            } else if (message.role === 'assistant') {
                currentTurn.assistant = message;
                if (currentTurn.user !== null) {
                    turns.push({ ...currentTurn });
                    currentTurn = { user: null, assistant: null };
                }
            }
        }
        
        if (currentTurn.user !== null || currentTurn.assistant !== null) {
            turns.push(currentTurn);
        }
        
        console.log('Grouped into turns:', turns.length);
        
        if (turns.length > 1) {
            markdown += "# Recent dialogue\n\n";
            
            const recentTurns = turns.slice(-5, -1);
            recentTurns.forEach((turn, index) => {
                markdown += `## Turn ${index + 1}\n\n`;
                if (turn.user) {
                    const userContent = this.stripSiteInfo(turn.user.content);
                    markdown += `### User\n\n\`\`\`\n${userContent}\n\`\`\`\n\n`;
                }
                if (turn.assistant) {
                    markdown += `### Assistant\n\n\`\`\`\n${turn.assistant.content}\n\`\`\`\n\n`;
                }
            });
        }
        
        const currentUserMessage = turns[turns.length - 1]?.user;
        if (currentUserMessage) {
            console.log('Current user message has pageHTML:', !!currentUserMessage.pageHTML);
            console.log('Current user message has guideContext:', !!currentUserMessage.guideContext);
            
            if (currentUserMessage.pageHTML) {
                console.log('Page HTML length:', currentUserMessage.pageHTML.length);
            }
            
            if (currentUserMessage.guideContext) {
                console.log('Guide context available:', currentUserMessage.guideContext.length, 'guides');
            }
            
            // Add guide context if available
            if (currentUserMessage.guideContext && currentUserMessage.guideContext.length > 0) {
                markdown += "# Guide Context\n\n";
                markdown += "The following guides are available for this page:\n\n";
                currentUserMessage.guideContext.forEach((guide, index) => {
                    markdown += `## Guide ${index + 1}: ${guide.title}\n\n`;
                    if (guide.memo) {
                        markdown += `**Description:** ${guide.memo}\n\n`;
                    }
                    if (guide.prompt) {
                        markdown += `**Suggested prompt:** ${guide.prompt}\n\n`;
                    }
                });
                markdown += "\n";
            }
            
            markdown += "# Current user message\n\n";
            markdown += `\`\`\`\n${currentUserMessage.content}\n\`\`\`\n\n`;
            
            if (currentUserMessage.pageHTML) {
                markdown += "# Page Context\n\n";
                markdown += `\`\`\`html\n${currentUserMessage.pageHTML}\n\`\`\`\n\n`;
            }
        }
        
        console.log('Final markdown length:', markdown.length);
        console.log('Final markdown preview:', markdown.substring(0, 500) + '...');
        
        return markdown;
    }
    
    /**
     * コンテンツからサイト情報を削除
     * 
     * @param {string} content - 削除するコンテンツ
     * @returns {string} 削除されたコンテンツ
     */
    stripSiteInfo(content) {
        const siteInfoIndex = content.indexOf('\n\n---\n### Page Context');
        if (siteInfoIndex !== -1) {
            return content.substring(0, siteInfoIndex);
        }
        return content;
    }
}

export const createChatController = (container) => {
    const chatModel = container.get('chatModel');
    const chatView = container.get('chatView');
    const apiClient = container.get('apiClient');
    const storage = container.get('storage');
    
    return new ChatController(chatModel, chatView, {
        apiClient,
        storage
    });
};
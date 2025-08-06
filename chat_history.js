/**
 * チャット履歴管理クラス
 * 
 * DEPRECATED: This class is being replaced by ChatHistoryService.
 * Use the new service for better consistency and synchronization.
 */
class ChatHistory {
    constructor() {
        this.MAX_HISTORY = 30;
        this.storageKey = 'chatHistory'; // Updated to match new standard
        this.recentConversationKey = 'recentConversation'; // Updated to match new standard
        this.currentTab = 'chat';
        this.historyService = null;
        this.initializeUI();
    }

    
    /**
     * UI初期化とイベント設定
     */
    async initializeUI() {
        // Initialize immediately without waiting for container
        
        // Try to get the new history service
        try {
            if (window.container && window.container.get) {
                this.historyService = window.container.get('historyService');
                console.log('Using new ChatHistoryService');
            }
        } catch (error) {
            console.log('ChatHistoryService not available, using legacy methods');
        }
        
        this.historyList = document.getElementById('historyList');
        this.template = document.getElementById('historyItemTemplate');
        this.historyTab = document.getElementById('history-tab');
        const closeModalButton = document.getElementById('closeModalButton');
        if (closeModalButton) {
            closeModalButton.addEventListener('click', () => {
                const modal = document.getElementById('formContentModal');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        }

        document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(button => {
            button.addEventListener('shown.bs.tab', (event) => {
                if (event.target.id === 'history-tab') {
                    this.renderHistoryList();
                }
                this.currentTab = event.target.id;
            });
        });

        await this.loadHistory();
        const recentConversation = await this.getRecentConversation();
        if (recentConversation) {
            const currentConfig = await this.getCurrentApiConfig();
            const recentProvider = recentConversation.provider;
            const recentModel = recentConversation.model;

            const isCompatible = (
                currentConfig.provider === recentProvider &&
                (recentProvider === 'local' || recentProvider === 'azureOpenai' || currentConfig.model === recentModel)
            );

            if (isCompatible) {
                window.dispatchEvent(new CustomEvent('loadConversation', {
                    detail: recentConversation,
                }));
            }
        }
    }

    /**
     * Chromeストレージの利用可能性をチェック
     * @returns {boolean} 利用可能かどうか
     */
    static isChromeStorageAvailable() {
        try {
            return typeof chrome !== 'undefined' && 
                   chrome.storage && 
                   chrome.storage.local &&
                   chrome.runtime &&
                   chrome.runtime.id;
        } catch (error) {
            return false;
        }
    }

    static async getItem(key) {
        try {
            // Use the architecture's storage service if available
            const storageService = window.getServiceSafely ? 
                window.getServiceSafely('storage') : 
                (window.container && window.container.get ? 
                    (() => {
                        try {
                            return window.container.get('storage');
                        } catch (error) {
                            console.log('Storage service not available, using fallback:', error.message);
                            return null;
                        }
                    })() : null);
            
            if (storageService) {
                const result = await storageService.get(key);
                return result[key] || null;
            }
            
            // Fallback to direct Chrome storage with context validation
            if (ChatHistory.isChromeStorageAvailable()) {
                return new Promise(resolve => {
                    try {
                        chrome.storage.local.get([key], (result) => {
                            if (chrome.runtime.lastError) {
                                console.warn('Chrome storage error, using localStorage fallback:', chrome.runtime.lastError);
                                const item = localStorage.getItem(key);
                                try {
                                    resolve(item ? JSON.parse(item) : null);
                                } catch {
                                    resolve(item);
                                }
                            } else {
                                resolve(result[key] || null);
                            }
                        });
                    } catch (error) {
                        console.warn('Chrome storage access failed, using localStorage fallback:', error);
                        const item = localStorage.getItem(key);
                        try {
                            resolve(item ? JSON.parse(item) : null);
                        } catch {
                            resolve(item);
                        }
                    }
                });
            } else {
                const item = localStorage.getItem(key);
                try {
                    return item ? JSON.parse(item) : null;
                } catch {
                    return item;
                }
            }
        } catch (error) {
            console.error('Storage getItem error:', error);
            return null;
        }
    }

    static async setItem(key, value) {
        try {
            // Use the architecture's storage service if available
            const storageService = window.getServiceSafely ? 
                window.getServiceSafely('storage') : 
                (window.container && window.container.get ? 
                    (() => {
                        try {
                            return window.container.get('storage');
                        } catch (error) {
                            console.log('Storage service not available, using fallback:', error.message);
                            return null;
                        }
                    })() : null);
            
            if (storageService) {
                await storageService.set({ [key]: value });
                return;
            }
            
            // Fallback to direct Chrome storage with context validation
            if (ChatHistory.isChromeStorageAvailable()) {
                return new Promise(resolve => {
                    try {
                        chrome.storage.local.set({ [key]: value }, () => {
                            if (chrome.runtime.lastError) {
                                console.warn('Chrome storage error, using localStorage fallback:', chrome.runtime.lastError);
                                localStorage.setItem(key, JSON.stringify(value));
                            }
                            resolve();
                        });
                    } catch (error) {
                        console.warn('Chrome storage access failed, using localStorage fallback:', error);
                        localStorage.setItem(key, JSON.stringify(value));
                        resolve();
                    }
                });
            } else {
                localStorage.setItem(key, JSON.stringify(value));
                return Promise.resolve();
            }
        } catch (error) {
            console.error('Storage setItem error:', error);
            // Final fallback to localStorage
            localStorage.setItem(key, JSON.stringify(value));
        }
    }

    /**
     * 複数キーの取得用ヘルパー
     * @param {string[]} keys - 取得するキーの配列
     * @returns {Object} キーと値のペア
     */
    static async getItems(keys) {
        try {
            // Use the architecture's storage service if available
            const storageService = window.getServiceSafely ? 
                window.getServiceSafely('storage') : 
                (window.container && window.container.get ? 
                    (() => {
                        try {
                            return window.container.get('storage');
                        } catch (error) {
                            console.log('Storage service not available for getItems, using fallback:', error.message);
                            return null;
                        }
                    })() : null);
            
            if (storageService) {
                return await storageService.get(keys);
            }
            
            // Fallback to Chrome storage
            if (ChatHistory.isChromeStorageAvailable()) {
                return new Promise(resolve => {
                    try {
                        chrome.storage.local.get(keys, (result) => {
                            if (chrome.runtime.lastError) {
                                console.warn('Chrome storage error in getItems, using localStorage fallback:', chrome.runtime.lastError);
                                const fallbackResult = {};
                                keys.forEach(key => {
                                    let value = localStorage.getItem(key);
                                    try {
                                        value = JSON.parse(value);
                                    } catch {
                                        // Keep as string
                                    }
                                    fallbackResult[key] = value;
                                });
                                resolve(fallbackResult);
                            } else {
                                resolve(result);
                            }
                        });
                    } catch (error) {
                        console.warn('Chrome storage access failed in getItems, using localStorage fallback:', error);
                        const fallbackResult = {};
                        keys.forEach(key => {
                            let value = localStorage.getItem(key);
                            try {
                                value = JSON.parse(value);
                            } catch {
                                // Keep as string
                            }
                            fallbackResult[key] = value;
                        });
                        resolve(fallbackResult);
                    }
                });
            } else {
                // Final fallback to localStorage
                const result = {};
                keys.forEach(key => {
                    let value = localStorage.getItem(key);
                    try {
                        value = JSON.parse(value);
                    } catch {
                        // 文字列としてそのまま格納
                    }
                    result[key] = value;
                });
                return result;
            }
        } catch (error) {
            console.error('Storage getItems error:', error);
            // Return empty object on error
            const result = {};
            keys.forEach(key => {
                result[key] = null;
            });
            return result;
        }
    }

    /**
     * 履歴を取得
     * @returns {Promise<Array>} 履歴データ
     */
    async getHistory() {
        // Use new history service if available
        if (this.historyService) {
            try {
                return await this.historyService.getHistory();
            } catch (error) {
                console.error('Error using history service, falling back to legacy:', error);
            }
        }
        
        // Fallback to legacy method
        const stored = await ChatHistory.getItem(this.storageKey);
        return stored || [];
    }

    async setHistory(history) {
        // Use new history service if available
        if (this.historyService) {
            try {
                await this.historyService.setHistory(history);
                return;
            } catch (error) {
                console.error('Error using history service, falling back to legacy:', error);
            }
        }
        
        // Fallback to legacy method
        await ChatHistory.setItem(this.storageKey, history);
    }

    async getRecentConversation() {
        // Use new history service if available
        if (this.historyService) {
            try {
                return await this.historyService.getRecentConversation();
            } catch (error) {
                console.error('Error using history service, falling back to legacy:', error);
            }
        }
        
        // Fallback to legacy method
        const conversation = await ChatHistory.getItem(this.recentConversationKey);
        return conversation || null;
    }

    async saveRecentConversation(conversation) {
        // Use new history service if available
        if (this.historyService) {
            try {
                await this.historyService.setRecentConversation(conversation);
                return;
            } catch (error) {
                console.error('Error using history service, falling back to legacy:', error);
            }
        }
        
        // Fallback to legacy method
        await ChatHistory.setItem(this.recentConversationKey, conversation);
    }

    /**
     * 履歴をロードして表示
     */
    async loadHistory() {
        try {
            const history = await this.getHistory();
            if (history.length > 0) {
                await this.renderHistoryList();
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    async renderHistoryList() {
        if (!this.historyList) {
            // History list element not found - this is normal in non-history panels
            console.log('History list element not found - not in history panel');
            return;
        }

        const history = await this.getHistory();

        const sortedHistory = history.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        this.historyList.innerHTML = '';

        console.log('chrome.i18n available:', !!chrome.i18n);
        console.log('noHistory message:', chrome.i18n.getMessage('noHistory'));

        if (sortedHistory.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'p-3 text-muted';
            emptyMessage.textContent = 'No chat history yet';
            this.historyList.appendChild(emptyMessage);
            return;
        }

        sortedHistory.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <input type="text" class="history-title" value="${item.title || 'Untitled Conversation'}" readonly>
                <div class="history-preview">${item.messages && item.messages.length > 1 ? item.messages[1].content.substring(0, 150) + '...' : 'No response yet'}</div>
                <div class="history-meta">
                    <div class="history-date">
                        <i class="bi bi-clock"></i>
                        <span>${new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="history-actions">
                        <button class="history-action-btn" title="Load conversation" data-item-id="${item.id}">
                            <i class="bi bi-arrow-right"></i>
                        </button>
                        <button class="history-action-btn" title="Delete" data-item-id="${item.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;

            // Add event handlers
            historyItem.addEventListener('click', (e) => {
                // Check if click is on action button or its icon
                const actionBtn = e.target.closest('.history-action-btn');
                
                if (actionBtn) {
                    e.stopPropagation();
                    const itemId = actionBtn.dataset.itemId;
                    if (actionBtn.title === 'Load conversation') {
                        this.loadConversation(item);
                    } else if (actionBtn.title === 'Delete') {
                        this.deleteHistory(itemId);
                    }
                } else if (!e.target.closest('.history-title')) {
                    // Click on history item itself (but not on title)
                    this.loadConversation(item);
                }
            });

            // Add double-click handler for title editing
            const titleInput = historyItem.querySelector('.history-title');
            titleInput.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent navigation on single click
            });
            
            titleInput.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                titleInput.readOnly = false;
                titleInput.focus();
                titleInput.select();
            });
            
            titleInput.addEventListener('blur', async () => {
                titleInput.readOnly = true;
                if (titleInput.value.trim() !== item.title) {
                    await this.updateTitle(item.id, titleInput.value.trim());
                }
            });
            
            titleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    titleInput.blur();
                }
            });

            this.historyList.appendChild(historyItem);
        });
    }

    // -------------------------------------------------------------------------
    // 履歴への保存・タイトル更新・削除
    // -------------------------------------------------------------------------
    async saveHistory(conversation) {
        // Use new history service if available
        if (this.historyService) {
            try {
                await this.historyService.saveConversation(conversation);
                await this.renderHistoryList();
                return;
            } catch (error) {
                console.error('Error using history service, falling back to legacy:', error);
            }
        }
        
        // Legacy fallback method
        // 直近の会話として保存
        await this.saveRecentConversation(conversation);

        const history = await this.getHistory();
        const firstMessage = conversation.messages[0];
        if (!firstMessage) return;

        // 既存の同一会話があるかチェック
        const existingIndex = history.findIndex(h => {
            const firstHistoryMessage = h.conversation?.messages?.[0] || h.messages?.[0];
            return firstHistoryMessage &&
                firstHistoryMessage.content === firstMessage.content &&
                firstHistoryMessage.timestamp === firstMessage.timestamp;
        });

        // タイトル自動生成
        const title = await this.generateTitle(conversation.messages);

        // 新しい履歴項目
        const historyItem = {
            id: existingIndex >= 0 ? history[existingIndex].id : `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: title,
            provider: conversation.provider,
            model: conversation.model,
            timestamp: new Date().toISOString(),
            messages: conversation.messages, // Store messages directly for new format
            conversation: conversation // Keep for backward compatibility
        };

        // 既存更新 or 新規追加
        if (existingIndex >= 0) {
            history[existingIndex] = historyItem;
        } else {
            history.unshift(historyItem);
        }

        // 履歴数をオーバーしないようにカット
        const trimmedHistory = history.slice(0, this.MAX_HISTORY);
        await this.setHistory(trimmedHistory);

        // ---- 変更点: タブのアクティブ状態に関わらず再描画 ----
        await this.renderHistoryList();
    }

    async updateTitle(historyId, newTitle) {
        // Use new history service if available
        if (this.historyService) {
            try {
                await this.historyService.updateConversationTitle(historyId, newTitle);
                return;
            } catch (error) {
                console.error('Error using history service, falling back to legacy:', error);
            }
        }
        
        // Legacy fallback method
        const history = await this.getHistory();
        const updatedHistory = history.map(h => {
            if (h.id === historyId) {
                return { 
                    ...h, 
                    title: newTitle.trim() || chrome.i18n.getMessage('untitledConversation') 
                };
            }
            return h;
        });
        await this.setHistory(updatedHistory);
    }

    async deleteHistory(historyId) {
        // Use new history service if available
        if (this.historyService) {
            try {
                await this.historyService.deleteConversation(historyId);
                await this.renderHistoryList();
                return;
            } catch (error) {
                console.error('Error using history service, falling back to legacy:', error);
            }
        }
        
        // Legacy fallback method
        const history = await this.getHistory();
        const updatedHistory = history.filter(h => h.id !== historyId);
        await this.setHistory(updatedHistory);
        await this.renderHistoryList();
    }

    // -------------------------------------------------------------------------
    // 履歴からの会話ロード
    // -------------------------------------------------------------------------
    async loadConversation(historyItem) {
        const currentConfig = await this.getCurrentApiConfig();
        const historyProvider = historyItem.provider;
        const historyModel = historyItem.model;

        // Load conversation without tab switching delays

        // Use the exact same logic as standalone - just spread the conversation object
        console.log('Dispatching loadConversation event with:', historyItem);
        window.dispatchEvent(new CustomEvent('loadConversation', {
            detail: {
                ...historyItem,
                source: 'historyTab'
            }
        }));
        console.log('loadConversation event dispatched');
        
        // Navigate to chat panel to see the loaded conversation
        if (window.PanelNavigation && typeof window.PanelNavigation.navigateToPanel === 'function') {
            console.log('Navigating to chat panel to show loaded conversation');
            window.PanelNavigation.navigateToPanel('chat');
        } else {
            console.error('PanelNavigation not available for navigation');
        }

        // プロバイダーの一致チェック
        if (currentConfig.provider === historyProvider) {
            if (historyProvider === 'local' || historyProvider === 'azureOpenai') {
                //toggleChatInput(true);
            } else if (currentConfig.model === historyModel) {
                //toggleChatInput(true);
            } else {
                const message = chrome.i18n.getMessage('modelMismatchError', [
                    historyProvider.toUpperCase(),
                    historyModel,
                    currentConfig.model
                ]);
                //toggleChatInput(false, message);
            }
        } else {
            let message;
            if (historyProvider === 'local') {
                message = chrome.i18n.getMessage('localApiChatError', [
                    currentConfig.provider.toUpperCase()
                ]);
            } else if (currentConfig.provider === 'local') {
                message = chrome.i18n.getMessage('providerChatError', [
                    historyProvider.toUpperCase(),
                    historyModel
                ]);
            } else {
                message = chrome.i18n.getMessage('chatContinuationError', [
                    historyProvider.toUpperCase(),
                    historyModel,
                    currentConfig.provider.toUpperCase(),
                    currentConfig.model
                ]);
            }
            //toggleChatInput(false, message);
        }
    }

    // -------------------------------------------------------------------------
    // タイトル生成ヘルパー
    // -------------------------------------------------------------------------
    async generateTitle(messages) {
        if (!messages || messages.length === 0) {
            return chrome.i18n.getMessage('newConversation');
        }

        const firstUserMessage = messages.find(m => m.role === 'user');
        if (!firstUserMessage) {
            return chrome.i18n.getMessage('newConversation');
        }

        const title = firstUserMessage.content.slice(0, 20);
        return title + (firstUserMessage.content.length > 20 ? '...' : '');
    }

    // -------------------------------------------------------------------------
    // 現在の API 設定取得
    // -------------------------------------------------------------------------
    async getCurrentApiConfig() {
        const result = await this.getStorageData([
            'apiProvider',
            'selectedModels'
        ]);
        return {
            provider: result.apiProvider || '',
            model: (result.selectedModels && result.selectedModels[result.apiProvider]) || ''
        };
    }

    async getStorageData(keys) {
        // 複数キーの同時取得
        return ChatHistory.getItems(keys);
    }
}

// -----------------------------------------------------------------------------
// スタイルの追加 - Removed to prevent duplicate styling
// All styles are now in panel-history.html
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// メインの処理
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Initialize immediately
    const chatHistory = new ChatHistory();

    window.addEventListener('saveConversation', (event) => {
        chatHistory.saveHistory(event.detail);
    });
});

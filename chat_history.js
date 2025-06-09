// chat_history.js

class ChatHistory {
    constructor() {
        this.MAX_HISTORY = 30;
        this.storageKey = 'chat_history';
        this.recentConversationKey = 'recent_conversation';
        this.currentTab = 'chat';
        this.initializeUI();
    }

    async initializeUI() {
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

    static isChromeStorageAvailable() {
        return (typeof chrome !== 'undefined' && chrome.storage);
    }

    static async getItem(key) {
        if (ChatHistory.isChromeStorageAvailable()) {
            return new Promise(resolve => {
                chrome.storage.local.get([key], (result) => {
                    resolve(result[key] || null);
                });
            });
        } else {
            const item = localStorage.getItem(key);
            try {
                return item ? JSON.parse(item) : null;
            } catch {
                return item;
            }
        }
    }

    static async setItem(key, value) {
        if (ChatHistory.isChromeStorageAvailable()) {
            return new Promise(resolve => {
                chrome.storage.local.set({ [key]: value }, resolve);
            });
        } else {
            localStorage.setItem(key, JSON.stringify(value));
            return Promise.resolve();
        }
    }

    static async getItems(keys) {
        if (ChatHistory.isChromeStorageAvailable()) {
            return new Promise(resolve => {
                chrome.storage.local.get(keys, resolve);
            });
        } else {
            const result = {};
            keys.forEach(key => {
                let value = localStorage.getItem(key);
                try {
                    value = JSON.parse(value);
                } catch {
                    value = value;
                }
                result[key] = value;
            });
            return result;
        }
    }

    async getHistory() {
        const stored = await ChatHistory.getItem(this.storageKey);
        return stored || [];
    }

    async setHistory(history) {
        await ChatHistory.setItem(this.storageKey, history);
    }

    async getRecentConversation() {
        const conversation = await ChatHistory.getItem(this.recentConversationKey);
        return conversation || null;
    }

    async saveRecentConversation(conversation) {
        await ChatHistory.setItem(this.recentConversationKey, conversation);
    }

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
            console.error('History list element not found');
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
            await new Promise(resolve => {
                const checkI18n = () => {
                    if (chrome.i18n && chrome.i18n.getMessage('noHistory')) {
                        resolve();
                    } else {
                        setTimeout(checkI18n, 100);
                    }
                };
                checkI18n();
            });

            emptyMessage.textContent = chrome.i18n.getMessage('noHistory');
            this.historyList.appendChild(emptyMessage);
            return;
        }

        sortedHistory.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item p-3 border-bottom position-relative';
            historyItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="history-title-container flex-grow-1">
                        <input type="text" class="history-title-input form-control-plaintext fw-bold" 
                               value="${item.title || chrome.i18n.getMessage('untitledConversation')}" readonly>
                    </div>
                    <button class="delete-button btn btn-link p-0 ms-2" aria-label="削除">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
                <div class="history-provider text-muted small">
                    ${(item.provider || '').toUpperCase()}  ${item.model || 'Unknown'}
                </div>
                <div class="history-timestamp text-muted small">
                    ${new Date(item.timestamp).toLocaleString()}
                </div>
            `;

            const titleInput = historyItem.querySelector('.history-title-input');
            const deleteButton = historyItem.querySelector('.delete-button');

            titleInput.addEventListener('dblclick', () => {
                titleInput.readOnly = false;
                titleInput.focus();
            });

            titleInput.addEventListener('blur', async () => {
                titleInput.readOnly = true;
                await this.updateTitle(item.id, titleInput.value);
            });

            titleInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    titleInput.blur();
                }
            });

            deleteButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.deleteHistory(item.id);
            });

            historyItem.addEventListener('click', (e) => {
                if (
                    !e.target.classList.contains('history-title-input') &&
                    !e.target.classList.contains('delete-button') &&
                    !e.target.classList.contains('bi-x')
                ) {
                    this.loadConversation(item);
                }
            });

            this.historyList.appendChild(historyItem);
        });
    }

    async saveHistory(conversation) {
        await this.saveRecentConversation(conversation);

        const history = await this.getHistory();
        const firstMessage = conversation.messages[0];
        if (!firstMessage) return;

        const existingIndex = history.findIndex(h => {
            const firstHistoryMessage = h.conversation.messages[0];
            return firstHistoryMessage &&
                firstHistoryMessage.content === firstMessage.content &&
                firstHistoryMessage.timestamp === firstMessage.timestamp;
        });

        const title = await this.generateTitle(conversation.messages);

        const historyItem = {
            id: existingIndex >= 0 ? history[existingIndex].id : Date.now(),
            title: title,
            provider: conversation.provider,
            model: conversation.model,
            timestamp: new Date().toISOString(),
            conversation: conversation
        };

        if (existingIndex >= 0) {
            history[existingIndex] = historyItem;
        } else {
            history.unshift(historyItem);
        }

        const trimmedHistory = history.slice(0, this.MAX_HISTORY);
        await this.setHistory(trimmedHistory);

        await this.renderHistoryList();
    }

    async updateTitle(historyId, newTitle) {
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
        const history = await this.getHistory();
        const updatedHistory = history.filter(h => h.id !== historyId);
        await this.setHistory(updatedHistory);
        await this.renderHistoryList();
    }

    async loadConversation(historyItem) {
        const currentConfig = await this.getCurrentApiConfig();
        const historyProvider = historyItem.provider;
        const historyModel = historyItem.model;

        const chatTabButton = document.querySelector('[data-bs-target="#chatTab"]');
        if (chatTabButton) {
            const tab = new bootstrap.Tab(chatTabButton);
            tab.show();
        }

        window.dispatchEvent(new CustomEvent('loadConversation', {
            detail: {
                provider: historyProvider,
                model: historyModel,
                messages: historyItem.conversation.messages,
                source: 'historyTab'
            }
        }));

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
        return ChatHistory.getItems(keys);
    }
}

const style = document.createElement('style');
style.textContent = `
    .history-title-input {
        background: transparent;
        border: 1px solid transparent;
        width: 100%;
        padding: 0;
    }
    .history-title-input:not([readonly]):focus {
        background: white;
        border-color: #dee2e6;
        padding: 0.375rem;
    }
    .delete-button {
        color: #6c757d;
        opacity: 0.5;
        transition: opacity 0.2s;
    }
    .delete-button:hover {
        opacity: 1;
        color: #dc3545;
    }
    .history-item {
        cursor: pointer;
    }
    .history-item:hover {
        background-color: rgba(0, 0, 0, 0.05);
    }

    #modelMismatchWarning {
        background-color: #fff3cd;
        border: 1px solid #ffeeba;
        color: #856404;
        padding: 1rem;
        margin: 1rem;
        border-radius: 0.25rem;
        text-align: center;
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    const chatHistory = new ChatHistory();

    window.addEventListener('saveConversation', (event) => {
        chatHistory.saveHistory(event.detail);
    });

    // Optional: Clear recentConversation on CLEAR_CHAT
    window.addEventListener('message', (event) => {
        if (event.data.type === 'CLEAR_CHAT') {
            console.log('[ChatHistory] Received CLEAR_CHAT message at 04:27 AM EAT, May 22, 2025, clearing recent conversation');
            chatHistory.saveRecentConversation(null);
        }
    });
});
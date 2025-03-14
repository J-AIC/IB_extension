// chat_history.js
class ChatHistory {
    constructor() {
        // 定数定義
        this.MAX_HISTORY = 30;

        // 使用するストレージキー
        this.storageKey = 'chat_history';
        this.recentConversationKey = 'recent_conversation';  // 追加: 必須の定義

        // 現在アクティブなタブ
        this.currentTab = 'chat';

        // UI初期化
        this.initializeUI();
    }

    // -------------------------------------------------------------------------
    // UI 初期化とイベント設定
    // -------------------------------------------------------------------------
    async initializeUI() {
        // DOM取得
        this.historyList = document.getElementById('historyList');
        this.template = document.getElementById('historyItemTemplate');
        this.historyTab = document.getElementById('history-tab');

        // モーダルのクローズボタン設定
        const closeModalButton = document.getElementById('closeModalButton');
        if (closeModalButton) {
            closeModalButton.addEventListener('click', () => {
                const modal = document.getElementById('formContentModal');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        }

        // タブ切り替えイベントのリスナーを追加
        document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(button => {
            button.addEventListener('shown.bs.tab', (event) => {
                if (event.target.id === 'history-tab') {
                    // 履歴タブが表示されたときに履歴を再描画
                    this.renderHistoryList();
                }
                this.currentTab = event.target.id;
            });
        });

        // 履歴の読み込み
        await this.loadHistory();

        // 直近の会話を復元
        const recentConversation = await this.getRecentConversation();
        if (recentConversation) {
            const currentConfig = await this.getCurrentApiConfig();
            const recentProvider = recentConversation.provider;
            const recentModel = recentConversation.model;

            // プロバイダーとモデルの互換性をチェック
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

    // -------------------------------------------------------------------------
    // ストレージとのやり取り（共通ヘルパー）
    // -------------------------------------------------------------------------
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

    /**
     * 複数キーの取得用ヘルパー
     * @param {string[]} keys 
     * @returns {object} { key: value }
     */
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
                    // 文字列としてそのまま格納
                }
                result[key] = value;
            });
            return result;
        }
    }

    // -------------------------------------------------------------------------
    // ストレージとのやり取り（履歴・直近会話の保存／取得）
    // -------------------------------------------------------------------------
    async getHistory() {
        const stored = await ChatHistory.getItem(this.storageKey);
        return stored || []; // 履歴が何もない場合は空配列
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

    // -------------------------------------------------------------------------
    // 履歴のロード・表示
    // -------------------------------------------------------------------------
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

        // timestampで降順ソート
        const sortedHistory = history.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        this.historyList.innerHTML = '';

        console.log('chrome.i18n available:', !!chrome.i18n);
        console.log('noHistory message:', chrome.i18n.getMessage('noHistory'));

        if (sortedHistory.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'p-3 text-muted';
            // i18nの初期化を待つ
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

            // タイトル（ダブルクリックで編集）
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

            // 削除ボタン
            deleteButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.deleteHistory(item.id);
            });

            // 履歴アイテム全体クリック時（会話ロード）
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

    // -------------------------------------------------------------------------
    // 履歴への保存・タイトル更新・削除
    // -------------------------------------------------------------------------
    async saveHistory(conversation) {
        // 直近の会話として保存
        await this.saveRecentConversation(conversation);

        const history = await this.getHistory();
        const firstMessage = conversation.messages[0];
        if (!firstMessage) return;

        // 既存の同一会話があるかチェック
        const existingIndex = history.findIndex(h => {
            const firstHistoryMessage = h.conversation.messages[0];
            return firstHistoryMessage &&
                firstHistoryMessage.content === firstMessage.content &&
                firstHistoryMessage.timestamp === firstMessage.timestamp;
        });

        // タイトル自動生成
        const title = await this.generateTitle(conversation.messages);

        // 新しい履歴項目
        const historyItem = {
            id: existingIndex >= 0 ? history[existingIndex].id : Date.now(),
            title: title,
            provider: conversation.provider,
            model: conversation.model,
            timestamp: new Date().toISOString(),
            conversation: conversation
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

    // -------------------------------------------------------------------------
    // 履歴からの会話ロード
    // -------------------------------------------------------------------------
    async loadConversation(historyItem) {
        const currentConfig = await this.getCurrentApiConfig();
        const historyProvider = historyItem.provider;
        const historyModel = historyItem.model;

        // チャットタブに切り替え
        const chatTabButton = document.querySelector('[data-bs-target="#chatTab"]');
        if (chatTabButton) {
            const tab = new bootstrap.Tab(chatTabButton);
            tab.show();
        }

        // イベントの detail 構造を修正
        window.dispatchEvent(new CustomEvent('loadConversation', {
            detail: {
                provider: historyProvider,
                model: historyModel,
                messages: historyItem.conversation.messages,
                source: 'historyTab'
            }
        }));

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
// スタイルの追加
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// メインの処理
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const chatHistory = new ChatHistory();

    window.addEventListener('saveConversation', (event) => {
        chatHistory.saveHistory(event.detail);
    });
});

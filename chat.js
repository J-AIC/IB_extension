// chat.js
//=======================================================
// ■メイン: チャット画面の制御スクリプト
//=======================================================

// [追加] 共通モジュールをインポート
import { sendChatRequest } from './apiClient.js';

/*****************************************************
 * 1. グローバル変数および定数
 *****************************************************/
let checkedUrls = new Set();
let messageHtmlContent = new Map();
let pageTitle = '';
let pageUrl = '';
let messages = [];
let currentProvider = null;
let currentModel = null;

// DOM要素のキャッシュ（DOMContentLoaded以後に取得）
let messageInput;
let sendButton;
let chatMessages;
let chatInput;
let featureControls;
let pageContextToggle;
let historyTabContent;
let newChatButton;

/*****************************************************
 * 2. クラス定義：ChatController
 *****************************************************/
class ChatController {
    constructor(config = {}) {
        this.config = {
            maxTurns: 4,
            systemPrompt: `You are a high-performance AI assistant. Please respond according to the following instructions:

# Basic Behavior
- The message posted by the user is stored in ("Current user message").
- Respond in the same language used by the user in ("Current user message").
- Keep your responses concise and accurate.
- Do not use decorations or markdown.

# Processing Conversation History
- Understand the context by referring to the provided markdown formatted conversation history ("Recent dialogue").
- Each turn is provided as "Turn X" and contains the conversation between the user and the assistant.
- Aim for responses that remain consistent with the previous conversation.

# Processing Web Information
- If a "Page Context" section exists, consider the content of that webpage when answering.
- Use the webpage information as supplementary, referring only to parts directly related to the user's question.`,
            ...config
        };
        this.turns = [];
        this.currentUserMessage = null;
        this.isProcessing = false;  // メッセージ処理中フラグ
        this.abortController = null;  // 処理中断用のコントローラー
    }

    // --- 既存のメソッド群 ---
    addMessage(message) {
        if (message.role === 'user') {
            this.currentUserMessage = message;
        } else if (message.role === 'assistant' && this.currentUserMessage) {
            this.turns.push({
                user: this.currentUserMessage,
                assistant: message
            });
            this.currentUserMessage = null;
            this.trimOldTurns();
        }
        return this.getState();
    }

    getState() {
        return {
            turns: this.turns.slice(-this.config.maxTurns),
            currentUserMessage: this.currentUserMessage
        };
    }

    buildMarkdownPrompt(options = {}) {
        let markdown = '';
        if (this.turns.length > 0) {
            markdown += "# Recent dialogue\n\n";
            this.turns.slice(-this.config.maxTurns).forEach((turn, index) => {
                markdown += `## Turn ${index + 1}\n\n`;
                const userContent = this.stripSiteInfo(turn.user.content);
                markdown += `### User\n\n\`\`\`\n${userContent}\n\`\`\`\n\n`;
                markdown += `### Assistant\n\n\`\`\`\n${turn.assistant.content}\n\`\`\`\n\n`;
            });
        }
        if (this.currentUserMessage) {
            markdown += "# Current user message\n\n";
            markdown += `\`\`\`\n${this.currentUserMessage.content}\n\`\`\`\n\n`;

            if (options.includeWebInfo && options.webContent) {
                markdown += "# Page Context\n\n";
                markdown += `\`\`\`html\n${options.webContent}\n\`\`\`\n\n`;
            }
        }
        return markdown;
    }

    stripSiteInfo(content) {
        const siteInfoIndex = content.indexOf('\n\n---\n### Page Context');
        if (siteInfoIndex !== -1) {
            return content.substring(0, siteInfoIndex);
        }
        return content;
    }

    trimOldTurns() {
        if (this.turns.length > this.config.maxTurns) {
            this.turns = this.turns.slice(-this.config.maxTurns);
        }
    }

    // --- 新しいメソッド群 ---
    setProcessing(isProcessing) {
        this.isProcessing = isProcessing;
        if (isProcessing) {
            this.abortController = new AbortController();
        } else {
            this.abortController = null;
        }
    }

    cancelProcessing() {
        if (this.isProcessing && this.abortController) {
            this.abortController.abort();
            this.setProcessing(false);
        }
    }

    clear() {
        this.cancelProcessing();
        this.turns = [];
        this.currentUserMessage = null;
    }

    setSystemPrompt(prompt) {
        this.config.systemPrompt = prompt;
    }

    getSystemPrompt() {
        return this.config.systemPrompt;
    }
}

/*****************************************************
 * 3. ユーティリティ関数
 *****************************************************/

/**
 * HTMLタグを除去してテキストだけを取り出す
 */
function stripHTML(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return doc.body.textContent || "";
}

/**
 * ストレージアクセス用のヘルパー
 */
const storage = {
    get: async function (keys) {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise((resolve) => {
                chrome.storage.local.get(keys, resolve);
            });
        } else {
            // 非Chrome環境用フォールバック
            const result = {};
            keys.forEach(key => {
                const value = localStorage.getItem(key);
                try {
                    result[key] = JSON.parse(value);
                } catch {
                    result[key] = value;
                }
            });
            return result;
        }
    }
};

/*****************************************************
 * 4. DOM操作・UI関連の関数
 *****************************************************/

/**
 * 警告メッセージを表示するかどうかを制御
 */
function toggleChatInput(show, message = '') {
    const chatInput = document.getElementById('chatInput');
    const featureControls = document.querySelector('.feature-controls');
    const contentArea = document.querySelector('.content-area');

    const existingWarning = document.getElementById('modelMismatchWarning');
    if (existingWarning) {
        existingWarning.remove();
    }

    if (show) {
        chatInput.style.display = 'block';
        featureControls.style.display = 'block';
    } else {
        chatInput.style.display = 'none';
        featureControls.style.display = 'none';

        if (message) {
            const warningDiv = document.createElement('div');
            warningDiv.id = 'modelMismatchWarning';
            warningDiv.className = 'alert alert-warning m-3';
            warningDiv.textContent = message;
            contentArea.appendChild(warningDiv);
        }
    }
}

/**
 * システムメッセージを表示
 */
function addSystemMessage(content, recommendations = [], timestamp = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';

    const messageTime = timestamp
        ? new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

    let messageHTML = `
        <div class="message-content">
            <div>${content}</div>
    `;
    if (recommendations.length > 0) {
        recommendations.forEach(rec => {
            messageHTML += `
                <button class="recommendation-button">
                    <i class="bi bi-question-circle"></i>
                    ${rec}
                </button>
            `;
        });
    }
    messageHTML += `<div class="timestamp">${messageTime}</div></div>`;
    messageDiv.innerHTML = messageHTML;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * ユーザーメッセージを表示
 */
function addUserMessage(content, pageHTML = '', timestamp = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';

    const messageId = generateMessageId();
    messageDiv.id = messageId;

    const messageTime = timestamp
        ? new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

    let siteInfoButton = '';
    if (pageHTML) {
        messageHtmlContent.set(messageId, pageHTML);
        siteInfoButton = `
            <button class="site-info-btn" data-message-id="${messageId}">
                <i class="bi bi-globe"></i>
            </button>
        `;
    }

    let editButton = '';
    if (messages.length > 0) {
        editButton = `
            <button class="edit-message-btn" data-message-id="${messageId}" style="display: none;">
                <i class="bi bi-pencil"></i>
            </button>
        `;
    }

    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-text" data-original-content="${content}">${content}</div>
            <div class="edit-area" data-has-listeners="false">
                <textarea class="form-control">${content}</textarea>
                <div class="edit-buttons">
                    <button class="btn btn-secondary cancel-edit">キャンセル</button>
                    <button class="btn btn-primary save-edit">保存</button>
                </div>
            </div>
            <div class="message-footer">
                <span class="timestamp">${messageTime}</span>
                ${editButton}
                ${siteInfoButton}
            </div>
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 編集ボタンの動作
    const editBtn = messageDiv.querySelector('.edit-message-btn');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!messageDiv.classList.contains('processing') && !messageDiv.classList.contains('editing')) {
                enableEditMode(messageId);
            }
        });

        // 編集可能性をチェック
        canEditMessage(timestamp || new Date().toISOString())
            .then(canEdit => {
                editBtn.style.display = canEdit ? 'inline-block' : 'none';
            })
            .catch(error => {
                console.error('Edit permission check failed:', error);
                editBtn.style.display = 'none';
            });
    }

    // サイト情報ボタン
    if (siteInfoButton) {
        const viewSiteBtn = messageDiv.querySelector('.site-info-btn');
        if (viewSiteBtn) {
            viewSiteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showSiteInfoModal(messageId);
            });
        }
    }

    // テキストエリアの自動高さ調整
    const textarea = messageDiv.querySelector('textarea');
    if (textarea) {
        textarea.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    }

    // エラー状態のリセット機能
    const resetError = () => {
        messageDiv.classList.remove('error');
        const errorMessage = messageDiv.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    };

    // エラー表示機能
    const showError = (errorMessage) => {
        resetError();
        messageDiv.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = errorMessage;
        messageDiv.querySelector('.message-content').appendChild(errorDiv);
    };

    messageDiv.resetError = resetError;
    messageDiv.showError = showError;

    return messageDiv;
}

/**
 * メッセージIDを一意に生成
 */
function generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * メッセージの編集モードを有効にする
 */
function enableEditMode(messageId) {
    const messageDiv = document.getElementById(messageId);
    if (!messageDiv) return;

    if (messageDiv.classList.contains('editing')) return; // すでに編集中なら何もしない

    messageDiv.classList.add('editing');
    const textarea = messageDiv.querySelector('.edit-area textarea');
    if (!textarea) return;

    const currentContent = messageDiv.querySelector('.message-text').textContent;
    textarea.value = currentContent;
    textarea.focus();

    const editArea = messageDiv.querySelector('.edit-area');
    if (!editArea) return;

    if (editArea.dataset.hasListeners === 'true') {
        return;
    }

    const cancelBtn = editArea.querySelector('.cancel-edit');
    const saveBtn = editArea.querySelector('.save-edit');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            messageDiv.classList.remove('editing');
            textarea.value = currentContent;
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const newContent = textarea.value.trim();
            if (!newContent) return;

            messageDiv.classList.add('processing');
            try {
                await handleMessageEdit(messageId, newContent);
                messageDiv.classList.remove('editing');
            } catch (error) {
                console.error('Message edit error:', error);
                addSystemMessage(`編集エラー: ${error.message}`);
            } finally {
                messageDiv.classList.remove('processing');
            }
        });
    }

    editArea.dataset.hasListeners = 'true';
}

/**
 * メッセージが編集可能かどうかをチェック
 */
async function canEditMessage(messageTimestamp) {
    // ❶ 履歴からロードした会話のプロバイダー・モデル（グローバル）
    const conversationProvider = currentProvider;
    const conversationModel = currentModel;

    // ❷ 現在ストレージから取得したプロバイダー・モデル
    const result = await storage.get([
        'apiProvider',
        'selectedModels',
        'customSettings'
    ]);
    const actualProvider = result.apiProvider;
    const actualModel = result.selectedModels?.[actualProvider];

    // ❸ プロバイダーが不一致なら false
    if (conversationProvider !== actualProvider) {
        return false;
    }

    // ❹ local 以外ならモデルもチェック
    if (conversationProvider !== 'local' && conversationModel !== actualModel) {
        return false;
    }

    return true;
}

/**
 * メッセージの編集処理を実行
 */
async function handleMessageEdit(messageId, newContent) {
    const messageDiv = document.getElementById(messageId);
    if (!messageDiv) return;

    const messageText = messageDiv.querySelector('.message-text');
    if (!messageText) return;

    const originalContent = messageText.textContent;
    try {
        messageText.textContent = newContent;
        const newTimestamp = new Date().toISOString();
        const timestampElement = messageDiv.querySelector('.timestamp');
        if (timestampElement) {
            timestampElement.textContent = new Date(newTimestamp).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // メッセージ配列の更新
        const messageIndex = messages.findIndex(msg =>
            msg.role === 'user' && msg.content === originalContent
        );

        if (messageIndex !== -1) {
            // 後続メッセージを削除
            const nextMessages = Array.from(messageDiv.parentElement.children)
                .slice(Array.from(messageDiv.parentElement.children).indexOf(messageDiv) + 1);
            nextMessages.forEach(el => el.remove());

            messages = messages.slice(0, messageIndex + 1);
            messages[messageIndex].content = newContent;
            messages[messageIndex].timestamp = newTimestamp;

            // コントローラーを再構成
            chatController.clear();
            messages.forEach(msg => chatController.addMessage(msg));

            const pageHTML = messageHtmlContent.get(messageId) || '';
            await regenerateResponse(messageIndex, newContent, newTimestamp, pageHTML);
        }
    } catch (error) {
        messageText.textContent = originalContent;
        throw error;
    }
}

/**
 * ユーザーメッセージ変更後、応答を再生成
 */
async function regenerateResponse(messageIndex, newContent, newTimestamp, pageHTML = '') {
    try {
        chatController.setProcessing(true);
        const unifiedPrompt = chatController.buildMarkdownPrompt({
            includeWebInfo: !!pageHTML,
            webContent: pageHTML
        });

        const result = await storage.get([
            'apiProvider',
            'apiKeys',
            'selectedModels',
            'customSettings'
        ]);

        const apiConfig = {
            provider: result.apiProvider,
            model: result.selectedModels?.[result.apiProvider] ?? ' ',
            apiKey: result.apiKeys[result.apiProvider],
            systemPrompt: chatController.getSystemPrompt(),
            customSettings: result.customSettings[result.apiProvider] || {},
            abortController: chatController.abortController
        };

        // 送信
        const responseText = await sendChatRequest(apiConfig, unifiedPrompt);

        const assistantMessage = {
            role: 'assistant',
            content: responseText,
            timestamp: new Date().toISOString()
        };

        messages.push(assistantMessage);
        chatController.addMessage(assistantMessage);
        addSystemMessage(responseText, [], assistantMessage.timestamp);

        // 履歴更新用イベント
        const conversation = {
            provider: result.apiProvider,
            model: result.selectedModels?.[result.apiProvider] ?? ' ',
            timestamp: newTimestamp,
            messages: messages.slice()
        };
        window.dispatchEvent(new CustomEvent('saveConversation', { detail: conversation }));
    } catch (error) {
        console.error('Edit message error:', error);
        addSystemMessage(`エラー: ${error.message}`);
    } finally {
        chatController.setProcessing(false);
    }
}

/**
 * サイト情報モーダルを表示
 */
function showSiteInfoModal(messageId) {
    const htmlContent = messageHtmlContent.get(messageId);
    if (!htmlContent) return;

    let modal = document.getElementById('siteInfoModal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="siteInfoModal" class="form-content-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5>サイト情報</h5>
                        <button type="button" class="btn-close" id="closeSiteModalButton"></button>
                    </div>
                    <div id="siteInfoBody" class="modal-body">
                        <div class="site-info-content">
                            <pre class="language-html"><code></code></pre>
                        </div>
                    </div>
                </div>
            </div>
        `);

        document.getElementById('closeSiteModalButton').addEventListener('click', () => {
            document.getElementById('siteInfoModal').classList.remove('active');
        });
    }

    const codeElement = document.querySelector('#siteInfoModal pre code');
    codeElement.textContent = htmlContent;
    document.getElementById('siteInfoModal').classList.add('active');
}

/*****************************************************
 * 6. ページごとのガイド表示・ステータス更新関連
 *****************************************************/

/**
 * ページURLに応じてガイドを表示
 */
async function checkUrlAndDisplayGuides() {
    console.group('Guide Display Debug');
    console.log('Current pageUrl:', pageUrl);
    console.log('Current pageTitle:', pageTitle);

    if (checkedUrls.has(pageUrl)) {
        console.log('URL already checked, skipping');
        console.groupEnd();
        return;
    }

    const storage_result = await storage.get([
        'apiProvider',
        'apiKeys',
        'customSettings',
        'guides',
        'guides_base'
    ]);

    console.log('Full storage data:', storage_result);

    // 1. Local API Case
    if (storage_result.apiProvider === 'local') {
        console.log('Checking Local API case');
        const localApiKey = storage_result.apiKeys?.local;
        const localUrl = storage_result.customSettings?.local?.url;

        if (localApiKey && localUrl) {
            try {
                const baseUrl = localUrl.replace(/\/+$/, '');
                console.log('Fetching from:', `${baseUrl}/widget/guides`);

                const response = await fetch(`${baseUrl}/widget/guides`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localApiKey}`
                    },
                    body: JSON.stringify({
                        token: localApiKey,
                        url: pageUrl
                    })
                });

                const data = await response.json();
                console.log('Local API GUIDE response:', data);

                if (!response.ok) {
                    throw new Error(data.error || data.message || 'API呼び出しに失敗しました');
                }

                if (data.urlGuides && Array.isArray(data.urlGuides)) {
                    const titles = data.urlGuides
                        .filter(g => g.title)
                        .map(g => g.title);

                    console.log('Filtered Guide Titles:', titles);
                    if (titles.length > 0) {
                        addSystemMessage(
                            chrome.i18n.getMessage("guideListTitle", [pageTitle]),
                            titles
                        );
                        checkedUrls.add(pageUrl);
                        console.log('Added guides from Local API');
                        console.groupEnd();
                        return;
                    }
                }
            } catch (error) {
                console.error('Local API error:', error);
            }
        }
    }

    // 2. Guides (extension internal) Case
    try {
        console.log('Starting guides check');
        if (storage_result.guides) {
            const guides = Array.isArray(storage_result.guides)
                ? storage_result.guides
                : JSON.parse(storage_result.guides);

            console.log('Parsed guides:', guides);

            for (const guide of guides) {
                console.log('Checking guide:', guide);
                console.log('Testing URL:', pageUrl, 'against pattern:', guide.guideUrl);

                const matches = guide.guideUrl.includes('*')
                    ? new RegExp(guide.guideUrl.replace(/\*/g, '.*')).test(pageUrl)
                    : guide.guideUrl === pageUrl;

                console.log('URL match result:', matches);

                if (matches) {
                    const titles = guide.guideCards
                        .filter(card => card.title)
                        .map(card => card.title)
                        .slice(0, 5);

                    console.log('Matched guide titles:', titles);

                    if (titles.length > 0) {
                        addSystemMessage(
                            chrome.i18n.getMessage("guideListTitle", [pageTitle]),
                            titles
                        );
                        checkedUrls.add(pageUrl);
                        console.log('Successfully added guide guides');
                        console.groupEnd();
                        return;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing guides:', error);
    }

    // 3. Base Guides (global base) Case
    try {
        console.log('Starting guides_base check');
        if (storage_result.guides_base) {
            const base_guides = Array.isArray(storage_result.guides_base)
                ? storage_result.guides_base
                : JSON.parse(storage_result.guides_base);

            console.log('Parsed base guides:', base_guides);

            const titles = base_guides
                .filter(guide => guide.title)
                .map(guide => guide.title)
                .slice(0, 5);

            console.log('Base guide titles:', titles);

            if (titles.length > 0) {
                addSystemMessage(
                    chrome.i18n.getMessage("guideListTitle", [pageTitle]),
                    titles
                );
                checkedUrls.add(pageUrl);
                console.log('Successfully added base guide guides');
            }
        }
    } catch (error) {
        console.error('Error processing base guides:', error);
    }

    console.groupEnd();
}

/**
 * APIステータス表示を更新
 */
async function updateApiStatus() {
    const apiStatus = document.getElementById('apiStatus');
    if (!apiStatus) return;

    const result = await storage.get([
        'apiProvider',
        'selectedModels',
        'apiKeys',
        'customSettings'
    ]);

    if (!result.apiProvider) {
        apiStatus.innerHTML = '<a href="api_settings.html" class="text-decoration-none" target="_blank">APIプロバイダー設定をしてください</a>';
        return;
    }

    let statusText = result.apiProvider.toUpperCase();
    if (result.apiProvider === 'local') {
        statusText = 'Local API';
    } else if (result.apiProvider === 'compatible') {
        const modelId = result.selectedModels?.compatible;
        if (modelId) {
            statusText += ` (${modelId})`;
        }
    } else if (result.selectedModels && result.selectedModels[result.apiProvider]) {
        statusText += ` (${result.selectedModels[result.apiProvider]})`;
    }

    apiStatus.textContent = statusText;

    // メッセージ編集ボタンの表示状態を更新
    const currentProvider = result.apiProvider;
    const currentModel = result.selectedModels?.[currentProvider];

    document.querySelectorAll('.message.user').forEach(messageDiv => {
        const editBtn = messageDiv.querySelector('.edit-message-btn');
        if (editBtn) {
            const canEdit = currentProvider === 'local' ||
                (result.apiProvider === currentProvider &&
                    result.selectedModels?.[currentProvider] === currentModel);
            editBtn.style.display = canEdit ? 'inline-block' : 'none';
        }
    });
}

/*****************************************************
 * 7. イベントリスナー登録と初期化処理
 *****************************************************/

document.addEventListener('DOMContentLoaded', async () => {
    // タブ切り替えイベント
    document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(button => {
        button.addEventListener('shown.bs.tab', event => {
            // いったん全タブ非表示に
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.add('d-none');
            });
            // クリックされたタブに対応するpaneを表示
            const targetPane = document.querySelector(event.target.getAttribute('data-bs-target'));
            targetPane.classList.remove('d-none');

            if (event.target.id !== 'chat-tab') {
                const mismatchWarning = document.getElementById('modelMismatchWarning');
                if (mismatchWarning) {
                    mismatchWarning.style.display = 'none';
                }
            }
        });
    });

    // アクティブなタブを見て該当paneを表示
    const activeTab = document.querySelector('.nav-link.active');
    if (activeTab) {
        const targetPane = document.querySelector(activeTab.getAttribute('data-bs-target'));
        if (targetPane) {
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.add('d-none');
            });
            targetPane.classList.remove('d-none');
        }
    }

    // DOM要素取得
    messageInput = document.getElementById('messageInput');
    sendButton = document.getElementById('sendButton');
    chatMessages = document.getElementById('chatMessages');
    chatInput = document.getElementById('chatInput');
    featureControls = document.querySelector('.feature-controls');
    pageContextToggle = document.getElementById('pageContextToggle');
    historyTabContent = document.getElementById('historyTab');
    newChatButton = document.getElementById('newChatButton');

    // ChatControllerインスタンス生成
    window.chatController = new ChatController();

    // メインのメッセージ送信処理
    const sendMessage = async () => {
        if (chatController.isProcessing) {
            console.log('メッセージ処理中のため、新しいメッセージは送信できません');
            return;
        }

        const rawMessage = messageInput.value.trim();
        if (!rawMessage) return;

        let pageHTML = '';
        if (pageContextToggle?.checked && chrome?.tabs) {
            try {
                // ▼ ページ内容取得ロジック
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
                const isPDF = pageInfo.url.toLowerCase().endsWith('.pdf')
                    || pageInfo.contentType.toLowerCase() === 'application/pdf';

                if (isPDF) {
                    // PDFのテキスト抽出
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['assets/js/pdf.min.js']
                    });

                    const pdfResult = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: async () => {
                            try {
                                pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/js/pdf.worker.min.js');
                                const response = await fetch(window.location.href);
                                const pdfData = await response.arrayBuffer();

                                const loadingTask = pdfjsLib.getDocument({
                                    data: pdfData
                                });
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

                    pageHTML = pdfResult?.[0]?.result || '';
                    pageTitle = 'PDF Document';

                } else {
                    // HTMLの場合
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['assets/js/Readability.js']
                    });
                    const articleResult = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
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
                    pageHTML = articleResult?.[0]?.result || '';
                    pageTitle = document.title || 'WebPage';
                }
            } catch (err) {
                console.error('ページ情報の取得に失敗:', err);
            }
        }

        // ユーザーメッセージを表示
        addUserMessage(rawMessage, pageHTML);
        const userMessage = {
            role: 'user',
            content: rawMessage,
            timestamp: new Date().toISOString()
        };
        messages.push(userMessage);
        chatController.addMessage(userMessage);

        // 入力クリア
        messageInput.value = '';
        adjustTextareaHeight(messageInput);

        // ストレージからAPI設定取得
        const result = await storage.get([
            'apiProvider',
            'apiKeys',
            'selectedModels',
            'customSettings'
        ]);

        if (!result.apiProvider || !result.apiKeys) {
            addSystemMessage('APIが設定されていません');
            return;
        }

        try {
            chatController.setProcessing(true);

            // 会話 + Web情報をMarkdownに
            const unifiedPrompt = chatController.buildMarkdownPrompt({
                includeWebInfo: !!pageHTML,
                webContent: pageHTML
            });

            const apiConfig = {
                provider: result.apiProvider,
                model: result.selectedModels?.[result.apiProvider] ?? ' ',
                apiKey: result.apiKeys[result.apiProvider],
                systemPrompt: chatController.getSystemPrompt(),
                customSettings: result.customSettings[result.apiProvider] || {},
                abortController: chatController.abortController
            };

            // 共通モジュールで送信
            const responseText = await sendChatRequest(apiConfig, unifiedPrompt);

            // アシスタントメッセージを表示
            const assistantMessage = {
                role: 'assistant',
                content: responseText,
                timestamp: new Date().toISOString()
            };

            messages.push(assistantMessage);
            chatController.addMessage(assistantMessage);
            addSystemMessage(responseText);

            // 履歴保存イベント
            const conversation = {
                provider: result.apiProvider,
                model: result.selectedModels?.[result.apiProvider] ?? ' ',
                timestamp: new Date().toISOString(),
                messages: messages.slice()
            };
            window.dispatchEvent(new CustomEvent('saveConversation', { detail: conversation }));

            await updateApiStatus();
        } catch (error) {
            console.error('Send message error:', error);
            addSystemMessage(`エラー: ${error.message}`);
        } finally {
            chatController.setProcessing(false);
        }
    };

    // テキストエリアの高さ調整
    function adjustTextareaHeight(element) {
        element.style.height = 'auto';
        element.style.height = element.scrollHeight + 'px';
    }

    // 送信ボタンのEnterキー対応
    messageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    messageInput.addEventListener('input', function () {
        adjustTextareaHeight(this);
    });
    sendButton.addEventListener('click', sendMessage);

    // 推奨候補(ボタン) クリック時
    chatMessages.addEventListener('click', (e) => {
        const recommendationButton = e.target.closest('.recommendation-button');
        if (recommendationButton) {
            const buttonText = recommendationButton.textContent.trim();
            messageInput.value = buttonText;
            messageInput.focus();
            adjustTextareaHeight(messageInput);
        }
    });

    // 履歴から会話ロード
    window.addEventListener('loadConversation', async (event) => {
        const conversation = event.detail;
        const isFromHistoryTab = conversation.source === 'historyTab';

        if (isFromHistoryTab) {
            // 履歴タブからのロード時
            chatMessages.innerHTML = '';
            messages = [];

            // グローバルに現在の provider, model をセット
            currentProvider = conversation.provider;
            currentModel = conversation.model;

            // 現在の設定と一致するかチェック
            const currentStorage = await storage.get(['apiProvider', 'selectedModels']);
            const actualProvider = currentStorage.apiProvider;
            const actualModel = currentStorage.selectedModels?.[actualProvider] ?? '';

            if (actualProvider === currentProvider) {
                if (actualProvider === 'local' || actualProvider === 'azureOpenai') {
                    // local / azureOpenai はモデルチェック不要
                    toggleChatInput(true);
                } else if (actualModel === currentModel) {
                    toggleChatInput(true);
                } else {
                    // モデル不一致
                    const message = chrome.i18n.getMessage('modelMismatchError', [
                        currentProvider.toUpperCase(),
                        currentModel,
                        actualModel
                    ]);
                    toggleChatInput(false, message);
                }
            } else {
                // プロバイダー不一致
                let message;
                if (currentProvider === 'local') {
                    message = chrome.i18n.getMessage('localApiChatError', [
                        actualProvider.toUpperCase()
                    ]);
                } else if (actualProvider === 'local') {
                    message = chrome.i18n.getMessage('providerChatError', [
                        currentProvider.toUpperCase(),
                        currentModel
                    ]);
                } else {
                    // fallback
                    message = chrome.i18n.getMessage('chatContinuationError', [
                        currentProvider.toUpperCase(),
                        currentModel,
                        actualProvider.toUpperCase(),
                        actualModel
                    ]);
                }
                toggleChatInput(false, message);
            }

            // メッセージ描画
            conversation.messages.forEach(msg => {
                if (msg.role === 'user') {
                    addUserMessage(msg.content, '', msg.timestamp);
                } else if (msg.role === 'assistant') {
                    addSystemMessage(msg.content, [], msg.timestamp);
                }
                messages.push(msg);
            });

            // ChatControllerに再ロード
            chatController.clear();
            conversation.messages.forEach(msg => chatController.addMessage(msg));
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });

    // 設定ボタン
    const settingsButton = document.getElementById('settingsButton');
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.location.href = 'api_settings.html';
            }
        });
    }

    // APIコンフィグ更新イベント
    window.addEventListener('message', async function (event) {
        if (event.data.type === 'API_CONFIG_UPDATED') {
            await updateApiStatus();
        }
    });

    // DOM変更の監視
    const observer = new MutationObserver(mutations => {
        const locationChanged = mutations.some(mutation =>
            mutation.target.nodeType === Node.ELEMENT_NODE &&
            mutation.target.tagName === 'BODY'
        );
        if (locationChanged) {
            getParentPageInfo();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ページコンテキスト取得用チェックボックス
    if (pageContextToggle) {
        pageContextToggle.addEventListener('change', function () {
            if (this.checked && chrome?.tabs) {
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        func: () => {
                            function cleanHTML(node) {
                                const excludeTags = ['script', 'style', 'noscript', 'iframe', 'svg'];
                                if (excludeTags.includes(node.nodeName.toLowerCase())) return '';
                                if (node.nodeType === Node.TEXT_NODE) {
                                    return node.textContent.replace(/\s+/g, ' ').trim();
                                }
                                const children = Array.from(node.childNodes)
                                    .map(child => cleanHTML(child))
                                    .join('');
                                if (!children.trim()) return '';
                                const tagName = node.nodeName.toLowerCase();
                                const structuralTags = ['p', 'section', 'article', 'header', 'footer', 'main', 'nav'];
                                if (structuralTags.includes(tagName) && children.trim()) {
                                    return `<${tagName}>${children}</${tagName}>`;
                                }
                                return children;
                            }
                            return cleanHTML(document.body)
                                .replace(/\s+/g, ' ')
                                .replace(/<([^>]+)>\s*<\/\1>/g, '')
                                .replace(/\s*(<[^>]+>)\s*/g, '$1')
                                .trim();
                        }
                    }, (results) => {
                        if (results && results[0]) {
                            const cleanedContent = results[0].result;
                            const contentDisplay = document.getElementById('contentDisplay');
                            if (contentDisplay) {
                                contentDisplay.textContent = cleanedContent;
                            }
                        }
                    });
                });
            } else {
                const contentDisplay = document.getElementById('contentDisplay');
                if (contentDisplay) {
                    contentDisplay.textContent = '';
                }
            }
        });
    }

    // 親ページ情報の取得
    async function getParentPageInfo() {
        return new Promise((resolve) => {
            window.parent.postMessage({ type: 'GET_PAGE_INFO' }, '*');
            window.addEventListener('message', async function (event) {
                if (event.data.type === 'PAGE_INFO') {
                    pageTitle = event.data.title;
                    pageUrl = event.data.url;

                    // guides 表示
                    checkUrlAndDisplayGuides();

                    // localAPI + URLマッチで #htmlTab 切り替え
                    const isMatched = await checkLocalApiUrlMatch(pageUrl);
                    toggleHtmlTabVisibility(isMatched);

                    resolve({ title: pageTitle, url: pageUrl });
                }
            }, { once: true });
        });
    }

    let hasClickedHtmlTabOnce = false;
    function toggleHtmlTabVisibility(show) {
        const htmlTabItem = document.getElementById("htmlTabItem");
        if (!htmlTabItem) return;

        if (show) {
            htmlTabItem.style.display = "block";
            if (!hasClickedHtmlTabOnce) {
                document.getElementById("html-tab").click();
                hasClickedHtmlTabOnce = true;
            }
        } else {
            htmlTabItem.style.display = "none";
        }
    }

    // 新しいチャットボタン
    if (newChatButton) {
        newChatButton.addEventListener('click', () => {
            chatMessages.innerHTML = '';
            messages = [];
            chatController.clear();
            messageInput.value = '';
            const warningMessage = document.getElementById('modelMismatchWarning');
            if (warningMessage) {
                warningMessage.remove();
            }
            toggleChatInput(true);
            const chatTabButton = document.getElementById('chat-tab');
            if (chatTabButton) {
                chatTabButton.click();
            }
        });
    }

    // 初期化処理
    async function initialize() {
        await updateApiStatus();

        const chatTabPane = document.getElementById('chatTab');
        if (chatTabPane) {
            chatTabPane.classList.remove('d-none');
            chatTabPane.classList.add('show', 'active');
        }

        if (pageContextToggle) {
            const result = await storage.get(['apiProvider']);
            // localに限定せず、常にページ情報取得可能
            pageContextToggle.checked = (result.apiProvider === 'local');
            getParentPageInfo();
        }

        const localApiControls = document.getElementById('localApiControls');
        if (localApiControls) {
            const result = await storage.get(['apiProvider']);
            if (result.apiProvider === 'local') {
                localApiControls.classList.remove('d-none');
            } else {
                localApiControls.classList.add('d-none');
            }
        }

        // 履歴タブ初期化
        if (historyTabContent) {
            const stored = await storage.get(['conversations']);
            const conversations = stored.conversations;
            if (conversations && conversations.length > 0) {
                renderConversationHistory(conversations);
            }
        }
    }

    /**
     * 履歴一覧を描画
     */
    function renderConversationHistory(conversations) {
        const historyList = document.createElement('div');
        historyList.className = 'conversation-history';

        conversations.forEach((conversation) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            const timestamp = new Date(conversation.timestamp).toLocaleString();
            const preview = conversation.messages[0]?.content?.slice(0, 50) + '...';

            historyItem.innerHTML = `
                <div class="history-item-header">
                    <span class="timestamp">${timestamp}</span>
                    <span class="model-info">${conversation.provider} (${conversation.model})</span>
                </div>
                <div class="preview">${preview}</div>
            `;

            historyItem.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('loadConversation', {
                    detail: { ...conversation, source: 'historyTab' }
                }));
                const chatTabButton = document.getElementById('chat-tab');
                if (chatTabButton) {
                    chatTabButton.click();
                }
            });

            historyList.appendChild(historyItem);
        });

        if (historyTabContent) {
            historyTabContent.innerHTML = '';
            historyTabContent.appendChild(historyList);
        }
    }

    // Local APIでURLマッチ判定
    async function checkLocalApiUrlMatch(currentUrl) {
        const { apiKeys, customSettings } = await chrome.storage.local.get(["apiKeys", "customSettings"]);
        if (!apiKeys?.local || !customSettings?.local?.url) {
            return false;
        }
        try {
            const baseUrl = customSettings.local.url.replace(/\/+$/, "");
            const resp = await fetch(`${baseUrl}/widget/html`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKeys.local}`
                },
                body: JSON.stringify({ url: currentUrl })
            });
            if (!resp.ok) {
                return false;
            }
            const data = await resp.json();
            if (data.status !== "success" || !Array.isArray(data.htmls) || data.htmls.length === 0) {
                return false;
            }
            return true;
        } catch (err) {
            console.debug("Local API not available");
            return false;
        }
    }

    await initialize();
});

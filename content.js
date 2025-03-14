// content.js
(() => {
    'use strict';

    // =====================
    // グローバル変数
    // =====================
    let isOpen = false;        // チャットパネルが開いているかどうか
    let container;             // チャット用のコンテナ要素

    // =====================
    // チャットコンテナの作成
    // =====================
    function createContainer() {
        container = document.createElement('div');
        container.id = "my-extension-chat-container";
        container.style.position = "fixed";
        container.style.top = "0";
        container.style.right = "0";
        container.style.width = "0";
        container.style.height = "100vh";
        container.style.zIndex = "999999";
        container.style.border = "none";
        container.style.overflow = "hidden";
        container.style.transition = "width 0.3s ease";

        const iframe = document.createElement("iframe");
        iframe.src = chrome.runtime.getURL("chat.html");
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";

        container.appendChild(iframe);
        document.body.appendChild(container);
    }

    // =====================
    // チャットの表示/非表示を切り替え
    // =====================
    function toggleChat() {
        isOpen = !isOpen;
        const toggleButton = document.querySelector('.chat-toggle-button');
        
        if (isOpen) {
            container.style.width = "360px";
            document.body.style.marginRight = "360px";
            toggleButton.style.right = "320px";
            toggleButton.classList.add('active');
        } else {
            container.style.width = "0";
            document.body.style.marginRight = "0";
            toggleButton.style.right = "0";
            toggleButton.classList.remove('active');
        }
    }

    // =====================
    // スタイルシートの追加（現在未使用）
    // =====================
    // 必要に応じて呼び出すことを想定した関数です。
    function addStylesheet() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('api_settings.css');
        document.head.appendChild(link);
    }

    // =====================
    // トグルボタンの初期化
    // =====================
    function initializeToggleButton() {
        const toggleButton = document.createElement('button');
        toggleButton.className = 'chat-toggle-button';
        toggleButton.innerHTML = `<span class="toggle-icon">‹</span>`;

        // トグルボタン用のスタイルを定義
        const styles = document.createElement('style');
        styles.textContent = `
            .chat-toggle-button {
                position: fixed;
                top: 50%;
                right: 0;
                transform: translateY(-50%);
                width: 24px;
                height: 120px;
                background: #2196F3;
                border: none;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                cursor: pointer;
                z-index: 999999;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
            }
            .chat-toggle-button:hover {
                background: #1976D2;
                box-shadow: 0 6px 12px rgba(0,0,0,0.3);
            }
            .chat-toggle-button.active {
                background: #1565C0;
            }
            .toggle-icon {
                font-size: 20px;
                line-height: 1;
                transition: transform 0.3s ease;
            }
            .chat-toggle-button.active .toggle-icon {
                transform: rotate(180deg);
            }
        `;

        document.head.appendChild(styles);
        document.body.appendChild(toggleButton);
        toggleButton.addEventListener('click', toggleChat);
    }

    // =====================
    // URLチェック処理（Local API用）
    // =====================
    async function checkParentURL(settings) {
        // Local API の場合
        if (settings.apiProvider === 'local') {
            try {
                const customSettings = settings.customSettings?.local || {};
                const response = await fetch(`${customSettings.url}/check-display-url`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        //'Authorization': `Bearer ${settings.apiKey}`
                        'Authorization': `Bearer ${settings.apiKeys.local}`
                    },
                    body: JSON.stringify({ current_url: window.location.href })
                });
                if (!response.ok) return false;
                const data = await response.json();
                return data.allowed;
            } catch (error) {
                console.error('URL check failed for Local API:', error);
                return false;
            }
        }
        // その他のAPIの場合は常に表示
        return true;
    }

    // =====================
    // ホームコンテンツの読み込み
    // =====================
    async function loadHomeContent() {
        const result = await chrome.storage.local.get([
            'apiProvider',
            'apiKeys',
            'customSettings'
        ]);

        const iframe = document.querySelector('#my-extension-chat-container iframe');
        if (!iframe) return;

        // Local APIの場合
        if (result.apiProvider === 'local') {
            const customSettings = result.customSettings?.local;
            if (!customSettings?.url || !result.apiKeys?.local) return;

            try {
                const response = await fetch(`${customSettings.url}/widget/menu`, {
                    headers: {
                        'Authorization': `Bearer ${result.apiKeys.local}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.content) {
                    iframe.contentWindow.postMessage({
                        type: 'LOAD_HOME_CONTENT',
                        content: data.content,
                        isLocal: true
                    }, '*');
                }
            } catch (error) {
                console.error('Failed to load home content:', error);
                iframe.contentWindow.postMessage({
                    type: 'LOAD_ERROR',
                    error: 'コンテンツの読み込みに失敗しました'
                }, '*');
            }
        }
        // その他のAPIの場合
        else {
            iframe.contentWindow.postMessage({
                type: 'LOAD_HOME_CONTENT',
                isLocal: false
            }, '*');
        }
    }

    // =====================
    // 認証状態のチェック
    // =====================
    function isAuthenticated(settings) {
        if (!settings.apiProvider) return false;
        if (settings.apiProvider === 'local') {
            return !!settings.apiKeys?.local && !!settings.customSettings?.local?.url;
        }
        return !!settings.apiKeys?.[settings.apiProvider];
    }

    // =====================
    // コンテナの初期化
    // =====================
    async function initializeContainer() {
        // 既にコンテナが存在する場合は何もしない
        if (document.getElementById("my-extension-chat-container")) return;
        
        const settings = await chrome.storage.local.get([
            'apiProvider',
            'apiKeys',
            'customSettings'
        ]);

        // 認証チェック
        if (!isAuthenticated(settings)) return;

        // URL許可チェック
        const isAllowed = await checkParentURL(settings);
        if (!isAllowed) return;

        // コンテナとボタンの作成
        createContainer();
        initializeToggleButton();

        // 初期状態は閉じたままにする
        isOpen = false;
        const createdContainer = document.getElementById("my-extension-chat-container");
        const toggleButton = document.querySelector('.chat-toggle-button');
        if (createdContainer) {
            createdContainer.style.width = "0";
            document.body.style.marginRight = "0";
        }
        if (toggleButton) {
            toggleButton.style.right = "0";
            toggleButton.classList.remove('active');
        }

        // ホームコンテンツの読み込み
        await loadHomeContent();
    }

    // =====================
    // ストレージ変更イベントの監視
    // =====================
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            const relevantKeys = ['apiProvider', 'apiKeys', 'customSettings'];
            const hasRelevantChanges = relevantKeys.some(key => changes[key]);
            
            if (hasRelevantChanges) {
                // 既存のチャットコンテナとトグルボタンを削除
                const existingContainer = document.getElementById("my-extension-chat-container");
                if (existingContainer) {
                    existingContainer.remove();
                }
                const existingButton = document.querySelector('.chat-toggle-button');
                if (existingButton) {
                    existingButton.remove();
                }
                
                // 再初期化
                initializeContainer();
            }
        }
    });

    // =====================
    // 拡張機能の初期化チェック
    // =====================
    chrome.storage.local.get(['apiProvider', 'apiKeys', 'customSettings'], function(settings) {
        if (isAuthenticated(settings)) {
            initializeContainer();
        }
    });

    // =====================
    // 拡張機能からのメッセージハンドラ
    // （getPageContentリクエストに対応）
    // =====================
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "getPageContent") {
            // ページのHTML全体を取得して返す
            sendResponse({ content: document.body.innerHTML });
        }
        return true; // 非同期レスポンスを有効にする
    });

    // =====================
    // ページ情報取得・フォーム情報取得メッセージのハンドラ
    // =====================
    window.addEventListener('message', (event) => {
        const iframe = document.querySelector('#my-extension-chat-container iframe');
        if (!iframe) return;

        switch (event.data.type) {
            case 'GET_PAGE_INFO': {
                iframe.contentWindow.postMessage({
                    type: 'PAGE_INFO',
                    title: document.title,
                    url: window.location.href
                }, '*');
                break;
            }
            case 'GET_FORM_CONTENT': {
                const xpath = event.data.xpath;
                const result = document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                );
                const element = result.singleNodeValue;
                const content = element ? element.outerHTML : '';

                iframe.contentWindow.postMessage({
                    type: 'FORM_CONTENT',
                    content: content,
                    baseUrl: window.location.origin
                }, '*');
                break;
            }
            default:
                break;
        }
    });
})();

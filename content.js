// content.js

(() => {
    'use strict';

    // =====================
    // グローバル変数
    // =====================
    let isOpen = false;
    let container;

    // =====================
    // Wait for document.body to be available
    // =====================
    function waitForBody() {
        return new Promise((resolve, reject) => {
            const checkBody = () => {
                if (document.body) {
                    resolve();
                } else {
                    setTimeout(checkBody, 100);
                }
            };
            checkBody();

            // Timeout after 5 seconds to prevent infinite loop
            setTimeout(() => reject(new Error('document.body not available after 5 seconds')), 5000);
        });
    }

    // =====================
    // チャットコンテナの作成
    // =====================
    async function createContainer() {
        try {
            await waitForBody();
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
        } catch (error) {
            console.error('[ContentScript] Failed to create container:', error.message);
        }
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
    // トグルボタンの初期化
    // =====================
    async function initializeToggleButton() {
        try {
            await waitForBody();
            const toggleButton = document.createElement('button');
            toggleButton.className = 'chat-toggle-button';
            toggleButton.innerHTML = `<span class="toggle-icon">‹</span>`;

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
        } catch (error) {
            console.error('[ContentScript] Failed to initialize toggle button:', error.message);
        }
    }

    // =====================
    // URLチェック処理（Local API用）
    // =====================
    async function checkParentURL(settings) {
        if (settings.apiProvider === 'local') {
            try {
                const customSettings = settings.customSettings?.local || {};
                const response = await fetch(`${customSettings.url}/check-display-url`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${settings.apiKeys.local}`
                    },
                    body: JSON.stringify({ current_url: window.location.href })
                });
                if (!response.ok) return false;
                const data = await response.json();
                return data.allowed;
            } catch (error) {
                console.error('[ContentScript] URL check failed for Local API:', error);
                return false;
            }
        }
        return true;
    }

    // =====================
    // ホームコンテンツの読み込み
    // =====================
    async function loadHomeContent() {
        let result;
        try {
            result = await chrome.storage.local.get([
                'apiProvider',
                'apiKeys',
                'customSettings'
            ]);
        } catch (error) {
            console.error('[ContentScript] Failed to access chrome.storage for home content:', error);
            return;
        }

        const iframe = document.querySelector('#my-extension-chat-container iframe');
        if (!iframe) return;

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
                console.error('[ContentScript] Failed to load home content:', error);
                iframe.contentWindow.postMessage({
                    type: 'LOAD_ERROR',
                    error: 'コンテンツの読み込みに失敗しました'
                }, '*');
            }
        } else {
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
        if (document.getElementById("my-extension-chat-container")) return;

        let settings;
        try {
            settings = await chrome.storage.local.get([
                'apiProvider',
                'apiKeys',
                'customSettings'
            ]);
        } catch (error) {
            console.error('[ContentScript] Failed to access chrome.storage (context may be invalidated):', error);
            return;
        }

        if (!isAuthenticated(settings)) return;

        const isAllowed = await checkParentURL(settings);
        if (!isAllowed) return;

        await createContainer();
        await initializeToggleButton();

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

        await loadHomeContent();
    }

    // =====================
    // ストレージ変更イベントの監視
    // =====================
    try {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                const relevantKeys = ['apiProvider', 'apiKeys', 'customSettings'];
                const hasRelevantChanges = relevantKeys.some(key => changes[key]);

                if (hasRelevantChanges) {
                    const existingContainer = document.getElementById("my-extension-chat-container");
                    if (existingContainer) {
                        existingContainer.remove();
                    }
                    const existingButton = document.querySelector('.chat-toggle-button');
                    if (existingButton) {
                        existingButton.remove();
                    }

                    initializeContainer();
                }
            }
        });
    } catch (error) {
        console.error('[ContentScript] Failed to set up chrome.storage.onChanged listener (context may be invalidated):', error);
    }

    // =====================
    // 拡張機能の初期化チェック
    // =====================
    try {
        chrome.storage.local.get(['apiProvider', 'apiKeys', 'customSettings'], function(settings) {
            if (isAuthenticated(settings)) {
                initializeContainer();
            }
        });
    } catch (error) {
        console.error('[ContentScript] Failed to initialize (context may be invalidated):', error);
    }

    // =====================
    // 拡張機能からのメッセージハンドラ
    // =====================
    try {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "getPageContent") {
                sendResponse({ content: document.body ? document.body.innerHTML : '' });
            }
            return true;
        });
    } catch (error) {
        console.error('[ContentScript] Failed to set up chrome.runtime.onMessage listener (context may be invalidated):', error);
    }

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

    // =====================
    // SPAナビゲーション検出とチャットリセット
    // =====================
    let lastUrl = window.location.href;

    // URL変更をポーリングで検出
    setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            console.log('[ContentScript][spaTransition] URL change detected via polling', { old: lastUrl, new: currentUrl });
            lastUrl = currentUrl;
            handleNavigation();
        }
    }, 500);

    // Popstateイベントでナビゲーションを検出
    window.addEventListener('popstate', () => {
        console.log('[ContentScript][spaTransition] Popstate event detected');
        handleNavigation();
    });

    // ナビゲーション処理
    function handleNavigation() {
        const iframe = document.querySelector('#my-extension-chat-container iframe');
        if (iframe) {
            console.log('[ContentScript][handleNavigation] Sending CLEAR_CHAT message to iframe at 04:27 AM EAT, May 22, 2025');
            iframe.contentWindow.postMessage({
                type: 'CLEAR_CHAT'
            }, '*');
        }
    }
})();
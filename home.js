// home.js
document.addEventListener('DOMContentLoaded', function() {
    const homeContent = document.getElementById('homeContent');

    const storage = {
        get: async function(keys) {
            secureLogger.log('Getting storage keys:', keys);
            if (typeof chrome !== 'undefined' && chrome.storage) {
                return new Promise((resolve) => {
                    chrome.storage.local.get(keys, (result) => {
                        secureLogger.log('Chrome storage result:', result);
                        resolve(result);
                    });
                });
            } else {
                const result = {};
                keys.forEach(key => {
                    const value = localStorage.getItem(key);
                    if (value) {
                        try {
                            result[key] = JSON.parse(value);
                        } catch {
                            result[key] = value;
                        }
                    }
                });
                secureLogger.log('LocalStorage result:', result);
                return result;
            }
        }
    };

    // 標準フォーマットのHTMLを生成
    async function getDefaultContent() {
      try {
          const lang = chrome.i18n.getUILanguage().split('-')[0] || 'ja';
          // chrome.runtime.getURL を使用してファイルパスを取得
          const mdPath = chrome.runtime.getURL(`docs/${lang}/home.md`);

          // fetch を使用してファイルを読み込む
          const response = await fetch(mdPath);
          const mdContent = await response.text();

          // MDをHTMLに変換
          const htmlContent = marked.parse(mdContent);

          return `
          <div class="container">
              ${htmlContent}
          </div>
          `;
      } catch (error) {
          console.error(chrome.i18n.getMessage('errorLoadingContent'), error);
          // フォールバックとして日本語版を読み込む
          try {
              const defaultMdPath = chrome.runtime.getURL('docs/ja/home.md');
              const response = await fetch(defaultMdPath);
              const defaultMdContent = await response.text();
              const htmlContent = marked.parse(defaultMdContent);
              return `
              <div class="container">
                  ${htmlContent}
              </div>
              `;
          } catch (fallbackError) {
              return `
              <div class="container">
                  <div class="alert alert-danger">
                      ${chrome.i18n.getMessage('errorLoadingContent')}
                  </div>
              </div>
              `;
          }
      }
  }

    async function getParentURL() {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            return new Promise((resolve) => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    secureLogger.log('Chrome tabs result:', tabs);
                    resolve(tabs[0]?.url || window.location.href);
                });
            });
        }
        secureLogger.log('Using window.location.href:', window.location.href);
        return window.location.href;
    }

    async function checkDisplayAccess(url, token) {
        secureLogger.log('Checking display access');
        secureLogger.log('URL:', url);
        secureLogger.log('Token exists:', !!token);

        const currentUrl = await getParentURL();
        secureLogger.log('Current URL:', currentUrl);

        // 開発環境では常にtrueを返す
        if (currentUrl.startsWith('file://')) {
          console.log(chrome.i18n.getMessage('developerEnvironment'));
            return true;
        }

        try {
            const response = await fetch(`${url}/check-display-url`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ current_url: currentUrl })
            });

            const data = await response.json();
            secureLogger.log('Display check response:', data);
            return data.allowed;
        } catch (error) {
          console.error(chrome.i18n.getMessage('displayCheckError'), error);
            return false;
        }
    }

    async function loadHomeContent() {
      homeContent.innerHTML = `<div class="loading"><span data-i18n="loadingContent"></span></div>`;

      try {
          const settings = await storage.get(['apiProvider', 'apiKeys', 'selectedModels', 'customSettings']);
            secureLogger.log('Loaded settings:', settings);

            // LocalAPIが選択され、必要な設定が揃っている場合
            if (settings.apiProvider === 'local' && 
                settings.apiKeys?.local && 
                settings.customSettings?.local?.url) {

                const url = settings.customSettings.local.url;
                const token = settings.apiKeys.local;
                secureLogger.log('Local API settings found:', { url, hasToken: !!token });

                const isAllowed = await checkDisplayAccess(url, token);
                secureLogger.log('Display access allowed:', isAllowed);

                if (isAllowed) {
                    try {
                        secureLogger.log('Fetching menu content');
                        const response = await fetch(`${url}/widget/menu`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        const data = await response.json();
                        secureLogger.log('Menu response:', data);

                        if (data.status === 'error') {
                          throw new Error(data.message || chrome.i18n.getMessage('menuFetchError'));
                        }

                        homeContent.innerHTML = data.html_content || getDefaultContent();
                        return;
                    } catch (error) {
                        console.error('Menu fetch error:', error);
                        homeContent.innerHTML = getDefaultContent();
                    }
                }
            } else {
              console.log(chrome.i18n.getMessage('usingDefaultContent'));
            }

            // LocalAPI以外、または設定が不完全な場合は標準フォーマットを表示
            homeContent.innerHTML = await getDefaultContent();
          } catch (error) {
              console.error(chrome.i18n.getMessage('errorLoadingContent'), error);
              homeContent.innerHTML = await getDefaultContent();
          }
      }

    loadHomeContent();
});

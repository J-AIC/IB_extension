// loader.js
window.initializeI18n = async function() {
    try {
        // i18nの初期化ロジック
        console.log('i18n initialized successfully');
    } catch (error) {
        console.error('Failed to initialize i18n:', error);
        throw error;
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.initializeI18n();
        console.log('i18n initialization completed');
    } catch (error) {
        console.error('i18n initialization failed:', error);
    }
    
    // スクリプトの重複読み込みを防ぐための関数
    const loadScript = async (scriptName) => {
        // すでに読み込まれているスクリプトをチェック
        if (document.querySelector(`script[src="${scriptName}"]`)) {
            console.log(`Script ${scriptName} is already loaded`);
            return;
        }

        try {
            const scriptElement = document.createElement('script');
            scriptElement.src = scriptName;
            await new Promise((resolve, reject) => {
                scriptElement.onload = resolve;
                scriptElement.onerror = reject;
                document.body.appendChild(scriptElement);
            });
            console.log(`Loaded: ${scriptName}`);
        } catch (error) {
            console.error(`Error loading ${scriptName}:`, error);
        }
    };

    const scripts = ['chat_history.js', 'chat.js', 'form-reader.js'];
    for (const script of scripts) {
        await loadScript(script);
    }
});